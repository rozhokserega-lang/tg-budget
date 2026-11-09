const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
function setup(real=false){
 let scope='alice',html='',calls=[],handlers={},storage=new Map(),form=null,resolve;
 const root={Fmt:{escapeHtml:s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},State:{get:()=>({member:{id:scope}})},Api:{isDemo:()=>!real,url:'https://example.test/functions/v1/api'},Tg:{initData:()=> 'signed-data'},navigator:{},setInterval:()=>{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},open:()=>{},fetch:(url,q)=>{calls.push({url,body:JSON.parse(q.body)});return new Promise(r=>{resolve=r;});}};
 const document={hidden:false,addEventListener:(n,fn)=>handlers[n]=fn,querySelector:s=>s==='[data-leisure-settings]'?form:s==='[name=cityQuery]'?{value:'Москва'}:null,querySelectorAll:()=>[]};
 vm.runInNewContext(fs.readFileSync('src/leisure.js','utf8'),{window:root,document,Intl,Date,AbortSignal,Number,Array,Promise,JSON,Set});
 return {root,handlers,calls,open:()=>root.Leisure.open(h=>{html=h;}),get html(){return html;},action:(n,attrs={})=>root.Leisure.action(n,{getAttribute:k=>attrs[k],href:attrs.href}),setForm:f=>{form=f;},switch:()=>{scope='bob';},reply:v=>resolve({ok:true,json:async()=>v})};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('city-local midnight and encoded Yandex search',()=>{const {root}=setup();assert.equal(root.Leisure.day('Asia/Kamchatka',new Date('2026-11-09T15:30:00Z')),'2026-11-10');assert.equal(root.Leisure.day('Europe/Kaliningrad',new Date('2026-11-09T15:30:00Z')),'2026-11-09');let u=new URL(root.Leisure.url({name:'Кафе & Чай',city:'Казань',address:'ул. 1',lat:55.1,lon:49.1}));assert.equal(u.searchParams.get('text'),'Кафе & Чай, Казань, ул. 1');assert.equal(u.searchParams.get('sll'),'49.1,55.1');});
test('demo chooses city, saves interests, favorites and plans survive reopening; scopes isolated',async()=>{
 const a=setup();a.open();await tick();assert.match(a.html,/Ваши интересы/);assert.match(a.html,/Демо: учебные места/);
 a.action('leisure-search');await tick();a.action('leisure-city',{'data-id':'524901'});
 a.setForm({elements:{exclude:{checked:true}}});a.handlers.submit({target:{matches:()=>true},preventDefault(){}});await tick();
 assert.match(a.html,/Ваши идеи на сегодня/);assert.equal((a.html.match(/<article /g)||[]).length,3);
 const id=a.html.match(/data-action="leisure-fav" data-id="([^"]+)"/)[1];a.action('leisure-fav',{'data-id':id});await tick();a.action('leisure-tab',{'data-tab':'favorites'});assert.equal((a.html.match(/<article /g)||[]).length,1);
 a.root.Leisure.close();a.open();await tick();a.action('leisure-tab',{'data-tab':'favorites'});assert.match(a.html,/aria-pressed="true" aria-label="Удалить из избранного"/);
 a.switch();a.open();await tick();assert.match(a.html,/Выберите город из результатов/);
});
test('production uses authenticated backend and ignores a stale response after account switch',async()=>{
 const a=setup(true);a.open();assert.match(a.html,/Загрузка рекомендаций/);assert.equal(a.calls[0].url,'https://example.test/functions/v1/leisure');assert.equal(a.calls[0].body.initData,'signed-data');assert(!('owner_id' in a.calls[0].body));
 a.switch();a.reply({preferences:null,daily:{date:null,places:[]},saved:[],categories:[]});await tick();assert(!a.html.includes('Ваши интересы'));
 a.open();a.reply({preferences:null,daily:{date:null,places:[]},saved:[],categories:[]});await tick();assert.match(a.html,/Ваши интересы/);assert(!a.html.includes('Парк «Алые паруса»'));
});
test('production escapes source text and never substitutes demo venues on backend errors',async()=>{
 const a=setup(true);a.open();a.reply({preferences:{city:{name:'<script>',timezone:'Europe/Moscow'},categories:['park']},daily:{date:'2026-11-09',timezone:'Europe/Moscow',places:[{id:'osm:node:1',name:'<img src=x>',category:'park'}]},saved:[],categories:[]});await tick();assert(!a.html.includes('<img src=x>'));assert(a.html.includes('&lt;img src=x&gt;'));
});
