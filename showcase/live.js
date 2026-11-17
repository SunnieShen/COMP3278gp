const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE='/api/v1';
const keys={orders:['order_id'],group_orders:['order_id'],group_order_participants:['order_id','buyer_user_id'],order_items:['order_id','user_id','item_id'],deliveries:['delivery_id'],menu_items:['item_id']};
const steps=[
 {name:'Browse',crud:'READ',title:'Browse the real menu',body:'Sign in as Alice and open Harbour Cafe.',sql:()=>"SELECT item_id,item_name,price\nFROM menu_items\nWHERE seller_user_id=90101;"},
 {name:'Create',crud:'CREATE',title:'Create a group order',body:'Choose a deadline of at least 15 minutes. The order ID is followed automatically.',sql:()=>"INSERT INTO orders\n(host_user_id,seller_user_id,order_status,fulfillment_type)\nVALUES (%s,%s,'Pending',%s);\n\n-- The same transaction creates the group,\n-- host membership and optional delivery.\n-- Adding food is a separate request."},
 {name:'Join',crud:'CREATE + READ',title:'Bob joins and adds food',body:'Open the invite in a private window. Sign in as Bob, join and add milk tea.',sql:()=>`INSERT INTO group_order_participants\n(order_id,buyer_user_id)\nVALUES (${selected || '%s'},%s);\n\nINSERT INTO order_items\n(order_id,user_id,item_id,quantity,unit_price_snapshot)\nVALUES (${selected || '%s'},%s,%s,%s,%s);`},
 {name:'Update',crud:'UPDATE',title:'Change the quantity',body:'In Bob’s window, change the milk tea quantity from 1 to 2.',sql:()=>`UPDATE order_items\nSET quantity=%s\nWHERE order_id=${selected || '%s'}\n  AND user_id=%s\n  AND item_id=%s;`},
 {name:'Delete',crud:'DELETE',title:'Remove food or leave',body:'Bob can remove his food or leave the group. Leaving removes both his items and membership.',sql:()=>`DELETE FROM order_items\nWHERE order_id=${selected || '%s'} AND user_id=%s;\n\n-- Leaving also removes membership.\nDELETE FROM group_order_participants\nWHERE order_id=${selected || '%s'}\n  AND buyer_user_id=%s;`},
 {name:'Place',crud:'UPDATE + READ',title:'Alice places the order',body:'Keep at least one item, then confirm. Watch the status and timestamps update.',sql:()=>`START TRANSACTION;\nSELECT order_id FROM orders\nWHERE order_id=${selected || '%s'} FOR UPDATE;\n-- Validate host, status, items and coupon.\nUPDATE orders SET order_status='Confirmed'\nWHERE order_id=${selected || '%s'};\n-- Record placement and completion timing.\nCOMMIT;`}
];
let selected=null,seller=90101,userId=null,step=0,previous=null,current=null,inFlight=false;
let revision=0,deleted=new Map();
const positive=v=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:null;};
const startId=positive(new URLSearchParams(location.search).get('order'));
if(startId){selected=startId;$('order-id').value=selected;$('website').src=`/#/group/${selected}`;}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',3500);}
function guide(){
 $('steps').innerHTML=steps.map((s,i)=>`<button class="${i===step?'active':''}" data-step="${i}">${i+1}. ${esc(s.name)}<span>${esc(s.crud)}</span></button>`).join('');
 $('guide').innerHTML=`<strong>${esc(steps[step].title)}</strong>${esc(steps[step].body)}`;
 $('crud').textContent=steps[step].crud;$('write-sql').textContent=steps[step].sql();
 $('prev').disabled=step===0;$('next').disabled=step===steps.length-1;
}
function choose(id){
 if(selected===id)return;
 selected=id;revision++;previous=null;current=null;deleted.clear();$('tables').innerHTML='';$('read-sql').textContent='Loading…';
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
 if(state==='Confirmed'||state==='Completed')return 5;
 if(!previous||previous.order_id!==next.order_id)return next.order_id?1:0;
 const old=Object.fromEntries(previous.tables.map(t=>[t.name,t]));
 const now=Object.fromEntries(next.tables.map(t=>[t.name,t]));
 if(now.orders?.rows[0]?.order_status==='Confirmed'&&old.orders?.rows[0]?.order_status!=='Confirmed')return 5;
 if((now.order_items?.rows.length??0)<(old.order_items?.rows.length??0)||(now.group_order_participants?.rows.length??0)<(old.group_order_participants?.rows.length??0))return 4;
 if(now.order_items?.rows.some(r=>{const o=old.order_items?.rows.find(x=>rowKey(now.order_items,x)===rowKey(now.order_items,r));return o&&o.quantity!==r.quantity;}))return 3;
 if((now.group_order_participants?.rows.length??0)>(old.group_order_participants?.rows.length??0))return 2;
 return step;
}
function tables(data){
 const old=new Map((previous?.tables||[]).map(t=>[t.name,t]));
 const sameOrder=previous&&previous.order_id===data.order_id;
 let html=data.people?.length?`<div class="people">${data.people.map(p=>`${p.user_id} = ${esc(p.username)}`).join(' · ')}</div>`:'';
 for(const t of data.tables){
  const before=new Map(((sameOrder?old.get(t.name)?.rows:[])||[]).map(r=>[rowKey(t,r),r]));
  const after=new Set(t.rows.map(r=>rowKey(t,r)));
  for(const [k,r] of before)if(!after.has(k))deleted.set(t.name+':'+k,{table:t.name,row:r,until:Date.now()+8000});
  const removed=[...deleted.entries()].filter(([k,d])=>{if(d.until<Date.now()){deleted.delete(k);return false;}return d.table===t.name&&!after.has(rowKey(t,d.row));}).map(([,d])=>d.row);
  html+=`<section class="db-table"><div class="table-label"><strong>${esc(t.name)}</strong><span>${t.rows.length} ${t.rows.length===1?'row':'rows'}</span></div><div class="table-scroll"><table><thead><tr>${t.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>`;
  html+=t.rows.map(r=>{const p=before.get(rowKey(t,r));return `<tr class="${sameOrder&&!p?'added':''}">${t.columns.map(c=>`<td class="${r[c]===null?'null ':''}${p&&p[c]!==r[c]?'changed':''}" title="${esc(r[c]===null?'NULL':r[c])}">${esc(r[c]===null?'NULL':r[c])}</td>`).join('')}</tr>`;}).join('')||`<tr class="empty-row"><td colspan="${t.columns.length}">No rows</td></tr>`;
  html+='</tbody></table></div>';
  if(removed.length)html+=`<div class="removed">Deleted rows — no longer in the query result${removed.map(r=>`<code>${esc(Object.entries(r).map(([k,v])=>`${k}=${v??'NULL'}`).join(' · '))}</code>`).join('')}</div>`;
  html+='</section>';
 }
 $('tables').innerHTML=html;
 $('read-sql').textContent=data.tables.map(t=>`-- ${t.name}\n${t.sql}`).join('\n\n');
 $('database-name').textContent=data.source.database;
 $('last-query').textContent='Updated '+new Date(data.source.queried_at).toLocaleTimeString('en-HK',{timeZone:'Asia/Hong_Kong',hour12:false});
 $('notice').className='';$('notice').textContent=`${data.source.engine} · ${data.order_id?'Group #'+data.order_id:'Menu'} · 2s refresh`;
}
function clearData(message,error=false){
 previous=null;current=null;deleted.clear();$('tables').innerHTML=`<div class="blank">${esc(message)}</div>`;
 $('read-sql').textContent=message;$('notice').textContent=message;$('notice').className=error?'error':'';
 $('database-name').textContent='Not connected';$('last-query').textContent='No query result';
}
async function poll(){
 if(inFlight)return;inFlight=true;
 try{
  let hash='';try{hash=$('website').contentWindow.location.hash;$('frame-address').textContent=$('website').contentWindow.location.href;}catch{}
  const group=hash.match(/^#\/group\/(\d+)$/);const store=hash.match(/^#\/store\/(\d+)$/);
  if($('follow').checked&&group)choose(positive(group[1]));
  if(store)seller=positive(store[1])||90101;
  const user=await request('/showcase/session');
  if((user.user?.user_id??null)!==userId){revision++;previous=null;current=null;deleted.clear();userId=user.user?.user_id??null;}
  if(!user.user){$('led').className='';$('connection').textContent='Waiting for login';$('account').textContent='Not signed in';clearData('Sign in on the left to view MySQL data.');return;}
  $('account').textContent=user.user.username;
  const version=revision;
  const data=await request(selected?`/showcase/group-orders/${selected}`:`/showcase/catalog/${seller}`);
  if(version!==revision)return;
  if($('auto-guide').checked)step=changedStep(data);
  tables(data);previous=data;current=data;guide();
  $('led').className='live';$('connection').textContent='MySQL connected';
 }catch(e){if(e.status===401){userId=null;revision++;$('account').textContent='Not signed in';$('led').className='';$('connection').textContent='Waiting for login';clearData('Sign in on the left to view MySQL data.');return;}if(e.transient){$('led').className='';$('connection').textContent=e.message;return;}$('led').className='error';$('connection').textContent='Query failed';clearData(e.status===403?'Join this group or select an order you belong to.':e.message,true);}
 finally{inFlight=false;$('copy').disabled=!current;$('download').disabled=!current?.order_id;}
}
$('steps').onclick=e=>{const b=e.target.closest('[data-step]');if(b){step=Number(b.dataset.step);$('auto-guide').checked=false;guide();}};
$('prev').onclick=()=>{step=Math.max(0,step-1);$('auto-guide').checked=false;guide();};
$('next').onclick=()=>{step=Math.min(steps.length-1,step+1);$('auto-guide').checked=false;guide();};
function track(){const id=positive($('order-id').value);if(!id)return toast('Enter the group order ID shown on the website.');$('follow').checked=false;choose(id);poll();}
$('track').onclick=track;$('order-id').onkeydown=e=>{if(e.key==='Enter')track();};
$('refresh').onclick=poll;$('follow').onchange=()=>poll();
$('zoom').onchange=()=>document.documentElement.style.setProperty('--scale',$('zoom').value);
$('copy').onclick=async()=>{if(!current)return;const db=current.source.database.replace(/`/g,'``');const sql=`USE \`${db}\`;\n\n`+current.tables.map(t=>t.sql).join('\n\n');try{await navigator.clipboard.writeText(sql);toast('SQL copied. Paste it into Workbench.');}catch{toast('Select and copy the SQL in the middle panel.');}};
$('download').onclick=()=>{if(current?.order_id)location.href=BASE+`/showcase/group-orders/${current.order_id}/queries.sql`;};
$('website').addEventListener('load',()=>poll());
guide();poll();setInterval(poll,2000);
