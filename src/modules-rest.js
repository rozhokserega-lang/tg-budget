/** REST v1.1 adapters for personal modules. Demo continues to use its own in-memory mocks. */
(function(root) {
  var freq={day:'daily',week:'weekly',month:'monthly',year:'yearly'}, unit={daily:'day',weekly:'week',monthly:'month',yearly:'year'};
  function error(message) { throw new Error(message); }
  function zone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  function local(iso,tz) {
    var f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    var parts={};f.formatToParts(new Date(iso)).forEach(function(p){parts[p.type]=p.value;});
    return {date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};
  }
  function utc(date,time,tz) {
    // Iteratively convert local wall-clock to UTC without assuming the device's timezone.
    var target=Date.parse(date+'T'+time+':00Z'),guess=target;
    for(var i=0;i<4;i++){var p=local(new Date(guess).toISOString(),tz);var wall=Date.parse(p.date+'T'+p.time+':00Z');guess+=target-wall;if(wall===target)break;}
    return new Date(guess).toISOString();
  }
  function rule(r,tz){return r?{frequency:freq[r.unit],interval:r.interval,weekdays:r.unit==='week'&&r.weekdays.length?r.weekdays:undefined,timezone:tz}:null;}
  function unrule(r){return r?{unit:unit[r.frequency],interval:r.interval,weekdays:r.weekdays||[]}:null;}
  function req(path,method,body,key,auth){
    var base=(root.Api.url||'').replace(/\/+$/,'');
    if(!base||base.indexOf('<project-ref>')!==-1)return Promise.reject(new root.Api.ApiError('no_config'));
    var headers={authorization:'tma '+(auth||root.Tg.initData())};
    if(body!==undefined)headers['content-type']='application/json';
    if(key)headers['idempotency-key']=key;
    return root.fetch(base+'/v1'+path,{method:method||'GET',headers:headers,body:body===undefined?undefined:JSON.stringify(body)}).then(function(res){
      return res.text().then(function(t){var data;try{data=t?JSON.parse(t):null;}catch(_){error('Сервер вернул некорректный ответ');}
        if(!res.ok||(data&&data.error)){var e=data&&data.error||{};error(e.message||({'UNAUTHORIZED':'Сессия Telegram истекла','NOT_FOUND':'Запись не найдена','VERSION_CONFLICT':'Данные изменились. Обновите экран','VALIDATION_ERROR':'Проверьте поля формы'}[e.code])||'Не удалось выполнить запрос');}
        return data;
      });
    });
  }
  function pages(path,auth){var out=[],seen={};function next(cursor){return req(path+(path.includes('?')?'&':'?')+'limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''),'GET',undefined,undefined,auth).then(function(p){if(!p||!Array.isArray(p.data)||!p.pageInfo)error('Некорректный ответ API');out.push.apply(out,p.data);if(!p.pageInfo.hasMore)return out;var c=p.pageInfo.nextCursor;if(!c||seen[c])error('Ошибка пагинации');seen[c]=true;return next(c);});}return next();}
  function id(x){return encodeURIComponent(x);}
  function reminder(p){var tz=p.timezone||zone(),d=local(p.startsAt,tz);return {id:p.id,title:p.title,description:p.description||'',date:d.date,time:d.time,timezone:tz,priority:p.priority||'normal',repeat:unrule(p.recurrenceRule),notifications:(p.notificationRules||[]).map(function(x){return x.offsetMinutes;}),paused:p.status==='paused',server:p};}
  function reminderBody(p){var tz=p.timezone||zone(),body={title:p.title,description:p.description||null,startsAt:utc(p.date,p.time,tz),timezone:tz,priority:p.priority,recurrenceRule:rule(p.repeat,tz),notificationRules:p.notifications.map(function(n){return {offsetMinutes:n};})};if(p.server&&p.server.version)body.version=p.server.version;return body;}
  function occurrence(o,tz){var d=local(o.scheduledAt,tz);return {id:o.id,reminder_id:o.reminderId,date:d.date,time:d.time,due_at:o.scheduledAt};}
  root.RemindersRest={
    list:function(q){var auth=root.Tg.initData(),tz=q.timezone||zone(),from=q.from,until=q.until;
      // API restricts a single range to 370 days; split without dropping events.
      var spans=[],cursor=from;while(cursor<=until){var end=new Date(Date.parse(cursor+'T00:00:00Z')+369*86400000).toISOString().slice(0,10);if(end>until)end=until;spans.push('/reminders?from='+cursor+'&to='+end);cursor=new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}
      return Promise.all(spans.map(function(s){return pages(s,auth);})).then(function(all){var occurrences=[],defs={},seen={};all.forEach(function(rows){rows.forEach(function(o){if(seen[o.id])return;seen[o.id]=true;if(o.status==='completed')return;occurrences.push(occurrence(o,tz));if(o.reminder&&o.reminder.id)defs[o.reminder.id]=o.reminder;});});return {reminders:Object.keys(defs).map(function(k){return reminder(defs[k]);}),occurrences:occurrences};});
    },
    save:function(q){var p=q.reminder;return req('/reminders'+(p.id?'/'+id(p.id):''),p.id?'PATCH':'POST',reminderBody(p));},
    remove:function(q){return req('/reminders/'+id(q.id),'DELETE');},
    pause:function(q){return req('/reminders/'+id(q.id)+(q.paused?'/pause':'/resume'),'POST',{});},
    complete:function(q){return req('/reminder-occurrences/'+id(q.occurrence_id)+'/complete','POST',{},q.idempotency_key);}
  };
  function task(t){var tz=t.timezone||zone();return {id:t.id,title:t.title,description:t.description||'',list_id:t.listId||null,due_on:t.dueAt?local(t.dueAt,tz).date:null,priority:t.priority||'normal',repeat:unrule(t.recurrenceRule),reminders:(t.notificationRules||[]).map(function(x){return x.offsetMinutes;}),created_at:t.createdAt,completed_at:t.completedAt||null,delete_after:t.deleteAfter||null,server:t};}
  function taskBody(t){var tz=t.server&&t.server.timezone||zone(),b={title:t.title,description:t.description||null,listId:t.list_id||null,dueAt:t.due_on?utc(t.due_on,'00:00',tz):null,timezone:tz,priority:t.priority,recurrenceRule:rule(t.repeat,tz),notificationRules:t.reminders.map(function(n){return {offsetMinutes:n};})};if(t.server&&t.server.version)b.version=t.server.version;return b;}
  function pref(p){return {selected:p.selectedTaskListId||'all',sort:p.taskSortMode||'due',orders:{}};}
  root.TasksRest={
    list:function(){var auth=root.Tg.initData();return Promise.all([req('/task-lists','GET',undefined,undefined,auth),pages('/tasks?status=active',auth),pages('/tasks/completed',auth),req('/module-preferences','GET',undefined,undefined,auth)]).then(function(a){return {lists:(a[0].data||[]).map(function(l){return {id:l.id,name:l.title,server:l};}),tasks:a[1].concat(a[2]).map(task),preferences:pref(a[3])};});},
    saveList:function(q){return req('/task-lists'+(q.id?'/'+id(q.id):''),q.id?'PATCH':'POST',{title:q.name});},
    removeList:function(q){return req('/task-lists/'+id(q.id),'DELETE');},
    save:function(q){return req('/tasks'+(q.task.id?'/'+id(q.task.id)+'?scope=instance':''),q.task.id?'PATCH':'POST',taskBody(q.task),q.idempotency_key);},
    complete:function(q){return req('/tasks/'+id(q.id)+'/complete','POST',{},q.idempotency_key);},
    restore:function(q){return req('/tasks/'+id(q.id)+'/restore','POST',{},q.idempotency_key);},
    remove:function(q){return req('/tasks/'+id(q.id)+'?scope=instance','DELETE');},
    preferences:function(q){var b={};if(q.selected!==undefined)b.selectedTaskListId=q.selected==='all'||q.selected==='none'?null:q.selected;if(q.sort!==undefined)b.taskSortMode=q.sort;
      if(q.order) return Promise.reject(new Error('Ручной порядок для общего списка не поддерживается серверным контрактом'));
      return req('/module-preferences','PATCH',b);
    }
  };
})(window);
