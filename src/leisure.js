(function(root){
  'use strict';
  var data=null,tab='today',draft=null,results=[],busy=false,error='',paint=null,scope='',generation=0,loadedAt=0;
  var labels={cafe:['Кафе и кофейни','☕'],restaurant:['Рестораны','🍽'],park:['Парки и скверы','🌳'],museum:['Музеи','🏛'],theatre:['Театры','🎭'],cinema:['Кинотеатры','🎬'],sight:['Достопримечательности','🏰'],walk:['Прогулки и пространства','🚶'],active:['Активный отдых','🚲']};
  function esc(s){return root.Fmt.escapeHtml(String(s==null?'':s));}
  function currentScope(){var m=root.State.get().member;return (root.Api.isDemo()?'demo:':'real:')+(m?m.id:'none');}
  function day(tz,now){return new Intl.DateTimeFormat('en-CA',{timeZone:tz||'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now||new Date());}
  function url(p){var u='https://yandex.ru/maps/?text='+encodeURIComponent([p.name,p.city,p.address].filter(Boolean).join(', '));if(Number.isFinite(p.lon)&&Number.isFinite(p.lat))u+='&sll='+encodeURIComponent(p.lon+','+p.lat);return u;}
  function endpoint(){return root.APP_LEISURE_API_URL||(root.Api.url||'').replace(/\/api\/?$/,'/leisure');}
  function request(action,payload){
    if(root.Api.isDemo())return Promise.resolve().then(function(){return demo(action,payload||{});});
    var base=endpoint();if(!base||base===root.Api.url)return Promise.reject(new Error('Модуль ещё не подключён к серверу.'));
    return root.fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({action:action,initData:root.Tg.initData()},payload||{})),signal:AbortSignal.timeout(15000)}).then(function(r){return r.json().then(function(v){if(!r.ok||v.error)throw new Error(v.error==='UNAUTHORIZED'?'Откройте приложение заново в Telegram.':v.error==='VALIDATION_ERROR'?'Проверьте настройки.':'Сервис отдыха временно недоступен. Попробуйте позже.');return v;});});
  }
  function notify(){if(paint&&scope===currentScope())paint(render());}
  function apply(v){data=v;(v.categories||[]).forEach(function(c){labels[c.id]=[c.title,c.symbol||"◇"];});loadedAt=Date.now();draft=null;}
  function run(action,payload){
    if(busy)return;var seq=++generation,account=scope;busy=true;error='';notify();
    return request(action,payload).then(function(v){if(seq!==generation||account!==currentScope())return;if(action==='cities')results=v.cities;else apply(v);},function(e){if(seq===generation&&account===currentScope())error=e.message||'Не удалось загрузить данные.';}).finally(function(){if(seq===generation&&account===currentScope()){busy=false;notify();}});
  }
  function resetDraft(){var p=data&&data.preferences;draft=p?JSON.parse(JSON.stringify(p)):{city_id:null,city:null,categories:['park','walk','cafe'],exclude_visited:true,radius_km:null,origin_lat:null,origin_lon:null};results=[];}
  function art(p){var l=labels[p.category]||['Место','◇'];return '<div class="leisure-card__art leisure-art--'+esc(p.category)+'" aria-hidden="true"><span>'+l[1]+'</span><i></i><b></b></div>';}
  function card(p){
    var s=(data.saved||[]).find(function(x){return x.place_id===p.id;})||{},l=labels[p.category]||['Место','◇'];
    var city=p.city||(data.preferences&&data.preferences.city&&data.preferences.city.name)||'';
    var target=url(Object.assign({},p,{city:city}));
    return '<article class="leisure-card">'+art(p)+'<div class="leisure-card__content"><span class="leisure-card__tag">'+esc(l[0])+'</span><h2>'+esc(p.name)+'</h2><p class="leisure-card__meta">'+esc(city)+(p.address?' · '+esc(p.address):'')+(Number.isFinite(p.distanceKm)?' · '+p.distanceKm.toFixed(1)+' км':'')+'</p>'+(p.description?'<p>'+esc(p.description)+'</p>':'')+(s.visited?'<p>✓ Уже посещено</p>':'')+'<div class="leisure-card__actions"><a class="leisure-card__link" data-action="leisure-map" href="'+esc(target)+'" target="_blank" rel="noopener noreferrer">Подробнее в Яндекс Картах ↗</a><button type="button" data-action="leisure-fav" data-id="'+esc(p.id)+'" aria-pressed="'+!!s.favorite+'" aria-label="'+(s.favorite?'Удалить из избранного':'Добавить в избранное')+'" '+(busy?'disabled':'')+'>'+(s.favorite?'♥':'♡')+'</button></div><details><summary>Запланировать посещение</summary><label>Дата <input type="date" data-plan-for="'+esc(p.id)+'" value="'+esc(s.planned_on||'')+'"></label><div class="leisure-card__tools"><button data-action="leisure-plan" data-id="'+esc(p.id)+'">Сохранить дату</button>'+(s.planned_on?'<button data-action="leisure-unplan" data-id="'+esc(p.id)+'">Убрать план</button>':'')+'<button data-action="leisure-visited" data-id="'+esc(p.id)+'">'+(s.visited?'Не посещал':'Уже посетил')+'</button></div></details>'+(s.planned_on?'<p class="leisure-card__date">План: '+esc(s.planned_on)+'</p>':'')+'</div></article>';
  }
  function settings(){
    if(!draft)resetDraft();
    return '<form data-leisure-settings class="leisure__settings"><h2>Ваши интересы</h2><label>Город России<input name="cityQuery" maxlength="80" placeholder="Например, Казань" value="'+esc(draft.city&&draft.city.name||'')+'" autocomplete="off"></label><button type="button" data-action="leisure-search" '+(busy?'disabled':'')+'>Найти город</button><div class="leisure__cities">'+results.map(function(c){return '<button type="button" data-action="leisure-city" data-id="'+c.id+'">'+esc(c.name)+' <small>'+esc(c.region)+' · '+esc(c.timezone)+'</small></button>';}).join('')+'</div><p>'+(draft.city?'Выбран: '+esc(draft.city.name)+' · '+esc(draft.city.region):'Выберите город из результатов поиска.')+'</p><fieldset><legend>Что вам интересно</legend><div class="leisure__interests">'+Object.keys(labels).map(function(k){return '<button type="button" data-action="leisure-interest" data-interest="'+k+'" aria-pressed="'+(draft.categories.indexOf(k)!==-1)+'">'+labels[k][1]+' '+esc(labels[k][0])+'</button>';}).join('')+'</div></fieldset><label class="leisure__check"><input type="checkbox" name="exclude" '+(draft.exclude_visited?'checked':'')+'> Исключать посещённые</label><button type="button" data-action="leisure-geo">Использовать мою геопозицию</button><p class="leisure__notice">Только по вашему нажатию. Точка сохранится в личных настройках на сервере для фильтра по радиусу.</p>'+(draft.origin_lat!==null?'<label>Радиус от сохранённой точки<select name="radius"><option value="">Весь каталог</option>'+[1,3,5,10,20,30].map(function(r){return '<option value="'+r+'" '+(draft.radius_km===r?'selected':'')+'>'+r+' км</option>';}).join('')+'</select></label><button type="button" data-action="leisure-clear-geo">Удалить геопозицию</button>':'<p class="leisure__notice">Без геопозиции — места в городе и рядом, до 30 км от центра.</p>')+'<button class="leisure__primary" type="submit" '+(busy?'disabled':'')+'>Сохранить настройки</button><p class="leisure__notice">После изменения настроек подборка обновится.</p></form>';
  }
  function render(){
    var p=data&&data.preferences,body='';
    if(!data&&busy)body='<div class="leisure__skeleton" role="status" aria-label="Загрузка рекомендаций"></div>';
    else if(data&&(tab==='settings'||!p))body=settings();
    else if(data){
      var list=tab==='favorites'?data.saved.filter(function(s){return s.favorite&&s.place;}).map(function(s){return s.place;}):tab==='plans'?data.saved.filter(function(s){return s.planned_on&&s.place;}).sort(function(a,b){return a.planned_on.localeCompare(b.planned_on);}).map(function(s){return s.place;}):data.daily.places;
      body='<div class="leisure__subhead"><h2>'+(tab==='today'?'Ваши идеи на сегодня':tab==='favorites'?'Любимые места':'Планы на отдых')+'</h2><p>'+esc(p.city.name)+' · '+esc(data.daily.date||'')+'</p></div>'+(tab==='today'?'<div class="leisure__interests">'+p.categories.map(function(k){return '<span>'+esc((labels[k]||[k])[0])+'</span>';}).join('')+'</div>':'')+'<div class="leisure__cards">'+(list.length?list.map(card).join(''):'<div class="leisure__empty"><h2>'+(tab==='today'?'Подборка пока пуста':tab==='favorites'?'Сохраните понравившееся место':'Отдых начинается с плана')+'</h2><p>'+(tab==='today'?(data.daily.importedAt?'Попробуйте другие интересы или увеличьте радиус.':'Каталог этого города ещё готовится. Места появятся после импорта OSM.'):'Откройте «Сегодня» и выберите место для будущего посещения.')+'</p></div>')+'</div>'+(tab==='today'&&list.length>0&&list.length<3?'<p class="leisure__notice">Найдено '+list.length+' мест. Других подходящих мест в каталоге пока нет.</p>':'')+(tab==='today'&&data.daily.importedAt?'<p class="leisure__notice">Каталог обновлён: '+esc(new Date(data.daily.importedAt).toLocaleDateString('ru-RU'))+'. Актуальность часов работы уточняйте перед визитом.</p>':'');
    }
    return '<section class="leisure" aria-busy="'+busy+'"><header class="leisure__header"><button type="button" data-action="modules-home" class="leisure__back">← Модули</button><span class="leisure__eyebrow">Время для себя</span><h1>Развлечения и отдых</h1><p>Новые впечатления каждый день</p></header>'+(root.Api.isDemo()?'<p class="leisure__demo">Демо: учебные места, настройки хранятся на этом устройстве.</p>':'')+'<nav class="leisure__tabs" aria-label="Разделы отдыха">'+[['today','Сегодня'],['favorites','Избранное'],['plans','Планы'],['settings','Настройки']].map(function(t){return '<button type="button" data-action="leisure-tab" data-tab="'+t[0]+'" aria-pressed="'+(tab===t[0])+'">'+t[1]+'</button>';}).join('')+'</nav>'+(error?'<div class="leisure__error" role="alert">'+esc(error)+' <button data-action="leisure-retry">Повторить загрузку</button></div>':'')+body+'<footer class="leisure__notice">Поиск Яндекс Карт может показать несколько совпадений.<br>Данные: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>. Города: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames · CC BY 4.0</a>. '+(!root.Api.isDemo()&&p?'<br><a target="_blank" rel="noopener noreferrer" href="'+esc(endpoint()+'/catalog?city_id='+p.city_id)+'">Открытые данные каталога · ODbL</a>':'')+'</footer></section>';
  }
  function capture(){var f=document.querySelector('[data-leisure-settings]');if(!f||!draft)return;draft.exclude_visited=f.elements.exclude.checked;if(f.elements.radius)draft.radius_km=Number(f.elements.radius.value)||null;}
  function action(name,node){
    if(name==='leisure-map'){var link=node.href;if(root.Telegram&&root.Telegram.WebApp&&root.Telegram.WebApp.openLink){root.Telegram.WebApp.openLink(link);}else root.open(link,'_blank','noopener,noreferrer');return;}
    if(busy)return;
    capture();
    var id=node.getAttribute('data-id'),s=data&&(data.saved||[]).find(function(x){return x.place_id===id;})||{};
    if(name==='leisure-tab'){tab=node.getAttribute('data-tab');if(tab==='settings')resetDraft();error='';notify();}
    else if(name==='leisure-retry')run('load');
    else if(name==='leisure-search'){var q=document.querySelector('[name=cityQuery]').value.trim();if(q.length<2){error='Введите хотя бы две буквы.';notify();return;}run('cities',{query:q}).then(function(){if(!results.length&&!error){error='Город не найден. Попробуйте другое название.';notify();}});}
    else if(name==='leisure-city'){draft.city=results.find(function(c){return String(c.id)===id;});draft.city_id=draft.city.id;draft.origin_lat=null;draft.origin_lon=null;draft.radius_km=null;results=[];notify();}
    else if(name==='leisure-interest'){var c=node.getAttribute('data-interest');draft.categories=draft.categories.includes(c)?draft.categories.filter(function(v){return v!==c;}):draft.categories.concat(c);notify();}
    else if(name==='leisure-fav')run('saved',{id:id,favorite:!s.favorite});
    else if(name==='leisure-visited')run('saved',{id:id,visited:!s.visited});
    else if(name==='leisure-unplan')run('saved',{id:id,planned_on:null});
    else if(name==='leisure-plan'){var input=Array.from(document.querySelectorAll('[data-plan-for]')).find(function(n){return n.getAttribute('data-plan-for')===id;});if(input&&input.value)run('saved',{id:id,planned_on:input.value});else{error='Выберите дату посещения.';notify();}}
    else if(name==='leisure-clear-geo'){draft.origin_lat=null;draft.origin_lon=null;draft.radius_km=null;notify();}
    else if(name==='leisure-geo'){
      if(!root.navigator.geolocation){error='Геолокация недоступна. Можно выбрать только город.';notify();return;}
      var seq=++generation,account=scope;busy=true;notify();root.navigator.geolocation.getCurrentPosition(function(pos){if(seq!==generation||account!==currentScope())return;draft.origin_lat=pos.coords.latitude;draft.origin_lon=pos.coords.longitude;draft.radius_km=5;busy=false;notify();},function(){if(seq!==generation||account!==currentScope())return;busy=false;error='Не удалось получить геопозицию. Выбор города продолжает работать.';notify();},{timeout:10000,maximumAge:300000,enableHighAccuracy:false});
    }
  }
  function open(callback){
    paint=callback;var account=currentScope();if(account!==scope){++generation;scope=account;data=null;draft=null;busy=false;error='';loadedAt=0;results=[];}
    tab='today';if(!data||Date.now()-loadedAt>300000||data.daily.date&&day(data.daily.timezone)!==data.daily.date)run('load');else notify();
  }
  document.addEventListener('submit',function(e){if(!e.target.matches('[data-leisure-settings]'))return;e.preventDefault();capture();if(busy)return;if(!draft.city_id||!draft.categories.length){error='Выберите город и хотя бы один интерес.';notify();return;}tab='today';run('preferences',{preferences:draft});});
  document.addEventListener('click',function(e){if(e.target.closest('[data-action="leisure-map"]'))e.preventDefault();});
  function checkDay(){if(!data||!paint||document.hidden||scope!==currentScope())return;if(data.daily.date&&data.daily.date!==day(data.daily.timezone))run('load');}
  document.addEventListener('visibilitychange',checkDay);root.setInterval(checkDay,60000);
  // Demo is explicitly isolated from production, including its storage namespace.
  function demo(action,payload){
    var k='tg-budget-leisure-demo.'+scope,d;try{d=JSON.parse(root.localStorage.getItem(k));}catch(_){}
    if(!d)d={preferences:null,saved:[],history:{}};
    var cityList=[{id:524901,name:'Москва',region:'Московский регион',timezone:'Europe/Moscow'},{id:472045,name:'Воронеж',region:'Воронежская область',timezone:'Europe/Moscow'},{id:554234,name:'Калининград',region:'Калининградская область',timezone:'Europe/Kaliningrad'},{id:2023469,name:'Иркутск',region:'Иркутская область',timezone:'Asia/Irkutsk'}];
    if(action==='cities')return {cities:cityList.filter(function(c){return c.name.toLowerCase().includes(payload.query.toLowerCase());})};
    if(action==='preferences'){d.preferences=JSON.parse(JSON.stringify(payload.preferences));d.preferences.city=cityList.find(function(c){return c.id===d.preferences.city_id;});d.history={};}
    var p=d.preferences,dt=day(p&&p.city.timezone),all=Object.keys(labels).flatMap(function(c,i){return [0,1,2,3].map(function(n){return {id:'osm:node:'+(900000000000+i*4+n),name:'Демо · '+labels[c][0]+' '+(n+1),category:c,city:p&&p.city.name,description:'Учебный пример для проверки интерфейса.',lat:55.75,lon:37.61};});});
    if(action==='saved'){var s=d.saved.find(function(x){return x.place_id===payload.id;});if(!s){s={place_id:payload.id,place:all.find(function(x){return x.id===payload.id;})};d.saved.push(s);}['favorite','visited','planned_on'].forEach(function(k){if(payload[k]!==undefined)s[k]=payload[k];});}
    var places=[];if(p){if(!d.history[dt]){var seed=Number(dt.replace(/-/g,'')),pool=all.filter(function(x){return p.categories.includes(x.category)&&(!p.exclude_visited||!d.saved.some(function(s){return s.place_id===x.id&&s.visited;}));});var chosen=[],used=[];pool.sort(function(a,b){return ((Number(a.id.split(':')[2])+seed)%37)-((Number(b.id.split(':')[2])+seed)%37);});pool.forEach(function(x){if(chosen.length<3&&!used.includes(x.category)){chosen.push(x.id);used.push(x.category);}});pool.forEach(function(x){if(chosen.length<3&&!chosen.includes(x.id))chosen.push(x.id);});d.history[dt]=chosen;}places=d.history[dt].map(function(id){return all.find(function(x){return x.id===id;});}).filter(Boolean);}
    try{root.localStorage.setItem(k,JSON.stringify(d));}catch(_){}
    return {preferences:p,saved:d.saved,daily:{date:dt,timezone:p&&p.city.timezone,importedAt:new Date().toISOString(),places:places},categories:Object.keys(labels).map(function(k){return {id:k,title:labels[k][0],symbol:labels[k][1]};})};
  }
  root.Leisure={open:open,action:action,day:day,url:url,close:function(){paint=null;++generation;busy=false;}};
})(window);
