/** Contract boundary. Production occurrence expansion belongs to the backend. */
(function (root) {
  var stores = Object.create(null), seq = 0, C = root.PaymentsCalendar, formatters = Object.create(null);
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fail(message) { throw new Error(message); }
  function validate(p) {
    if (!p.title || !p.title.trim() || p.title.length > 160) fail('Введите название до 160 символов');
    if (typeof p.description !== 'string' || p.description.length > 4000) fail('Описание: до 4000 символов');
    if (!C.valid(p.date) || p.date < '1900-01-01' || p.date > '2100-12-31' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) fail('Проверьте дату и время');
    try { new Intl.DateTimeFormat('en', {timeZone:p.timezone}).format(); } catch (_) { fail('Проверьте часовой пояс'); }
    if (!['normal','important'].includes(p.priority)) fail('Проверьте приоритет');
    var r = p.repeat;
    if (r && (!['day','week','month','year'].includes(r.unit) || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > 999 || !Array.isArray(r.weekdays) || r.weekdays.some(function (d) { return !Number.isInteger(d) || d < 1 || d > 7; }) || (r.weekdays.length && r.unit !== 'week'))) fail('Проверьте правило повторения');
    if (!Array.isArray(p.notifications) || p.notifications.length > 10 || p.notifications.some(function (n) { return !Number.isInteger(n) || n < 0 || n > 525600; })) fail('Укажите до 10 уведомлений от 0 до 525600 минут');
    return p;
  }
  function store(scope) { if (!scope) fail('Требуется пользователь'); return stores[scope] || (stores[scope] = { reminders:[], completed:Object.create(null), pending:Object.create(null) }); }
  function localParts(date, zone) {
    var formatter = formatters[zone] || (formatters[zone] = new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
    var parts = formatter.formatToParts(date), out = {};
    parts.forEach(function (p) { out[p.type] = p.value; });
    return out.year + '-' + out.month + '-' + out.day + 'T' + out.hour + ':' + out.minute;
  }
  // Mock only: keep the wall-clock time in the saved IANA zone through DST.
  // Ambiguous fall-back time uses the earlier instant; nonexistent time shifts forward.
  function instant(day, time, zone) {
    var target = Date.parse(day + 'T' + time + ':00Z'), candidates = [];
    // Sample offsets around the transition: supports 30-minute and 24-hour changes too.
    [-2, -1, 0, 1, 2].forEach(function (n) {
      var sample = target + n * 86400000;
      var offset = Date.parse(localParts(new Date(sample), zone) + ':00Z') - sample;
      var candidate = target - offset;
      if (!candidates.includes(candidate)) candidates.push(candidate);
    });
    var exact = candidates.filter(function (v) { return localParts(new Date(v), zone) === day + 'T' + time; });
    if (exact.length) return new Date(Math.min.apply(null, exact)).toISOString();
    // Spring-forward gap: use the first valid wall time after the requested time.
    candidates = candidates.filter(function (v) { return localParts(new Date(v), zone) > day + 'T' + time; });
    candidates.sort(function (a, b) { return localParts(new Date(a), zone).localeCompare(localParts(new Date(b), zone)); });
    return new Date(candidates[0]).toISOString();
  }
  function dates(p, until) {
    if (!p.repeat || !p.repeat.weekdays.length) return C.dates({date:p.date,repeat:p.repeat},until);
    var out=[], start=Date.parse(p.date+'T12:00:00Z'), anchor=new Date(start), monday=start-((anchor.getUTCDay()+6)%7)*86400000;
    for(var t=start;t<=Date.parse(until+'T12:00:00Z');t+=86400000) {
      var d=new Date(t), week=Math.floor((t-monday)/604800000);
      if(week%p.repeat.interval===0 && p.repeat.weekdays.includes((d.getUTCDay()+6)%7+1)) out.push(d.toISOString().slice(0,10));
    }
    return out;
  }
  function project(s, q) {
    var out=Object.keys(s.pending).filter(function(id){return !s.completed[id];}).map(function(id){
      var o=clone(s.pending[id]),display=localParts(new Date(o.due_at),q.timezone);
      o.date=display.slice(0,10);o.time=display.slice(11);return o;
    });
    s.reminders.forEach(function(p) {
      dates(p, new Date(Date.parse(q.until+'T12:00:00Z')+86400000).toISOString().slice(0,10)).forEach(function(day) {
        var id=p.id+':'+day, due=instant(day,p.time,p.timezone);
        if(s.completed[id] || s.pending[id] || (p.repeat && (p.skips||[]).some(function(span){return due>=span.from && (!span.to || due<span.to);}))) return;
        var display=localParts(new Date(due),q.timezone);
        if(display.slice(0,10)>q.until) return;
        // Always return overdue occurrences, even outside the requested calendar month.
        if(display.slice(0,10)<q.from && Date.parse(due)>Date.now()) return;
        out.push({id:id,reminder_id:p.id,date:display.slice(0,10),time:display.slice(11),due_at:due});
      });
    });
    return out.sort(function(a,b){return a.due_at.localeCompare(b.due_at)||a.id.localeCompare(b.id);});
  }
  function freeze(s) {
    var today=new Date().toISOString().slice(0,10);
    project(s,{from:'1900-01-01',until:today,timezone:'UTC'}).forEach(function(o){
      if(Date.parse(o.due_at)<=Date.now())s.pending[o.id]=clone(o);
    });
  }
  var mock={
    list:function(q){var s=store(q.scope);return {reminders:clone(s.reminders),occurrences:project(s,q)};},
    save:function(q){var s=store(q.scope),p=validate(q.reminder),old=s.reminders.find(function(x){return x.id===p.id;});if(p.id&&!old)fail('Напоминание уже удалено');if(old){freeze(s);Object.assign(old,clone(p));}else{s.reminders.push(Object.assign(clone(p),{id:'reminder-'+ ++seq,paused:false,skips:[]}));}return {ok:true};},
    remove:function(q){var s=store(q.scope);s.reminders=s.reminders.filter(function(p){return p.id!==q.id;});Object.keys(s.pending).forEach(function(id){if(s.pending[id].reminder_id===q.id)delete s.pending[id];});return {ok:true};},
    pause:function(q){var p=store(q.scope).reminders.find(function(x){return x.id===q.id;});if(!p)fail('Напоминание не найдено');if(p.paused!==q.paused){if(q.paused)p.skips.push({from:new Date().toISOString(),to:null});else p.skips[p.skips.length-1].to=new Date().toISOString();p.paused=q.paused;}return {ok:true};},
    complete:function(q){var s=store(q.scope);if(s.completed[q.occurrence_id])return {ok:true};var rows=project(s,{from:'1900-01-01',until:q.date,timezone:q.timezone}),o=rows.find(function(x){return x.id===q.occurrence_id;});if(!o)fail('Событие уже изменилось. Обновите список');var p=s.reminders.find(function(x){return x.id===o.reminder_id;});s.completed[o.id]=true;delete s.pending[o.id];if(!p.repeat){s.reminders=s.reminders.filter(function(x){return x.id!==p.id;});Object.keys(s.pending).forEach(function(id){if(s.pending[id].reminder_id===p.id)delete s.pending[id];});}return {ok:true};}
  };
  function adapter(){return root.APP_REMINDERS_ADAPTER || (root.Api.isDemo()?mock:root.RemindersRest);}
  root.RemindersApi={validate:validate,available:function(){return !!adapter();},isMock:function(){return !root.APP_REMINDERS_ADAPTER&&root.Api.isDemo();},invoke:function(method,payload){return Promise.resolve().then(function(){var a=adapter();if(!a||typeof a[method]!=='function')fail('Модуль ожидает подключения серверного API');return a[method](payload);});}};
})(window);
