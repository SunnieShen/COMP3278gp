// Mock data boundary. Replace these methods with fetch() calls when the backend is ready.
// Browser data is demo state, not MySQL data. Never use this mock for real authentication.
import {sellers,items} from './data.js';
const KEY='group-eats-demo-v1';
const initial=()=>({user:null,favorites:[],itemFavorites:[],cart:[],sellerId:null,group:null,orders:[],address:'The University of Hong Kong'});
let state;
try {state={...initial(),...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{state=initial();}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function editable(){if(state.group&&(state.group.status==='locked'||state.group.deadline<=Date.now()))throw Error('This group order is locked.');}
export const api={
 getState:()=>structuredClone(state),getSellers:()=>structuredClone(sellers),getItems:id=>structuredClone(items.filter(x=>x.seller_user_id===Number(id))),
 setAddress(value){state.address=value;save();},
 login(name){state.user={user_id:1,username:name};save();},logout(){state.user=null;save();},
 favorite(id,item=false){const key=item?'itemFavorites':'favorites';state[key]=state[key].includes(id)?state[key].filter(x=>x!==id):[...state[key],id];save();},
 add(item){editable();if(state.sellerId&&state.sellerId!==item.seller_user_id&&(state.cart.length||state.group))throw Error('Your basket belongs to another store. Clear it first.');state.sellerId=item.seller_user_id;const existing=state.cart.find(x=>x.item_id===item.item_id);if(existing)existing.quantity++;else state.cart.push({...item,quantity:1,unit_price_snapshot:item.price,user_id:1});save();},
 quantity(id,delta){editable();state.cart=state.cart.map(x=>x.item_id===id?{...x,quantity:x.quantity+delta}:x).filter(x=>x.quantity>0);save();},
 clear(){state.cart=[];state.sellerId=null;state.group=null;save();},
 createGroup(sellerId,minutes=30){if(state.cart.length&&state.sellerId!==sellerId)throw Error('Clear the basket from the other store first.');state.sellerId=sellerId;state.group={order_id:Date.now(),seller_user_id:sellerId,deadline:Date.now()+minutes*60000,status:'open',members:[{user_id:1,username:state.user?.username||'You'}],friendSubtotal:0};save();},
 joinDemo(){editable();if(!state.group||state.group.status!=='open')throw Error('This group is no longer open.');if(state.group.members.length>1)return;state.group.members.push({user_id:2,username:'Alex'});state.group.friendSubtotal=68;save();},
 lock(){if(!state.group||state.group.deadline<=Date.now())throw Error('This group order has expired.');if(!state.cart.length)throw Error('Add your food before locking the order.');state.group.status='locked';save();},
 checkout(){if(!state.cart.length)throw Error('Your basket is empty.');if(state.group&&state.group.status!=='locked')throw Error('Lock the group order before placing it.');const order={order_id:Date.now(),cart:structuredClone(state.cart),sellerId:state.sellerId,group:structuredClone(state.group),date:new Date().toISOString()};state.orders.unshift(order);state.cart=[];state.group=null;state.sellerId=null;save();return order;},
 reset(){state=initial();save();}
};
