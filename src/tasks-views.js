(function(root){
  function e(v){return root.Fmt.escapeHtml(String(v==null?'':v));}
  function button(action,label,id){return '<button class="payment-button" type="button" data-action="task-'+action+'"'+(id?' data-id="'+e(id)+'"':'')+'>'+e(label)+'</button>';}
  function options(items,value){return items.map(function(x){return '<option value="'+e(x[0])+'"'+(x[0]===value?' selected':'')+'>'+e(x[1])+'</option>';}).join('');}
  function lists(data,value,all){return options((all?[['all','Все задачи']]:[]).concat(data.lists.map(function(l){return [l.id,l.name];}),[['none','Без списка']]),value||'none');}
  function today(s, busy) {
    var title = '<div class="today-tasks__head"><h2 class="section__title">Задачи на сегодня</h2>';
    var m = root.TasksModel.todayPlan(s.data, root.Fmt.todayIso());
    var remaining = m.total - m.done;
    var html = title + (s.data ? '<span class="today-tasks__count">Осталось ' + remaining + ' из ' + m.total + '</span>' : '') + '</div>';
    if (!s.data) return html + '<p class="muted" role="status">' + (s.error ? 'Не удалось загрузить задачи' : 'Загружаем задачи…') + '</p>' + (s.error ? button('retry','Повторить') : '');
    html += '<div class="today-tasks__progress" role="progressbar" aria-label="Выполнение сегодняшнего плана" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + m.percent + '"><span style="width:' + m.percent + '%"></span></div>';
    if (s.error) html += '<p class="muted" role="status">Не удалось обновить задачи</p>' + button('retry','Повторить');
    if (m.total && !remaining) html += '<p class="today-tasks__empty" role="status">Все задачи на сегодня выполнены!</p>';
    else if (!m.rows.length) html += '<p class="today-tasks__empty" role="status">На сегодня всё свободно ✓</p>';
    html += '<div class="today-tasks__list">';
    m.rows.slice(0,4).forEach(function(t) {
      var late = t.due_on < root.Fmt.todayIso(), time = '';
      if (t.server && t.server.dueAt) {
        try { time = new Intl.DateTimeFormat('ru-RU', {hour:'2-digit',minute:'2-digit',timeZone:t.server.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}).format(new Date(t.server.dueAt)); } catch (_) {}
      }
      html += '<label class="today-tasks__row' + (late ? ' today-tasks__row--late' : '') + '"><input type="checkbox" data-task-complete="' + e(t.id) + '" aria-label="Выполнить: ' + e(t.title) + '"' + (busy ? ' disabled' : '') + '><span class="today-tasks__text"><span class="today-tasks__title">' + e(t.title) + '</span><small>' + (late ? 'Просрочена · ' + e(t.due_on) : 'Сегодня') + (time && time !== '00:00' ? ' · ' + e(time) : '') + '</small></span>' + (t.priority === 'important' ? '<span class="task-important" aria-label="Важная">★</span>' : '') + '</label>';
    });
    return html + '</div><button type="button" class="today-tasks__all" data-action="module-open" data-module="tasks">Все задачи' + (m.rows.length ? ' (' + m.rows.length + ')' : '') + ' →</button>';
  }
  function icon(name){var paths={back:'M15 18l-6-6 6-6',search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',more:'M12 5h.01 M12 12h.01 M12 19h.01',all:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',calendar:'M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16',done:'M20 6L9 17l-5-5',chevron:'M6 9l6 6 6-6',plus:'M12 4v16 M4 12h16',settings:'M4 7h16 M4 17h16 M9 3v8 M15 13v8',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[name]||paths.calendar)+'"/></svg>';}
  function control(action,label,content,id,extra){return '<button type="button" class="task-icon" data-action="task-'+action+'" aria-label="'+e(label)+'"'+(id?' data-id="'+e(id)+'"':'')+(extra||'')+'>'+content+'</button>';}
  function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function calendar(s){
    var now=root.Fmt.todayIso(),anchor=new Date((s.calendarAnchor||now)+'T12:00:00'),start=new Date(anchor);
    if(s.expanded)start.setDate(1);start.setDate(start.getDate()-(start.getDay()+6)%7);
    var count=s.expanded?Math.ceil(((new Date(anchor.getFullYear(),anchor.getMonth(),1).getDay()+6)%7+new Date(anchor.getFullYear(),anchor.getMonth()+1,0).getDate())/7)*7:7;
    var title=anchor.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(' г.','');
    var html='<div class="task-calendar" data-gesture-lock><div class="task-calendar__head">'+control('calendar-prev','Назад',icon('back'))+'<strong>'+e(title)+'</strong>'+control('calendar-next','Вперёд','<span class="task-next">'+icon('back')+'</span>')+control('calendar-toggle',s.expanded?'Свернуть до недели':'Раскрыть месяц',icon('calendar'),null,' aria-expanded="'+!!s.expanded+'" aria-controls="task-calendar-days"')+'</div><div class="task-calendar__week">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(function(d){return '<span>'+d+'</span>';}).join('')+'</div><div id="task-calendar-days" class="task-calendar__days">';
    for(var i=0;i<count;i++){var d=new Date(start);d.setDate(start.getDate()+i);var date=iso(d),tasks=s.data.tasks.filter(function(t){return !t.completed_at&&t.due_on===date&&(s.selected==='all'||(t.list_id||'none')===s.selected);}),dots='';
      if(tasks.some(function(t){return root.TasksModel.overdue(t,now);}))dots+='<i class="late"></i>';
      if(tasks.some(function(t){return t.priority==='important';}))dots+='<i class="important"></i>';
      if(tasks.some(function(t){return !root.TasksModel.overdue(t,now)&&t.priority!=='important';}))dots+='<i></i>';
      html+='<button type="button" data-action="task-date" data-id="'+date+'" aria-label="'+e(d.toLocaleDateString('ru-RU',{dateStyle:'full'}))+'" aria-pressed="'+(s.date===date)+'"'+(date===now?' aria-current="date"':'')+' class="task-day'+(s.date===date?' is-selected':'')+(d.getMonth()!==anchor.getMonth()?' is-outside':'')+'"><span>'+d.getDate()+'</span><span class="task-dots">'+dots+'</span></button>';
    }return html+'</div></div>';
  }
  function visibleRows(s){var now=root.Fmt.todayIso();return root.TasksModel.rows(s,now).filter(function(t){return (!s.date||t.due_on===s.date)&&(!s.filter||s.filter==='all'||s.filter==='done'||s.filter==='today'&&t.due_on===now||s.filter==='upcoming'&&t.due_on>now)&&(!s.query||(t.title+' '+(t.description||'')).toLocaleLowerCase().includes(s.query.toLocaleLowerCase()));});}
  function page(s){
    var now=root.Fmt.todayIso(),html='<section class="payments tasks"><header class="task-header">'+control('home','Назад к модулям',icon('back'))+'<h1>Трекер задач</h1>'+control('search','Поиск задач',icon('search'))+control('menu','Дополнительные действия',icon('more'))+'</header>';
    if(!root.TasksApi.available())return html+'<p role="status">Модуль ожидает подключения серверного API.</p></section>';
    if(root.TasksApi.isMock())html+='<p class="payments-notice">Демо: данные до перезагрузки. Уведомления недоступны.</p>';
    if(s.error)html+='<p role="alert">'+e(s.error)+'</p>'+button('retry','Повторить');
    if(s.loading)html+='<p role="status">Обновляем задачи…</p>';
    if(!s.data)return html+'</section>';
    if(s.searchOpen)html+='<label class="task-search">Поиск<input class="input" type="search" data-task-select="query" placeholder="Название или описание" value="'+e(s.query||'')+'"></label>';
    var tasks=s.data.tasks.filter(function(t){return s.selected==='all'||(t.list_id||'none')===s.selected;});
    html+='<div class="task-stats">'+[['all','Все','all'],['today','Сегодня','calendar'],['upcoming','Предстоящие','calendar'],['done','Выполнено','done']].map(function(f){var count=tasks.filter(function(t){return f[0]==='done'?!!t.completed_at:!t.completed_at&&(f[0]==='all'||f[0]==='today'&&t.due_on===now||f[0]==='upcoming'&&t.due_on>now);}).length;return '<button type="button" data-action="task-filter" data-id="'+f[0]+'" aria-pressed="'+((s.filter||'all')===f[0])+'">'+icon(f[2])+'<span>'+f[1]+'</span><strong>'+count+'</strong></button>';}).join('')+'</div>'+calendar(s);
    html+='<div class="task-list-picker"><label><span class="sr-only">Пользовательский список</span><select class="input" aria-label="Пользовательский список" data-task-select="selected">'+lists(s.data,s.selected,true)+'</select></label>'+control('menu','Управление списками',icon('settings'))+'</div>';
    if(s.completed)html+='<p class="task-hint">Выполненные задачи доступны для восстановления в течение 30 дней.</p>';
    var rows=visibleRows(s),groups=s.completed?[['done','Выполненные','done']]:[['late','Просроченные','clock'],['today','Сегодня','calendar'],['future','Предстоящие','calendar'],['none','Без срока','all']];
    if(!rows.length)html+='<div class="task-empty" role="status">'+icon('done')+'<strong>'+(s.date?'На выбранную дату задач нет':'Задач не найдено')+'</strong><p>Выберите другой день или создайте задачу.</p>'+(s.date?button('clear-date','Сбросить дату'):'')+'</div>';
    groups.forEach(function(g){var items=rows.filter(function(t){return s.completed||g[0]==='late'&&t.due_on&&t.due_on<now||g[0]==='today'&&t.due_on===now||g[0]==='future'&&t.due_on>now||g[0]==='none'&&!t.due_on;});if(!items.length)return;var closed=s.collapsed&&s.collapsed[g[0]];
      html+='<section class="task-group task-group--'+g[0]+'"><button type="button" class="task-group__head" data-action="task-group" data-id="'+g[0]+'" aria-expanded="'+!closed+'">'+icon(g[2])+'<strong>'+g[1]+'</strong><span>'+items.length+'</span><span class="task-caret'+(!closed?' is-open':'')+'">'+icon('chevron')+'</span></button><div'+(closed?' hidden':'')+'>';
      items.forEach(function(t){var late=root.TasksModel.overdue(t,now),manual=s.sort==='manual'&&!s.completed;html+='<article class="task-row'+(late?' task-row--overdue':t.priority==='important'?' task-row--important':'')+'" data-task-id="'+e(t.id)+'"'+(manual?' draggable="true" data-gesture-lock':'')+'>'+(!s.completed?'<label class="task-check"><input type="checkbox" aria-label="Выполнить: '+e(t.title)+'" data-task-complete="'+e(t.id)+'"></label>':'')+'<button type="button" class="task-row__body" data-action="task-'+(s.completed?'inspect':'edit')+'" data-id="'+e(t.id)+'"><strong>'+e(t.title)+'</strong><small>'+icon('calendar')+e(t.due_on===now?'Сегодня':t.due_on||'Без срока')+(t.repeat?' · ↻':'')+'</small></button>'+(t.priority==='important'?'<span class="task-priority">Важно</span>':'')+(manual?'<div class="task-reorder">'+button('up','↑',t.id)+button('down','↓',t.id)+'</div>':'')+'</article>';});html+='</div></section>';
    });return html+control('new','Создать задачу',icon('plus'),null,' data-task-fab')+'</section>';
  }
  function field(label,control){return '<label class="payment-field"><span>'+e(label)+'</span>'+control+'</label>';}
  function input(name,value,type,attrs){return '<input class="input" name="'+name+'" value="'+e(value)+'" type="'+(type||'text')+'" '+(attrs||'')+'>';}
  function form(t,s,key){t=t||{};var r=t.repeat||{};
    return '<form class="payment-form task-form" data-form="task" data-id="'+e(t.id||'')+'" data-key="'+e(key)+'"><h2>'+(t.id?'Изменить задачу':'Новая задача')+'</h2>'+field('Название',input('title',t.title||'','text','required maxlength="200"'))+field('Описание','<textarea class="input" name="description" maxlength="4000">'+e(t.description||'')+'</textarea>')+field('Список','<select class="input" name="list_id">'+lists(s.data,t.list_id||(s.selected==='all'?null:s.selected),false)+'</select>')+field('Срок выполнения',input('due_on',t.due_on||'','date','min="2000-01-01" max="2100-12-31"'))+(t.server&&t.server.seriesId?field('Применить изменения','<select class="input" name="edit_scope">'+options([['series','Эту и будущие задачи'],['instance','Только эту задачу']],'series')+'</select>'):'')+field('Приоритет','<select class="input" name="priority">'+options([['normal','Обычный'],['important','Важный']],t.priority||'normal')+'</select>')+field('Повторение','<select class="input" name="unit">'+options([['','Не повторять'],['day','Дни'],['week','Недели'],['month','Месяцы'],['year','Годы']],r.unit||'')+'</select>')+field('Каждые N периодов (1 — ежедневно / еженедельно / ежемесячно / ежегодно)',input('interval',r.interval||1,'number','min="1" max="365" step="1"'))+'<fieldset><legend>Дни недели (для недельного повторения)</legend><div class="task-weekdays">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(function(d,i){return '<label><input name="weekday" type="checkbox" value="'+(i+1)+'"'+((r.weekdays||[]).includes(i+1)?' checked':'')+'>'+d+'</label>';}).join('')+'</div></fieldset>'+field('Уведомления за N минут до начала дня срока (через запятую)',input('reminders',(t.reminders||[]).join(', '),'text','placeholder="1440, 60"'))+'<p>Интервал: дни/недели до 365, месяцы до 12, годы до 10. Уведомления — до 43200 минут. Для повторения и уведомлений нужен срок. Уведомления отправляет Telegram-бот в часовом поясе профиля.</p><p class="task-form-error" role="alert"></p><button class="btn btn--primary" type="submit">Сохранить</button>'+(t.id?button('delete','Удалить задачу',t.id):'')+button('cancel','Отмена')+'</form>';
  }
  function listForm(l){return '<form class="payment-form task-form" data-form="task-list" data-id="'+e(l&&l.id||'')+'"><h2>Список</h2>'+field('Название',input('name',l&&l.name||'','text','required maxlength="120"'))+'<p class="task-form-error" role="alert"></p><button class="btn btn--primary" type="submit">Сохранить</button>'+button('cancel','Отмена')+'</form>';}
  root.TasksViews={visibleRows:visibleRows,iso:iso,calendar:calendar,today:today,page:page,form:form,listForm:listForm};
})(window);

