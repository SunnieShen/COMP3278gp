import {api} from './api.js';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => `HK$ ${(value / 100).toFixed(2)}`;
const date = value => new Intl.DateTimeFormat('en-HK', {timeZone:'Asia/Hong_Kong',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const photos = {90101:'bao',90102:'groceries',90103:'noodles',90104:'salad',92001:'chicken',92002:'coffee',92003:'groceries',92004:'bao',92005:'noodles',92006:'bao',92007:'groceries',92008:'dessert',92009:'curry'};
const image = (id,alt) => `<img src="assets/${photos[id] || 'salad'}.jpg" alt="${esc(alt)}" loading="lazy">`;
let user = null, sellers = [], service = 'delivery', category = 'All', search = '', sort = 'recommended', topRated = false;
let individual = null, activeOrderType = null;
let group = null, groupMenu = [], routeVersion = 0, busy = false, previousFocus = null;
function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4500);
}
function sync() {
  $('#auth').textContent = user?.username || 'Log in';
  $('#cart-count').textContent = activeOrderType==='individual' ? (individual?.order_status==='Pending'?individual.items.reduce((n,i)=>n+i.quantity,0):0) : group?.items?.filter(i => i.user_id === user?.user_id).reduce((n,i) => n+i.quantity,0) || 0;
  document.querySelectorAll('[data-service]').forEach(b => b.classList.toggle('active', b.dataset.service === service));
}
function closeModal() { $('#overlay-root').innerHTML = ''; previousFocus?.focus(); }
function modal(title, content) {
  previousFocus = document.activeElement;
  $('#overlay-root').innerHTML = `<div class="scrim" data-close></div><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><button class="modal-close icon-button" data-close aria-label="Close">×</button><h2>${title}</h2>${content}</section>`;
  setTimeout(() => $('#overlay-root input, #overlay-root button')?.focus(), 0);
}
function loginModal() {
  modal('Log in to foodpanda', `<p>Log in to order with your friends.</p><form id="login-form"><label>Email<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="Email address"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label><p class="muted">Welcome back. Your next meal is waiting.</p><p class="form-error" role="alert"></p><button class="primary full spaced">Log in</button></form>`);
}
function card(s) {
  return `<article class="store-card"><a class="store-photo" href="#/store/${s.seller_user_id}">${image(s.seller_user_id,s.username)}${s.active_status==='Inactive'?'<span class="offer">Currently inactive</span>':''}</a><a class="store-info" href="#/store/${s.seller_user_id}"><div><h3>${esc(s.username)}</h3><span class="rating">★ <b>${s.rating===null?'New':Number(s.rating).toFixed(1)}</b></span></div><p>${esc(s.cuisine_type || s.store_category || s.kind)}</p><p>Browse the menu</p></a></article>`;
}
function results() {
  let rows = sellers.filter(s => (service==='grocery'?s.kind==='grocery':s.kind==='restaurant') && (category==='All'||(s.cuisine_type||s.store_category)===category) && (!topRated||s.rating>=4.0) && `${s.username} ${s.cuisine_type||s.store_category||''}`.toLowerCase().includes(search.toLowerCase()));
  if(sort==='rating') rows.sort((a,b)=>(b.rating??-1)-(a.rating??-1));
  return `<div class="section-heading"><div><h2>${service==='grocery'?'All grocery stores':'All restaurants'}</h2></div><label class="sort">Sort by <select id="sort"><option value="recommended">Store order</option><option value="rating" ${sort==='rating'?'selected':''}>Top rated</option></select></label></div><div class="store-grid">${rows.map(card).join('')||'<div class="empty"><h3>No matches</h3><p>Try another search or category.</p></div>'}</div>`;
}
function renderHome() {
  const cats = [...new Set(sellers.filter(s=>service==='grocery'?s.kind==='grocery':s.kind==='restaurant').map(s=>s.cuisine_type||s.store_category).filter(Boolean))];
  $('#app').innerHTML = `<div class="container browse-layout"><aside class="filters"><section class="app-download"><img class="app-card-panda panda-mark" src="assets/foodpanda-mark.svg" alt="foodpanda"><h3>Enjoy more with the app</h3><p>Scan to visit the official<br>foodpanda download page.</p><a class="qr-link" href="https://www.foodpanda.hk/contents/apps" target="_blank" rel="noopener noreferrer"><img src="assets/app-download-qr.png" width="128" height="128" alt="QR for official app download"></a><a class="app-download-link" href="https://www.foodpanda.hk/contents/apps" target="_blank" rel="noopener noreferrer">Download the app ↗</a><small>Available on iOS and Android</small></section><h3>Filters</h3><h4>Quick filters</h4><label class="check"><input id="rating" type="checkbox" ${topRated?'checked':''}> Rated 4.0+</label><h4>Order together</h4><p>Choose your food.<br>Share the delivery fee.</p><a class="outline full" href="#/groups">Explore group orders ↗</a></aside><div class="browse-main"><div class="browse-topbar"><div class="browse-heading"><span>Hong Kong</span><h1>${service==='grocery'?'Grocery delivery':'Food delivery near you'}</h1></div><form class="search-form listing-search" id="search-form"><span>⌕</span><input id="search" aria-label="Search restaurants or cuisines" value="${esc(search)}" placeholder="Search restaurants, cuisines"><button class="search-submit">Search</button></form></div><div class="promo-row"><a href="#/groups" class="promo promo-pink"><span class="promo-icon">♧</span><span><small>ORDER WITH YOUR CREW</small><strong>One group.<br>Everyone’s favourites.</strong><em>Browse group orders →</em></span></a><a href="#/orders" class="promo promo-cream"><span><small>YOUR SHARED TABLE</small><strong>Pick up where<br>you left off.</strong><em>View your orders →</em></span></a></div><div class="category-heading"><h2>What are you craving?</h2></div><div class="categories">${['All',...cats].map(name=>`<button class="category ${category===name?'active':''}" data-category="${esc(name)}"><span>✦</span>${esc(name)}</button>`).join('')}</div><div id="results">${results()}</div></div></div>`;
}
function menuCards(menu, mode=false) {
  const isSolo=mode==='individual', active=isSolo?individual:group;
  return menu.map(i=>{
    const own=active?.items?.find(line=>line.item_id===i.item_id&&(isSolo||line.user_id===user?.user_id));
    const available=i.availability_status==='Available';
    const enabled=mode&&active?.can_edit&&available&&(!own||own.quantity<99);
    return `<article class="menu-card"><div><h3>${esc(i.item_name)}</h3><p>${available?'Freshly prepared · Available':'Currently unavailable'}</p><strong>${money(i.price_cents)}</strong></div><div class="menu-image">${image(i.item_id,i.item_name)}${mode?`<button ${isSolo?'data-solo-add':'data-add'}="${i.item_id}" ${enabled?'':'disabled'} aria-label="Add ${esc(i.item_name)}">+</button>`:''}</div></article>`;
  }).join('')||'<div class="empty"><h3>No items listed yet</h3><p>This seller has not added any menu items.</p></div>';
}
async function storePage(id,version) {
  const s=sellers.find(s=>s.seller_user_id===id);
  if(!s) throw Error('Store not found.');
  const menu=await api.items(id); if(version!==routeVersion) return;
  $('#app').innerHTML=`<div class="container store-page"><a href="#/" class="breadcrumb">← All stores</a><section class="store-banner">${image(id,s.username)}<div class="store-title"><span class="eyebrow">${esc(s.cuisine_type||s.store_category||s.kind)}</span><h1>${esc(s.username)}</h1><p>${s.rating===null?'No ratings yet':`★ ${Number(s.rating).toFixed(1)} · Customer rating`}</p><p>${s.active_status==='Inactive'?'Currently not accepting orders':'Order for yourself or share a group order with friends.'}</p></div></section><div class="store-toolbar"><span>Prices in HKD</span><div class="store-order-actions"><button class="primary" data-solo-create="${id}" ${s.active_status==='Inactive'||!menu.length?'disabled':''}>Order for myself</button><button class="outline" data-create="${id}" ${s.active_status==='Inactive'||!menu.length?'disabled':''}>Start a group order</button></div></div><h2>Menu</h2><p class="muted">Choose “Order for myself” or “Start a group order” to add food.</p><div class="menu-grid live-menu">${menuCards(menu)}</div></div>`;
}
async function groupList(scope,version) {
  if(!user) {$('#app').innerHTML='<section class="container empty"><h1>Your shared table awaits</h1><p>Log in to browse and join real group orders.</p><button class="primary" data-action="login">Log in</button></section>';return;}
  const response=await api.groups(scope);if(version!==routeVersion)return;
  const orders=response.orders;
  $('#app').innerHTML=`<section class="container groups-page"><span class="eyebrow">GOOD FOOD, TOGETHER</span><h1>${scope==='mine'?'Your group orders':'Join the table.'}</h1><p>${scope==='mine'?'Open orders and history from your account.':'Join an open group or choose a store and start your own.'}</p><div class="group-tabs"><a href="#/groups" class="outline ${scope==='joinable'?'selected':''}">Join a group</a><a href="#/orders" class="outline ${scope==='mine'?'selected':''}">My orders</a><a href="#/" class="primary">Find a store</a></div><div class="live-groups">${orders.map(o=>`<a href="#/group/${o.order_id}" class="live-group-card"><div><span class="pill">${esc(o.order_status)} · ${esc(o.group_status)}</span><h3>${esc(o.seller_name)}</h3><p>Group order #${o.order_id} · ${o.member_count} member${o.member_count===1?'':'s'}${o.is_host?' · You are the host':''}</p><small>Closes ${date(o.deadline)} HKT</small></div><strong>${o.is_member?'View order':'View & join'} →</strong></a>`).join('')||'<div class="empty"><h3>No groups here yet</h3><p>Choose a store to start one.</p></div>'}</div></section>`;
}
async function ordersPage(type,version) {
  if(!['all','group','individual'].includes(type))type='all';
  if(!user){$('#app').innerHTML='<section class="container empty"><h1>Your orders</h1><p>Log in to see your orders.</p><button class="primary" data-action="login">Log in</button></section>';return;}
  const response=await api.orders('all');if(version!==routeVersion)return;
  const visibleOrders=response.orders.filter(o=>type==='all'||o.order_type===type);
  const tabs=[['all','All orders'],['group','Group orders'],['individual','Individual orders']];
  $('#app').innerHTML=`<section class="container groups-page"><span class="eyebrow">YOUR FOOD, YOUR ORDERS</span><h1>Orders</h1><p>Orders for <strong>${esc(user.username)}</strong>. Includes orders you placed and groups you joined.</p><button class="outline order-refresh" data-action="refresh">Refresh orders</button><nav class="group-tabs" aria-label="Order type">${tabs.map(([key,label])=>`<a href="#/orders?type=${key}" class="outline ${type===key?'selected':''}" ${type===key?'aria-current="page"':''}>${label} <span class="order-count">${response.orders.filter(o=>key==='all'||o.order_type===key).length}</span></a>`).join('')}</nav><div class="live-groups">${visibleOrders.map(o=>`<a href="#/${o.order_type==='group'?'group':'order'}/${o.order_id}" class="live-group-card"><div><span class="pill">${o.order_type==='group'?'Group order':'Individual order'} · ${esc(o.order_status)}</span><h3>${esc(o.seller_name)}</h3><p>Order #${o.order_id} · ${esc(o.fulfillment_type)}${o.order_type==='group'?` · ${o.member_count} member${o.member_count===1?'':'s'}`:''}</p><small>${date(o.created_at)} HKT</small></div><strong>View order →</strong></a>`).join('')||`<div class="empty"><h3>${type==='individual'?'No individual orders yet':type==='group'?'No group orders yet':'No orders yet'}</h3><p>${type==='individual'?'Choose “Order for myself” from a store to start your first individual order.':'Your orders will appear here.'}</p><a class="outline" href="#/">Browse stores</a></div>`}</div></section>`;
}
function timingNote(o) {
  if(o.completed_at)return `<p class="order-timing">Completed ${date(o.completed_at)} HKT</p>`;
  if(o.completion_due_at&&o.order_status==='Confirmed')return `<p class="order-timing">Estimated completion ${date(o.completion_due_at)} HKT</p>`;
  return '';
}
function individualReceipt(o) {
  return `<div class="basket solo-receipt"><h2>Your order</h2>${o.items.map(i=>`<div class="basket-item"><div><b>${esc(i.item_name)}</b><small>${money(i.unit_price_snapshot_cents)} each</small>${o.can_edit?`<button class="text-button" data-solo-remove="${i.item_id}">Remove</button>`:''}</div>${o.can_edit?`<div class="stepper"><button data-solo-qty="${i.item_id}" data-value="${i.quantity-1}" aria-label="Decrease ${esc(i.item_name)} quantity">−</button><span>${i.quantity}</span><button data-solo-qty="${i.item_id}" data-value="${i.quantity+1}" ${i.quantity>=99?'disabled':''} aria-label="Increase ${esc(i.item_name)} quantity">+</button></div>`:`<b>${i.quantity} × ${money(i.unit_price_snapshot_cents)}</b>`}</div>`).join('')||'<p class="muted">Your basket is empty. Add something delicious.</p>'}<div class="totals"><p><span>Food subtotal</span><b>${money(o.item_subtotal_cents)}</b></p><p><span>Delivery fee</span><b>${money(o.shipping_fee_cents)}</b></p><p class="total"><b>Total</b><b>${money(o.total_cents)}</b></p><small>Before coupons. No online payment is collected.</small></div>${o.can_edit?`<button class="primary full" data-action="solo-place" ${o.can_place?'':'disabled'}>Place order · ${money(o.total_cents)}</button><button class="text-button full spaced" data-action="solo-cancel">Cancel order</button>`:''}</div>`;
}
async function individualPage(id,version) {
  if(!user){$('#app').innerHTML='<section class="container empty"><h1>Your order</h1><p>Log in to view order details.</p><button class="primary" data-action="login">Log in</button></section>';return;}
  const o=await api.order(id);if(version!==routeVersion)return;
  if(o.order_type==='group'){location.hash=`#/group/${id}`;return;}
  const menu=o.can_edit?await api.items(o.seller_user_id):[];if(version!==routeVersion)return;
  individual=o;activeOrderType='individual';
  $('#app').innerHTML=`<section class="container store-page"><a href="#/orders?type=individual" class="breadcrumb">← Individual orders</a><section class="live-group-header"><div><span class="eyebrow">INDIVIDUAL ORDER #${o.order_id}</span><h1>${esc(o.seller_name)}</h1><p>${date(o.created_at)} HKT · ${esc(o.fulfillment_type)}</p><span class="pill">${esc(o.order_status)}</span></div></section><p class="state-banner">${o.can_edit?'Choose your food and place your order whenever you are ready.':o.order_status==='Confirmed'?'Order placed successfully. Your food order is confirmed.':o.order_status==='Cancelled'?'This order was cancelled.':o.order_status==='Completed'?'Your order is complete. Enjoy your meal!':'Your order details.'}</p>${timingNote(o)}${o.can_edit?`<div class="menu-layout"><section><h2>Choose your food</h2><div class="menu-grid live-menu">${menuCards(menu,'individual')}</div></section><aside class="solo-desktop">${individualReceipt(o)}</aside></div><div class="solo-mobile">${individualReceipt(o)}</div>`:`<div class="individual-receipt"><h2 class="menu-title">Order details</h2>${individualReceipt(o)}</div>`}</section>`;
  sync();
}
function createIndividualModal(id) {
  if(!user)return loginModal();
  modal('Order for myself',`<p>Choose delivery or pickup. You can add food and place your order immediately.</p><form id="individual-create-form" data-seller="${id}"><label>Order type<select name="fulfillment"><option value="Delivery">Delivery</option><option value="Self-Pickup">Self-pickup</option></select></label><p class="form-error" role="alert"></p><button class="primary full spaced">Continue to menu</button></form>`);
}
function ownLines() {return group.items.filter(i=>i.user_id===user.user_id);}
function summary() {
  const me=group.members.find(m=>m.buyer_user_id===user.user_id);
  return `<div class="basket"><div class="basket-heading"><h2>Your order</h2></div><div class="basket-items">${ownLines().map(i=>`<div class="basket-item"><div><b>${esc(i.item_name)}</b><small>${money(i.unit_price_snapshot_cents)} each</small><button class="text-button" data-remove="${i.item_id}" ${group.can_edit?'':'disabled'}>Remove</button></div><div class="stepper"><button data-qty="${i.item_id}" data-value="${i.quantity-1}" ${group.can_edit?'':'disabled'} aria-label="Decrease ${esc(i.item_name)} quantity">−</button><span>${i.quantity}</span><button data-qty="${i.item_id}" data-value="${i.quantity+1}" ${group.can_edit&&i.quantity<99?'':'disabled'} aria-label="Increase ${esc(i.item_name)} quantity">+</button></div></div>`).join('')||'<p class="muted">No items yet. Choose from the menu.</p>'}</div><div class="totals"><p><span>Your food</span><b>${money(me.item_subtotal_cents)}</b></p><p><span>Your delivery share</span><b>${money(me.shipping_share_cents)}</b></p><p class="total"><b>Your total</b><b>${money(me.total_cents)}</b></p><small>Before coupons. No payment is collected.</small></div>${group.can_place?'<button class="primary full" data-action="place">Place group order</button>':group.order_status==='Pending'&&group.host_user_id===user.user_id&&!group.items.length?`<button class="primary full" disabled>Add food before placing</button><p class="basket-caption">Add at least one item to place the order.</p>`:''}<p class="basket-caption">Delivery remainder is allocated to the host.</p>${group.can_leave?'<button class="outline full spaced" data-action="leave">Leave group & remove my items</button>':''}${group.can_cancel?'<button class="text-button full" data-action="cancel">Cancel this group order</button>':''}</div>`;
}
function renderGroup() {
  const g=group;
  if(!g.members){
    $('#app').innerHTML=`<section class="container groups-page"><a href="#/groups" class="breadcrumb">← Group orders</a><h1>${esc(g.seller_name)}</h1><p>Group #${g.order_id} · ${g.member_count} member${g.member_count===1?'':'s'} · ${esc(g.order_status)}</p><p>Closes ${date(g.deadline)} HKT · ${esc(g.group_status)}</p><p>Join to view everyone’s items and add your own food.</p><button class="primary" data-action="join" ${g.can_join?'':'disabled'}>${g.can_join?'Join this group':'This group is closed'}</button></section>`;return;
  }
  $('#app').innerHTML=`<div class="container store-page"><a href="#/orders" class="breadcrumb">← Orders</a><section class="live-group-header"><div><span class="eyebrow">GROUP #${g.order_id}</span><h1>${esc(g.seller_name)}</h1><p>${g.member_count} member${g.member_count===1?'':'s'} · ${esc(g.fulfillment_type)} · Closes ${date(g.deadline)} HKT</p><span class="pill">${esc(g.order_status)}${g.order_status==='Pending'?' · '+esc(g.group_status):''}</span></div><div class="group-controls"><button class="outline" data-action="invite">Copy invite link ↗</button><button class="outline" data-action="refresh">Refresh</button></div></section><p class="state-banner">${g.order_status==='Cancelled'?'This group was cancelled.':g.order_status==='Completed'?'Your order is complete. Enjoy your meal!':g.order_status==='Confirmed'?'Order placed successfully. Your food order is confirmed.':g.can_edit?'Add food before the deadline. The host can place the order whenever everyone is ready.':g.order_status==='Pending'?'The group is closed. The host can now place the order.':'This order is read-only.'}</p>${timingNote(g)}<div class="menu-layout"><section><h2>Everyone at the table</h2><p class="muted">Amounts before coupons. Total delivery: ${money(g.shipping_fee_cents)}.</p><div class="member-cards">${g.members.map(m=>`<article class="member-card"><h3>${esc(m.username)} ${m.is_host?'<span class="pill">Host</span>':''}${m.buyer_user_id===user.user_id?' <small>(you)</small>':''}</h3><ul>${g.items.filter(i=>i.user_id===m.buyer_user_id).map(i=>`<li>${i.quantity} × ${esc(i.item_name)} <span>${money(i.line_total_cents)}</span></li>`).join('')||'<li>No items yet</li>'}</ul><p>Food ${money(m.item_subtotal_cents)} + delivery ${money(m.shipping_share_cents)} <b>${money(m.total_cents)}</b></p></article>`).join('')}</div><h2 class="menu-title">Add something delicious</h2><div class="menu-grid">${menuCards(groupMenu,true)}</div></section><aside id="inline-basket">${summary()}</aside></div><div class="mobile-summary">${summary()}</div></div>`;
}
async function loadGroup(id,version) {
  if(!user){$('#app').innerHTML='<section class="container empty"><h1>Join your friends</h1><p>Log in to open this group invite.</p><button class="primary" data-action="login">Log in</button></section>';return;}
  const next=await api.group(id);
  const menu=next.members?await api.items(next.seller_user_id):[];
  if(version!==routeVersion)return;
  group=next;activeOrderType='group';groupMenu=menu;renderGroup();sync();
}
async function route() {
  const version=++routeVersion;
  closeModal();$('#app').innerHTML='<div class="container loading" role="status">Loading…</div>';
  try {
    user=await api.session();sellers=await api.sellers();if(version!==routeVersion)return;
    const hash=location.hash||'#/';const store=hash.match(/^#\/store\/(\d+)$/),match=hash.match(/^#\/group\/(\d+)$/);
    if(match){service='groups';await loadGroup(Number(match[1]),version);}
    else if(store) await storePage(Number(store[1]),version);
    else if(hash==='#/orders'||hash.startsWith('#/orders?')||hash==='#/mine'){service='orders';const type=new URLSearchParams(hash.split('?')[1]||'').get('type')||'all';await ordersPage(type,version);}
    else if(hash.match(/^#\/order\/\d+$/)){service='orders';await individualPage(Number(hash.split('/').at(-1)),version);}
    else if(hash==='#/groups'){service='groups';await groupList('joinable',version);}
    else {if(service==='groups'||service==='orders')service='delivery';renderHome();}
    if(version===routeVersion)sync();
  } catch(e) {
    if(version!==routeVersion)return;
    if(e.status===401)user=null;
    $('#app').innerHTML=`<section class="container empty"><h2>We couldn’t load this page</h2><p>${esc(e.message)}</p><button class="primary" data-action="refresh">Try again</button></section>`;sync();
  }
}
function createModal(id) {
  if(!user)return loginModal();
  modal('Start a group order',`<p>Choose when your group closes. Everyone pays for their own food and shares delivery; the host pays any remaining cents.</p><form id="create-form" data-seller="${id}"><label>Order closes in<select name="minutes"><option value="1">1 minute</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 hour</option></select></label><label>Order type<select name="fulfillment"><option value="Delivery">Delivery (server-configured fee)</option><option value="Self-Pickup">Self-pickup (no delivery fee)</option></select></label><p class="form-error" role="alert"></p><button class="primary full spaced">Create group order</button></form>`);
}
async function run(task,button) {
  if(busy)return;busy=true;if(button)button.disabled=true;
  try {await task();}catch(e){
    const error=$('#overlay-root .form-error');if(error)error.textContent=e.message;else toast(e.message);
    if(e.status===401){user=null;sync();loginModal();}
    if(e.status===409)await route();
  }finally{busy=false;if(button?.isConnected)button.disabled=false;}
}
document.addEventListener('click',e=>{
  if(e.target.closest('#overlay-root a[href]'))closeModal();
  const b=e.target.closest('button,[data-close]');if(!b)return;
  if(b.hasAttribute('data-close'))return closeModal();
  if(b.dataset.service){service=b.dataset.service;category='All';search='';if(service==='orders'){if(location.hash==='#/orders')route();else location.hash='#/orders';}else if(service==='groups')location.hash='#/groups';else if(location.hash!=='#/')location.hash='#/';else route();return;}
  if(b.dataset.category){category=b.dataset.category;renderHome();return;}
  if(b.dataset.soloCreate)return createIndividualModal(Number(b.dataset.soloCreate));
  if(b.dataset.create)return createModal(Number(b.dataset.create));
  run(async()=>{
    if(b.dataset.soloAdd){const item=Number(b.dataset.soloAdd),line=individual.items.find(i=>i.item_id===item);await api.setIndividualItem(individual.order_id,item,(line?.quantity||0)+1);await individualPage(individual.order_id,routeVersion);return;}
    if(b.dataset.soloQty){const qty=Number(b.dataset.value);if(qty<=0)await api.removeIndividualItem(individual.order_id,Number(b.dataset.soloQty));else await api.setIndividualItem(individual.order_id,Number(b.dataset.soloQty),qty);await individualPage(individual.order_id,routeVersion);return;}
    if(b.dataset.soloRemove){await api.removeIndividualItem(individual.order_id,Number(b.dataset.soloRemove));await individualPage(individual.order_id,routeVersion);return;}
    if(b.dataset.add){const item=Number(b.dataset.add),line=ownLines().find(i=>i.item_id===item);await api.setItem(group.order_id,item,(line?.quantity||0)+1);await loadGroup(group.order_id,routeVersion);toast('Changes saved');return;}
    if(b.dataset.qty){const qty=Number(b.dataset.value);if(qty<=0)await api.removeItem(group.order_id,Number(b.dataset.qty));else await api.setItem(group.order_id,Number(b.dataset.qty),qty);await loadGroup(group.order_id,routeVersion);return;}
    if(b.dataset.remove){await api.removeItem(group.order_id,Number(b.dataset.remove));await loadGroup(group.order_id,routeVersion);toast('Item removed');return;}
    switch(b.dataset.action){
      case 'login':loginModal();break;
      case 'solo-place':modal('Place your order?',`<p>Confirm your food and delivery total of ${money(individual.total_cents)}. No online payment is collected.</p><button class="primary full" data-action="solo-confirm-place">Confirm & place order</button>`);break;
      case 'solo-confirm-place':await api.placeIndividual(individual.order_id);await route();toast('Order placed successfully');break;
      case 'solo-cancel':modal('Cancel your order?',`<p>Your order will remain in history as cancelled.</p><button class="primary full" data-action="solo-confirm-cancel">Cancel order</button>`);break;
      case 'solo-confirm-cancel':await api.cancelIndividual(individual.order_id);await route();break;
      case 'refresh':await route();break;
      case 'join':await api.join(group.order_id);await route();toast('You joined the group');break;
      case 'leave':modal('Leave this group?',`<p>Your items will be removed from the database. You can join again before the deadline.</p><button class="primary full" data-action="confirm-leave">Leave group</button>`);break;
      case 'confirm-leave':await api.leave(group.order_id);closeModal();location.hash='#/orders';break;
      case 'place':modal('Place this group order?',`<p>This submits everyone’s food and closes the group to all changes, even before the deadline. No online payment is collected.</p><button class="primary full" data-action="confirm-place">Confirm & place order</button>`);break;
      case 'confirm-place':await api.place(group.order_id);await route();toast('Order placed successfully');break;
      case 'cancel':modal('Cancel this group?',`<p>Everyone will lose the ability to change this order. The records will remain in the database.</p><button class="primary full" data-action="confirm-cancel">Cancel group order</button>`);break;
      case 'confirm-cancel':await api.cancel(group.order_id);await route();break;
      case 'invite':{const url=`${location.origin}/#/group/${group.order_id}`;try{await navigator.clipboard.writeText(url);toast('Invite link copied');}catch{modal('Invite your friends',`<p>Open this link in another browser and log in with another buyer.</p><input readonly value="${esc(url)}" aria-label="Group invite link">`);}break;}
      case 'logout':await api.logout();user=null;group=null;individual=null;await route();break;
    }
  },b);
});
document.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target;
  if(f.id==='search-form'){search=$('#search').value.trim();$('#results').innerHTML=results();return;}
  run(async()=>{
    const values=new FormData(f);
    if(f.id==='login-form'){user=await api.login(values.get('email'),values.get('password'));await route();toast('Logged in');}
    if(f.id==='individual-create-form'){
      const o=await api.createIndividual({seller_user_id:Number(f.dataset.seller),fulfillment_type:values.get('fulfillment')});
      closeModal();location.hash=`#/order/${o.order_id}`;
    }
    if(f.id==='create-form'){
      // Use the server clock rather than the browser clock to construct the deadline.
      const clock=await api.groups('mine');const instant=new Date(new Date(clock.server_time).getTime()+Number(values.get('minutes'))*60000);
      const g=await api.create({seller_user_id:Number(f.dataset.seller),deadline:instant.toISOString(),fulfillment_type:values.get('fulfillment')});
      closeModal();location.hash=`#/group/${g.order_id}`;
    }
  },f.querySelector('button[type="submit"],button'));
});
document.addEventListener('change',e=>{if(e.target.id==='sort'){sort=e.target.value;$('#results').innerHTML=results();}if(e.target.id==='rating'){topRated=e.target.checked;$('#results').innerHTML=results();}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeModal();
  if(e.key==='Tab'&&$('#overlay-root [role="dialog"]')){
    const nodes=[...$('#overlay-root').querySelectorAll('button:not([disabled]),input,select,a[href]')];const first=nodes[0],last=nodes.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});
$('#auth').onclick=()=>user?modal('Your account',`<p>Signed in as ${esc(user.username)}.</p><a class="primary full account-link" href="#/orders">Orders</a><button class="outline full spaced" data-action="logout">Log out</button>`):loginModal();
$('#cart-button').onclick=()=>{location.hash=activeOrderType==='individual'&&individual?.order_status==='Pending'?`#/order/${individual.order_id}`:group?.members?`#/group/${group.order_id}`:'#/orders';};
$('#language').onclick=()=>toast('The website is in English. Documentation is available in English and Chinese.');
$('#location').onclick=()=>toast('Hong Kong demo. Delivery address selection is outside phase one.');
window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0);});
setInterval(async()=>{
  if(busy||$('#overlay-root').children.length||!user)return;
  const match=location.hash.match(/^#\/(group|order)\/(\d+)$/);
  try{
    if(match&&match[1]==='group'&&group?.order_id===Number(match[2]))await loadGroup(group.order_id,routeVersion);
    else if(match&&match[1]==='order'&&individual?.order_id===Number(match[2]))await individualPage(individual.order_id,routeVersion);
    else if(location.hash.startsWith('#/orders'))await route();
  }catch(e){toast(e.message);}
},15000);
route();
