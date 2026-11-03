/** REST 1.2 adapters. Server owns identity, recurrence expansion and notification delivery. */
(function(root) {
  var freq={day:'daily',week:'weekly',month:'monthly',year:'yearly'},unit={daily:'day',weekly:'week',monthly:'month',yearly:'year'};
  function fail(code,message,status,details){var e=new Error(message);e.code=code;e.status=status||0;e.details=details||{};throw e;}
  function zone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  function local(iso,tz){
    var parts={};new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).forEach(function(p){parts[p.type]=p.value;});
    return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
  }
  function utc(date,time,tz){
    var target=Date.parse(date+'T'+time+':00Z'),candidates=[];
    [-2,-1,0,1,2].forEach(function(day){var sample=target+day*86400000,p=local(new Date(sample).toISOString(),tz),offset=Date.parse(p.date+'T'+p.time+':00Z')-sample,candidate=target-offset;if(!candidates.includes(candidate))candidates.push(candidate);});
    function wall(value){var p=local(new Date(value).toISOString(),tz);return Date.parse(p.date+'T'+p.time+':00Z');}
    var exact=candidates.filter(function(v){return wall(v)===target;});
    if(exact.length)return new Date(Math.min.apply(null,exact)).toISOString();
    var forward=candidates.filter(function(v){return wall(v)>target;}).sort(function(a,b){return wall(a)-wall(b)||a-b;});
    if(!forward.length)fail('VALIDATION_ERROR','Проверьте дату, время и часовой пояс');
    return new Date(forward[0]).toISOString();
  }
  function same(a,b){
    if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
    var keys=Object.keys(a).filter(function(k){return a[k]!==undefined;}).sort(),other=Object.keys(b).filter(function(k){return b[k]!==undefined;}).sort();
    return keys.length===other.length&&keys.every(function(k,i){return k===other[i]&&same(a[k],b[k]);});
  }
  function rule(r,tz,old){
    if(!r)return null;
    var value={frequency:freq[r.unit],interval:r.interval,weekdays:r.unit==='week'&&r.weekdays.length?r.weekdays:null,timezone:tz};
    if(old&&same(value,{frequency:old.frequency,interval:old.interval,weekdays:old.weekdays||null,timezone:old.timezone||tz}))return old;
    return value;
  }
  function unrule(r){return r?{unit:unit[r.frequency],interval:r.interval,weekdays:r.weekdays||[]}:null;}
  function rules(values,old){return values.map(function(n){return (old||[]).find(function(r){return r.offsetMinutes===n;})||{offsetMinutes:n};});}
  function patch(body,old){if(old&&old.version){Object.keys(body).forEach(function(k){if(same(body[k],old[k]))delete body[k];});body.version=old.version;}return body;}
  function req(path,method,body,key,auth){
    var base=(root.Api.url||'').replace(/\/+$/,'');if(!base||base.indexOf('<project-ref>')!==-1)return Promise.reject(new root.Api.ApiError('no_config'));
    var headers={authorization:'tma '+(auth===undefined?root.Tg.initData():auth)};
    if(body!==undefined)headers['content-type']='application/json';if(key)headers['idempotency-key']=key;
    return root.fetch(base+'/v1'+path,{method:method||'GET',headers:headers,body:body===undefined?undefined:JSON.stringify(body)}).then(function(res){
      return res.text().then(function(text){var data;try{data=text?JSON.parse(text):null;}catch(_){fail('invalid_json','Сервер вернул некорректный ответ',res.status);}
        if(!res.ok||(data&&data.error)){
          var e=data&&data.error||{},messages={UNAUTHORIZED:'Сессия Telegram истекла. Откройте приложение заново',NOT_FOUND:'Запись уже удалена или недоступна',VALIDATION_ERROR:'Проверьте поля формы',SUBSCRIPTION_EXPIRED:'Срок доступа закончился',CONFLICT:'Данные изменились. Обновите экран и повторите'};
          fail(e.code||'network',messages[e.code]||'Не удалось выполнить запрос',res.status,e.details);
        }return data;
      });
    },function(){fail('network','Нет связи с сервером. Проверьте интернет и повторите');});
  }
  function pages(path,auth){var out=[],seen={};function next(cursor){return req(path+(path.includes('?')?'&':'?')+'limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''),'GET',undefined,undefined,auth).then(function(p){if(!p||!Array.isArray(p.data)||!p.pageInfo)fail('invalid_json','Некорректный ответ API');out.push.apply(out,p.data);if(!p.pageInfo.hasMore)return out;var c=p.pageInfo.nextCursor;if(!c||seen[c])fail('invalid_json','Ошибка пагинации');seen[c]=true;return next(c);});}return next();}
  function id(value){return encodeURIComponent(value);}
  function requireSnapshot(value){if(value.id&&(!value.server||!value.server.version))fail('VERSION_CONFLICT','Обновите экран и откройте форму заново');}
  function creationKey(key){if(!key)fail('VALIDATION_ERROR','Закройте форму и откройте её заново');return key;}
  function remove(path){return req(path,'DELETE').catch(function(e){if(e.status===404)return {deleted:true};throw e;});}
  function reminder(p){var tz=p.timezone||zone(),d=local(p.startsAt,tz);return {id:p.id,title:p.title,description:p.description||'',date:d.date,time:d.time,timezone:tz,priority:p.priority||'normal',repeat:unrule(p.recurrenceRule),notifications:(p.notificationRules||[]).map(function(x){return x.offsetMinutes;}),paused:p.status==='paused',server:p};}
  function reminderBody(p){
    requireSnapshot(p);var old=p.server||{},tz=p.timezone||zone(),before=old.startsAt?local(old.startsAt,old.timezone||tz):null;
    var starts=before&&before.date===p.date&&before.time===p.time&&old.timezone===tz?old.startsAt:utc(p.date,p.time,tz);
    return patch({title:p.title,description:p.description||null,startsAt:starts,timezone:tz,priority:p.priority,recurrenceRule:rule(p.repeat,tz,old.recurrenceRule),notificationRules:rules(p.notifications,old.notificationRules)},old);
  }
  function occurrence(o,tz){var d=local(o.scheduledAt,tz);return {id:o.id,reminder_id:o.reminderId,date:d.date,time:d.time,due_at:o.scheduledAt};}
  root.RemindersRest={
    list:function(q){
      var auth=root.Tg.initData(),tz=q.timezone||zone(),spans=[],cursor=q.from;
      while(cursor<=q.until){var end=new Date(Date.parse(cursor+'T00:00:00Z')+369*86400000).toISOString().slice(0,10);if(end>q.until)end=q.until;spans.push('/reminders?from='+cursor+'&to='+end+'&timezone='+id(tz));cursor=new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
      return Promise.all([pages('/reminders?view=templates',auth),Promise.all(spans.map(function(path){return pages(path,auth);}))]).then(function(all){
        var seen={},events=[];all[1].forEach(function(rows){rows.forEach(function(o){if(seen[o.id]||o.status==='completed')return;seen[o.id]=true;events.push(occurrence(o,tz));});});
        return {reminders:all[0].map(reminder),occurrences:events};
      });
    },
    save:function(q){var p=q.reminder;return req('/reminders'+(p.id?'/'+id(p.id):''),p.id?'PATCH':'POST',reminderBody(p),p.id?undefined:creationKey(q.idempotency_key));},
    remove:function(q){return remove('/reminders/'+id(q.id));},
    pause:function(q){return req('/reminders/'+id(q.id)+(q.paused?'/pause':'/resume'),'POST',{});},
    complete:function(q){return req('/reminder-occurrences/'+id(q.occurrence_id)+'/complete','POST',{},q.idempotency_key);}
  };
  function task(t){var tz=t.timezone||zone();return {id:t.id,title:t.title,description:t.description||'',list_id:t.listId||null,due_on:t.dueAt?local(t.dueAt,tz).date:null,priority:t.priority||'normal',repeat:unrule(t.recurrenceRule),reminders:(t.notificationRules||[]).map(function(x){return x.offsetMinutes;}),created_at:t.createdAt,completed_at:t.completedAt||null,delete_after:t.deleteAfter||null,server:t};}
  function taskBody(t){
    requireSnapshot(t);var old=t.server||{},tz=old.timezone||zone(),before=old.dueAt?local(old.dueAt,tz):null;
    var due=t.due_on?(before&&before.date===t.due_on?old.dueAt:utc(t.due_on,before?before.time:'00:00',tz)):null;
    return patch({title:t.title,description:t.description||null,listId:t.list_id||null,dueAt:due,timezone:tz,priority:t.priority,recurrenceRule:rule(t.repeat,tz,old.recurrenceRule),notificationRules:rules(t.reminders,old.notificationRules)},old);
  }
  function pref(p){var view=p.selectedTaskView||(p.selectedTaskListId?'list':'all');return {selected:view==='list'?p.selectedTaskListId:view,sort:p.taskSortMode||'due',orders:p.taskOrders||{}};}
  root.TasksRest={
    list:function(){var auth=root.Tg.initData();return Promise.all([pages('/task-lists',auth),pages('/tasks?status=active',auth),pages('/tasks/completed',auth),req('/module-preferences','GET',undefined,undefined,auth)]).then(function(a){return {lists:a[0].map(function(l){return {id:l.id,name:l.title,server:l};}),tasks:a[1].concat(a[2]).map(task),preferences:pref(a[3])};});},
    saveList:function(q){var body={title:q.name};if(q.id){if(!q.server||!q.server.version)fail('VERSION_CONFLICT','Обновите список и откройте форму заново');body.version=q.server.version;}return req('/task-lists'+(q.id?'/'+id(q.id):''),q.id?'PATCH':'POST',body,q.id?undefined:creationKey(q.idempotency_key));},
    removeList:function(q){return remove('/task-lists/'+id(q.id));},
    save:function(q){var t=q.task,body=taskBody(t),scope=t.server&&t.server.seriesId?(q.edit_scope||'series'):'instance';if(t.server&&t.server.seriesId&&scope==='instance'&&body.recurrenceRule!==undefined)fail('VALIDATION_ERROR','Для изменения повторения выберите «Эту и будущие задачи»');return req('/tasks'+(t.id?'/'+id(t.id)+'?scope='+scope:''),t.id?'PATCH':'POST',body,t.id?undefined:creationKey(q.idempotency_key));},
    complete:function(q){return req('/tasks/'+id(q.id)+'/complete','POST',{},q.idempotency_key);},
    restore:function(q){return req('/tasks/'+id(q.id)+'/restore','POST',{},q.idempotency_key);},
    remove:function(q){return remove('/tasks/'+id(q.id)+'?scope=instance');},
    preferences:function(q){var body={};if(q.selected!==undefined){body.selectedTaskView=['all','none'].includes(q.selected)?q.selected:'list';body.selectedTaskListId=body.selectedTaskView==='list'?q.selected:null;}if(q.sort!==undefined)body.taskSortMode=q.sort;if(q.order){if(q.order.length>200)fail('VALIDATION_ERROR','Ручной порядок поддерживает до 200 задач в представлении');body.taskOrders={};body.taskOrders[q.view]=q.order;}return req('/module-preferences','PATCH',body);}
  };
})(window);
