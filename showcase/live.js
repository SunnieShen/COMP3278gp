const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE='/api/v1';
const keys={orders:['order_id'],group_orders:['order_id'],group_order_participants:['order_id','buyer_user_id'],order_items:['order_id','user_id','item_id'],deliveries:['delivery_id'],menu_items:['item_id']};
const steps=[
 {name:'Read',crud:'READ',title:'Read the menu',body:'Read the current seller’s menu items and prices from MySQL.'},
 {name:'Create',crud:'CREATE',title:'Create a group order',body:'Create a delivery group, then add food.'},
 {name:'Join',crud:'CREATE + READ',title:'Join and add food',body:'Bob joins the group and adds his items.'},
 {name:'Update',crud:'UPDATE',title:'Change the quantity',body:'Change the saved quantity while preserving its price snapshot.'},
 {name:'Delete',crud:'DELETE',title:'Remove food or leave',body:'Delete an item, or leave and delete membership as well.'},
 {name:'Place',crud:'UPDATE + READ',title:'Place the order',body:'Confirm the order and store its placement and completion times.'}
];
let restarting=new URLSearchParams(location.search).has('reset');
let selected=null,seller=90101,userId=null,step=0,deletionKind='leave',previous=null,current=null,inFlight=false;
const HIGHLIGHT_MS=30000;
const POLL_MS=500;
const stepTables=[['menu_items'],['orders','group_orders','group_order_participants','order_items','deliveries'],['group_order_participants','order_items'],['order_items'],['order_items','group_order_participants'],['orders']];
let revision=0,deleted=new Map(),highlights=new Map(),renderContext='';
const compactColumns={orders:['order_id','order_status','placed_at','completion_due_at'],group_orders:['order_id','deadline'],group_order_participants:['order_id','buyer_user_id'],order_items:['order_id','user_id','item_id','quantity','unit_price_snapshot'],deliveries:['order_id','delivery_status','shipping_fee'],menu_items:['item_id','item_name','price']};
const fullDetail=()=>$('full-detail').checked;
function resetHighlights(){deleted.clear();highlights.clear();}
function visibleTables(data){
 if(step===0)return data.view==='catalog'?data.tables.filter(t=>t.name==='menu_items'):[];
 if(!selected||data.order_id!==selected)return [];
 const names=step===4&&deletionKind==='item'?['order_items']:stepTables[step];
 const fulfillment=data.tables.find(t=>t.name==='orders')?.rows[0]?.fulfillment_type;
 return data.tables.filter(t=>names.includes(t.name)&&(step!==1||t.name!=='order_items'||t.rows.length)&&(step!==1||t.name!=='deliveries'||fulfillment==='Delivery'));
}
function columnsFor(t){
 if(fullDetail())return t.columns;
 if(step===1&&t.name==='orders')return ['order_id','host_user_id','seller_user_id','order_status','fulfillment_type'];
 if(step===1&&t.name==='deliveries')return ['order_id','courier_user_id','delivery_status','shipping_fee'];
 return compactColumns[t.name]||t.columns;
}
function redraw(){revision++;guide();if(current)tables(current);poll();}
const positive=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const startId=positive(new URLSearchParams(location.search).get('order'));
if(startId){selected=startId;$('order-id').value=selected;$('website').src=`/#/group/${selected}`;}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',3500);}
function guide(){
 $('steps').innerHTML=steps.map((s,i)=>`<button class="${i===step?'active':''}" data-step="${i}">${i+1}. ${esc(s.name)}<span>${esc(s.crud)}</span></button>`).join('');
 $('guide').innerHTML=`<strong>${esc(steps[step].title)}</strong>${esc(steps[step].body)}`;
 $('sql-label').textContent=step===0?'Executed SELECT':'Key SQL example';
 $('crud').textContent=steps[step].crud;$('write-sql').textContent=compactSQL();
 $('prev').disabled=step===0;$('next').disabled=step===steps.length-1;
}
function compactSQL(){
 const id=selected||'%s';
 const fulfillment=current?.order_id===selected?current?.tables.find(t=>t.name==='orders')?.rows[0]?.fulfillment_type||'Delivery':'Delivery';
 return [
  current?.view==='catalog'?current.tables.find(t=>t.name==='menu_items').sql:
  `SELECT item_id,item_name,price
FROM menu_items
WHERE seller_user_id=${seller}
ORDER BY item_id;`,
  `-- Create the order and related records
START TRANSACTION;
INSERT INTO orders
  (host_user_id, seller_user_id,
   order_status, fulfillment_type)
VALUES (%s, %s, 'Pending', '${fulfillment}');
SET @order_id = LAST_INSERT_ID();

INSERT INTO group_orders
  (order_id, deadline)
VALUES (@order_id, %s);
INSERT INTO group_order_participants
  (order_id, buyer_user_id)
VALUES (@order_id, %s);${fulfillment==='Delivery'?`\nINSERT INTO deliveries\n  (order_id, courier_user_id,\n   delivery_status, shipping_fee)\nVALUES (@order_id, %s, 'Assigned', %s);`:''}
COMMIT;
-- Adding food is a separate request.${current?.order_id===selected&&current?.tables.find(t=>t.name==='order_items')?.rows.length?`\n\nINSERT INTO order_items\n  (order_id, user_id, item_id,\n   quantity, unit_price_snapshot)\nVALUES (${id}, %s, %s, %s, %s)\nON DUPLICATE KEY UPDATE\n  quantity = VALUES(quantity);`:''}`,
  `-- Add Bob to the group
INSERT INTO group_order_participants
  (order_id, buyer_user_id)
VALUES (${id}, %s)
ON DUPLICATE KEY UPDATE
  buyer_user_id = VALUES(buyer_user_id);

-- Store his item and its price snapshot
INSERT INTO order_items
  (order_id, user_id, item_id,
   quantity, unit_price_snapshot)
VALUES (${id}, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity);`,
  `-- Same composite key: update quantity
INSERT INTO order_items
  (order_id, user_id, item_id,
   quantity, unit_price_snapshot)
VALUES (${id}, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
  quantity = VALUES(quantity);
-- The stored price snapshot is preserved.

-- Inspect the saved quantity and price
SELECT user_id, item_id, quantity,
       unit_price_snapshot
FROM order_items
WHERE order_id = ${id};`,
  deletionKind==='item'?`-- Delete only the selected food item
DELETE FROM order_items
WHERE order_id = ${id}
  AND user_id = %s
  AND item_id = %s;
-- Membership stays unchanged.`:
  `-- Leave: remove own items and membership
START TRANSACTION;
DELETE FROM order_items
WHERE order_id = ${id}
  AND user_id = %s;

DELETE FROM group_order_participants
WHERE order_id = ${id}
  AND buyer_user_id = %s;
COMMIT;
-- Both deletions succeed or roll back.
-- Other buyers' rows are kept.`,
  `START TRANSACTION;
-- Lock before checking host and items
SELECT order_id FROM orders
WHERE order_id = ${id} FOR UPDATE;

UPDATE orders
SET order_status = 'Confirmed'
WHERE order_id = ${id};

-- Preserve timing on repeated submission
UPDATE orders
SET placed_at = COALESCE(placed_at, NOW()),
    completion_due_at = COALESCE(
      completion_due_at,
      TIMESTAMPADD(SECOND, %s, NOW()))
WHERE order_id = ${id}
  AND order_status = 'Confirmed';
COMMIT;`
 ][step];
}
function displayValue(value){
 if(!fullDetail()&&typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value))return value.slice(11,19);
 return value===null?'NULL':value;
}
function choose(id){
 if(selected===id)return;
 selected=id;revision++;previous=null;current=null;resetHighlights();$('tables').innerHTML='';$('read-sql').textContent='Loading…';
 $('order-id').value=id||'';
 const url=new URL(location.href);if(id)url.searchParams.set('order',id);else url.searchParams.delete('order');history.replaceState({},'',url);
 guide();
}
async function request(path){
 let r;
 try{r=await fetch(BASE+path,{credentials:'same-origin',cache:'no-store'});}
 catch{throw Object.assign(new Error('Server is restarting. Reconnecting…'),{transient:true});}
 const text=await r.text();
 let payload=null;
 try{payload=text?JSON.parse(text):null;}catch{payload=null;}
 // An empty or non-JSON body happens during a service restart (the port is
 // briefly served by the OS). Treat it as a transient retry, not a query error.
 if(!payload||typeof payload!=='object')throw Object.assign(new Error('Empty response. Reconnecting…'),{status:r.status,transient:true});
 if(!r.ok)throw Object.assign(new Error(payload.error?.message||'Query failed'),{status:r.status});
 return payload.data;
}
function rowKey(t,row){return(keys[t.name]||t.columns).map(k=>String(row[k])).join(':');}
function changedStep(next){
 const state=next.tables.find(t=>t.name==='orders')?.rows[0]?.order_status;
 if(next.view==='existing'||next.view==='catalog')return 0;
 if(state==='Confirmed'||state==='Completed')return 5;
 if(!previous||previous.order_id!==next.order_id)return next.order_id?1:0;
 const old=Object.fromEntries(previous.tables.map(t=>[t.name,t]));
 const now=Object.fromEntries(next.tables.map(t=>[t.name,t]));
 if(now.orders?.rows[0]?.order_status==='Confirmed'&&old.orders?.rows[0]?.order_status!=='Confirmed')return 5;
 if((now.group_order_participants?.rows.length??0)<(old.group_order_participants?.rows.length??0)){deletionKind='leave';return 4;}
 if((now.order_items?.rows.length??0)<(old.order_items?.rows.length??0)){deletionKind='item';return 4;}
 if(now.order_items?.rows.some(r=>{const o=old.order_items?.rows.find(x=>rowKey(now.order_items,x)===rowKey(now.order_items,r));return o&&o.quantity!==r.quantity;}))return 3;
 if((now.group_order_participants?.rows.length??0)>(old.group_order_participants?.rows.length??0))return 2;
 if((now.order_items?.rows.length??0)>(old.order_items?.rows.length??0)&&step>=2)return 2;
 return step;
}
function tables(data){
 const scrolls=new Map([...$('tables').querySelectorAll('[data-table]')].map(el=>[el.dataset.table,{left:el.scrollLeft,top:el.scrollTop,focused:el===document.activeElement}]));
 const panelTop=$('tables').scrollTop;
 const context=`${data.order_id}:${data.view}:${step}:${fullDetail()}:${$('data-view').value}`;
 let focusChange=false;const freshTables=new Set();
 const old=new Map((previous?.tables||[]).map(t=>[t.name,t]));
 const sameOrder=previous&&previous.order_id===data.order_id&&previous.view===data.view;
 const time=Date.now();
 for(const [key,value] of highlights)if(value.until<=time)highlights.delete(key);
 let html=data.people?.length?`<div class="people">${data.people.map(p=>`${p.user_id} = ${esc(p.username)}`).join(' · ')}</div>`:'';
 for(const t of data.tables){
  const before=new Map(((sameOrder?old.get(t.name)?.rows:[])||[]).map(r=>[rowKey(t,r),r]));
  const after=new Set(t.rows.map(r=>rowKey(t,r)));
  for(const [k,r] of before)if(!after.has(k)){deleted.set(t.name+':'+k,{table:t.name,row:r,until:time+HIGHLIGHT_MS});focusChange=true;freshTables.add(t.name);}
  const removed=[...deleted.entries()].filter(([k,d])=>{if(d.until<Date.now()){deleted.delete(k);return false;}return d.table===t.name&&!after.has(rowKey(t,d.row));}).map(([,d])=>d.row);
  for(const r of t.rows){
   const k=rowKey(t,r),p=before.get(k),prefix=t.name+':'+k;
   if(sameOrder&&!p){highlights.set(prefix,{until:time+HIGHLIGHT_MS});focusChange=true;freshTables.add(t.name);}
   for(const c of t.columns)if(p&&p[c]!==r[c]){highlights.set(prefix+':'+c,{until:time+HIGHLIGHT_MS});focusChange=true;freshTables.add(t.name);}
  }
  if(!visibleTables(data).includes(t))continue;
  const columns=columnsFor(t);
  const active=r=>Math.max(0,...[...highlights].filter(([k])=>k===t.name+':'+rowKey(t,r)||k.startsWith(t.name+':'+rowKey(t,r)+':')).map(([,v])=>v.until));
  const rows=fullDetail()?t.rows:[...t.rows].sort((a,b)=>active(b)-active(a)).slice(0,3);
  html+=`<section class="db-table" data-section="${esc(t.name)}"><div class="table-label"><strong>${esc(t.name)}</strong><span>${rows.length<t.rows.length?rows.length+' / ':''}${t.rows.length} ${t.rows.length===1?'row':'rows'}</span></div><div class="table-scroll" data-table="${esc(t.name)}" tabindex="0" role="region" aria-label="${esc(t.name)} query results"><table><thead><tr>${columns.map(c=>`<th>${esc(c).replaceAll('_','_<wbr>')}</th>`).join('')}</tr></thead><tbody>`;
  html+=rows.map(r=>{const p=before.get(rowKey(t,r));return `<tr class="${highlights.has(t.name+':'+rowKey(t,r))?'added':''}">${columns.map(c=>`<td class="${r[c]===null?'null ':''}${highlights.has(t.name+':'+rowKey(t,r)+':'+c)?'changed':''}" title="${esc(r[c]===null?'NULL':r[c])}">${esc(displayValue(r[c]))}</td>`).join('')}</tr>`;}).join('')||`<tr class="empty-row"><td colspan="${columns.length}">No rows</td></tr>`;
  html+='</tbody></table></div>';
  if(removed.length)html+=`<div class="removed">Deleted rows — no longer in the query result${removed.map(r=>`<code>${esc(columns.map(k=>`${k}=${displayValue(r[k])}`).join(' · '))}</code>`).join('')}</div>`;
  html+='</section>';
 }
 $('tables').innerHTML=visibleTables(data).length?html:'<div class="blank">'+(step===0?'Loading menu items…':'Create or open a group order on the left.')+'</div>';
 for(const el of $('tables').querySelectorAll('[data-table]')){
  const saved=scrolls.get(el.dataset.table);if(!saved)continue;
  el.scrollLeft=saved.left;el.scrollTop=saved.top;
  if(saved.focused)el.focus({preventScroll:true});
 }
 $('tables').scrollTop=panelTop;
 if(!fullDetail()&&(context!==renderContext||focusChange)){
  $('tables').scrollTop=0;
  document.querySelector('.guide .scroll').scrollTop=0;
  const target=[...$('tables').querySelectorAll('[data-section]')].find(el=>freshTables.has(el.dataset.section));
  if(target)$('tables').scrollTop=Math.max(0,target.offsetTop-10);
 }
 renderContext=context;
 $('read-sql').textContent=visibleTables(data).map(t=>`-- ${t.name}\n${t.sql}`).join('\n\n');
 $('database-name').textContent=data.source.database;
 $('last-query').textContent='Updated '+new Date(data.source.queried_at).toLocaleTimeString('en-HK',{timeZone:'Asia/Hong_Kong',hour12:false});
 $('notice').className='';$('notice').textContent=`${data.source.engine} · ${data.order_id?'Group #'+data.order_id:data.view==='existing'?'Existing data · latest 30 accessible orders':'Menu'} · 0.5s refresh`;
}
function clearData(message,error=false){
 previous=null;current=null;resetHighlights();$('tables').innerHTML=`<div class="blank">${esc(message)}</div>`;
 $('read-sql').textContent=message;$('notice').textContent=message;$('notice').className=error?'error':'';
 $('database-name').textContent='Not connected';$('last-query').textContent='No query result';
}
async function poll(){
 if(inFlight||restarting)return;inFlight=true;
 try{
  let hash='';try{hash=$('website').contentWindow.location.hash;$('frame-address').textContent=$('website').contentWindow.location.href;}catch{}
  const group=hash.match(/^#\/group\/(\d+)$/);const store=hash.match(/^#\/store\/(\d+)$/);
  if($('follow').checked&&group)choose(positive(group[1]));
  if(store){seller=positive(store[1])||90101;if($('follow').checked)choose(null);}
  const user=await request('/showcase/session');
  if((user.user?.user_id??null)!==userId){revision++;previous=null;current=null;resetHighlights();userId=user.user?.user_id??null;}
  if(!user.user){$('led').className='';$('connection').textContent='Waiting for login';$('account').textContent='Not signed in';clearData('Sign in on the left to view MySQL data.');return;}
  $('account').textContent=user.user.username;
  const version=revision;
  const readMenu=!selected||(!$('auto-guide').checked&&step===0);
  const data=await request(readMenu?`/showcase/catalog/${seller}`:`/showcase/group-orders/${selected}`);
  if(version!==revision)return;
  if(data.seller_user_id)seller=data.seller_user_id;
  if($('auto-guide').checked)step=changedStep(data);
  tables(data);previous=data;current=data;guide();
  $('led').className='live';$('connection').textContent='MySQL connected';
 }catch(e){if(e.status===401){userId=null;revision++;$('account').textContent='Not signed in';$('led').className='';$('connection').textContent='Waiting for login';clearData('Sign in on the left to view MySQL data.');return;}if(e.transient){$('led').className='';$('connection').textContent=e.message;return;}$('led').className='error';$('connection').textContent='Query failed';clearData(e.status===403?'Join this group or select an order you belong to.':e.message,true);}
 finally{inFlight=false;$('copy').disabled=!current;$('download').disabled=!current;}
}
// A regular mouse wheel moves across wide results without dragging a scrollbar.
// At either edge it falls through so the outer list can still scroll vertically.
$('tables').addEventListener('wheel',e=>{
 const el=e.target.closest('.table-scroll');
 if(!el||e.ctrlKey||e.deltaX||!e.deltaY||el.scrollHeight>el.clientHeight)return;
 const max=el.scrollWidth-el.clientWidth;
 if(max<=1)return;
 const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientWidth:1);
 if((delta>0&&el.scrollLeft<max-1)||(delta<0&&el.scrollLeft>0)){
  e.preventDefault();el.scrollLeft=Math.max(0,Math.min(max,el.scrollLeft+delta));
 }
},{passive:false});
$('steps').onclick=e=>{const b=e.target.closest('[data-step]');if(b){step=Number(b.dataset.step);$('auto-guide').checked=false;redraw();}};
$('prev').onclick=()=>{step=Math.max(0,step-1);$('auto-guide').checked=false;redraw();};
$('next').onclick=()=>{step=Math.min(steps.length-1,step+1);$('auto-guide').checked=false;redraw();};
function track(){const id=positive($('order-id').value);if(!id)return toast('Enter the group order ID shown on the website.');$('follow').checked=false;choose(id);poll();}
$('track').onclick=track;$('order-id').onkeydown=e=>{if(e.key==='Enter')track();};
$('full-detail').onchange=()=>{document.body.classList.toggle('full-detail',fullDetail());renderContext='';redraw();};
$('data-view').onchange=()=>{revision++;previous=null;current=null;resetHighlights();$('tables').innerHTML='';poll();};
$('refresh').onclick=poll;$('follow').onchange=()=>poll();
$('zoom').onchange=()=>document.documentElement.style.setProperty('--scale',$('zoom').value);
$('copy').onclick=async()=>{if(!current)return;const db=current.source.database.replace(/`/g,'``');const sql=`USE \`${db}\`;\n\n`+visibleTables(current).map(t=>t.sql).join('\n\n');try{await navigator.clipboard.writeText(sql);toast('SQL copied. Paste it into Workbench.');}catch{toast('Select and copy the SQL in the middle panel.');}};
$('download').onclick=()=>{if(current)location.href=BASE+(current.order_id?`/showcase/group-orders/${current.order_id}/queries.sql`:'/showcase/existing/queries.sql');};
async function restartDemo(){
 restarting=true;$('restart').disabled=true;
 try{
  const response=await fetch(BASE+'/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Could not reset the session.');
  const payload=await response.json();
  const reset=await fetch(BASE+'/showcase/restart',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':payload.data.csrf_token}});
  if(!reset.ok)throw new Error('Could not restart. Please try again.');
  localStorage.clear();sessionStorage.clear();
  if('caches' in window)await Promise.all((await caches.keys()).map(key=>caches.delete(key)));
  location.replace('/showcase/live?fresh='+Date.now());
 }catch(e){restarting=false;$('restart').disabled=false;toast(e.message);}
}
$('restart').onclick=restartDemo;
$('website').addEventListener('load',()=>poll());
guide();if(restarting)restartDemo();else poll();setInterval(poll,POLL_MS);
