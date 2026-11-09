const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
function setup(real=false,pages=[]){
 let searchArea={innerHTML:''},mainArea={hidden:false},catalogCalls=[],timers=new Map(),timerId=0;
 let scope='alice',html='',calls=[],handlers={},storage=new Map(),form=null,resolve;
 const root={Fmt:{escapeHtml:s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},State:{get:()=>({member:{id:scope}})},Api:{isDemo:()=>!real,url:'https://example.test/functions/v1/api'},Tg:{initData:()=> 'signed-data'},navigator:{},setInterval:()=>{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},open:()=>{},fetch:(url,q)=>{if(!q.body){catalogCalls.push(url);return Promise.resolve({ok:true,json:async()=>pages.shift()||({data:[],nextCursor:null})});}calls.push({url,body:JSON.parse(q.body)});return new Promise(r=>{resolve=r;});}};
 const document={hidden:false,addEventListener:(n,fn)=>handlers[n]=fn,querySelector:s=>s==='[data-leisure-search-results]'?searchArea:s==='[data-leisure-main]'?mainArea:s==='[data-leisure-settings]'?form:s==='[name=cityQuery]'?{value:'Москва'}:null,querySelectorAll:()=>[]};
 vm.runInNewContext(fs.readFileSync('src/leisure.js','utf8'),{window:root,document,Intl,Date,AbortSignal,Number,Array,Promise,JSON,Set,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 return {root,handlers,calls,catalogCalls,searchArea,mainArea,input:value=>handlers.input({target:{matches:()=>true,value}}),flush:()=>{for(const fn of timers.values())fn();timers.clear();},open:()=>root.Leisure.open(h=>{html=h;}),get html(){return html;},action:(n,attrs={})=>root.Leisure.action(n,{getAttribute:k=>attrs[k],href:attrs.href}),setForm:f=>{form=f;},switch:()=>{scope='bob';},reply:v=>resolve({ok:true,json:async()=>v})};
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

async function configuredDemo(){const a=setup();a.open();await tick();a.action('leisure-search');await tick();a.action('leisure-city',{'data-id':'524901'});a.setForm({elements:{exclude:{checked:true}}});a.handlers.submit({target:{matches:()=>true},preventDefault(){}});await tick();return a;}
test('mixed design switches deck/list/map locally without replacing daily recommendations',async()=>{
 const a=await configuredDemo();const first=a.html.match(/<h2>(Демо[^<]+)/)[1];
 assert.match(a.html,/leisure-card--hero/);assert.match(a.html,/Подборки для настроения/);
 a.action('leisure-next');assert.notEqual(a.html.match(/<h2>(Демо[^<]+)/)[1],first);
 a.action('leisure-view',{'data-view':'list'});assert(!a.html.includes('leisure-card--hero'));assert.equal((a.html.match(/<article /g)||[]).length,3);
 a.action('leisure-view',{'data-view':'map'});assert.match(a.html,/Расположение мест · схема без улиц/);assert.match(a.html,/Открыть карту города/);
 a.action('leisure-tab',{'data-tab':'today'});a.action('leisure-view',{'data-view':'cards'});a.action('leisure-slide',{'data-index':'0'});assert.equal(a.html.match(/<h2>(Демо[^<]+)/)[1],first);assert.equal(a.calls.length,0);
});
test('two tabs, catalog categories and preferences are available without legacy shortcuts',async()=>{
 const a=await configuredDemo();assert(!a.html.includes('data-tab="plans"'));assert(!a.html.includes('leisure-shortcuts'));assert.match(a.html,/Все категории/);assert.match(a.html,/Что хотите найти/);
 a.action('leisure-filter',{'data-id':'museum'});assert.match(a.html,/Пока нет подходящих мест/);
 a.action('leisure-collection',{'data-id':'outdoors'});assert.match(a.html,/На свежем воздухе/);assert(!a.html.includes('leisure-card--hero'));
 a.action('leisure-tab',{'data-tab':'settings'});assert.match(a.html,/<h1>Мои предпочтения/);assert(!a.html.includes('<nav class="leisure__tabs"'));assert.match(a.html,/Сбросить настройки/);assert.match(a.html,/ожидает поддержки backend/);
});

function snapshot(){return {preferences:{city_id:472045,city:{name:'Воронеж',timezone:'Europe/Moscow'},categories:['cafe','park']},daily:{date:'2026-11-09',timezone:'Europe/Moscow',places:[]},saved:[],categories:[]};}
test('real catalog pagination, deduplication, multi-place collections and cached tab switches',async()=>{
 const p={id:'osm:node:1',name:'Кофейня А',category:'cafe'};
 const a=setup(true,[{data:[p],nextCursor:'osm:node:1'},{data:[p,{id:'osm:node:2',name:'Кофейня Б',category:'cafe'},{id:'osm:node:3',name:'Кофейня В',category:'cafe'}],nextCursor:null}]);
 a.open();a.reply(snapshot());await tick();assert.equal(a.catalogCalls.length,2);assert.match(a.catalogCalls[1],/cursor=osm%3Anode%3A1/);
 a.input('кофе');assert.equal(a.searchArea.innerHTML,'');a.flush();assert.match(a.searchArea.innerHTML,/Найдено: 3/);assert.equal(a.mainArea.hidden,true);
 a.input('кино');a.input('кофе');a.flush();assert.match(a.searchArea.innerHTML,/Найдено: 3/);
 a.action('leisure-clear-search');assert.equal(a.mainArea.hidden,false);
 a.action('leisure-collection',{'data-id':'coffee'});assert.equal((a.html.match(/<article /g)||[]).length,3);
 a.action('leisure-tab',{'data-tab':'favorites'});assert.match(a.html,/Здесь будут любимые места/);assert.equal(a.catalogCalls.length,2);
 a.root.Leisure.close();a.open();await tick();assert.equal(a.catalogCalls.length,2);
});
test('catalog errors are visible and do not expose partial search success',async()=>{
 const a=setup(true,[{data:[{id:'osm:node:1',name:'Кофе',category:'cafe'}],nextCursor:'osm:node:1'},{data:[],nextCursor:'osm:node:1'}]);
 a.open();a.reply(snapshot());await tick();a.input('кофе');a.flush();assert.match(a.searchArea.innerHTML,/Ошибка страниц каталога/);assert(!a.searchArea.innerHTML.includes('Найдено:'));
});
test('search respects saved origin radius and favorites scope',async()=>{
 const a=setup(true,[{data:[{id:'osm:node:1',name:'Кофе рядом',category:'cafe',lat:51.66,lon:39.2},{id:'osm:node:2',name:'Кофе далеко',category:'cafe',lat:55.7,lon:37.6}],nextCursor:null}]);
 const v=snapshot();Object.assign(v.preferences,{origin_lat:51.66,origin_lon:39.2,radius_km:1});a.open();a.reply(v);await tick();a.input('кофе');a.flush();assert.match(a.searchArea.innerHTML,/Найдено: 1/);assert(!a.searchArea.innerHTML.includes('Кофе далеко'));
 a.action('leisure-tab',{'data-tab':'favorites'});a.input('кофе');a.flush();assert.match(a.searchArea.innerHTML,/Ничего не найдено/);
});
