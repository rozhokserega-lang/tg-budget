(function(root){
  var C=root.PaymentsCalendar;
  function e(x){return root.Fmt.escapeHtml(String(x==null?'':x));}
  function b(action,label,attrs){return '<button type="button" class="payment-button" data-action="reminder-'+action+'" '+(attrs||'')+'>'+e(label)+'</button>';}
  function attrs(id){return 'data-id="'+e(id)+'"';}
  function field(label,control){return '<label class="payment-field"><span>'+e(label)+'</span>'+control+'</label>';}
  function input(name,value,type,extra){return '<input class="input" name="'+name+'" value="'+e(value)+'" type="'+(type||'text')+'" '+(extra||'')+'>';}
  function options(items,value){return items.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===value?' selected':'')+'>'+x[1]+'</option>';}).join('');}
  function icon(name){
    var paths={back:'M15 18l-6-6 6-6',next:'M9 6l6 6-6 6',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',check:'M5 12l4 4L19 6',plus:'M12 5v14M5 12h14',pause:'M9 5v14M15 5v14'};
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
  }
  function control(action,label,body,extra){return '<button type="button" class="reminder-icon" data-action="reminder-'+action+'" aria-label="'+e(label)+'" '+(extra||'')+'>'+body+'</button>';}
  function repeatLabel(p){
    if(!p.repeat)return 'Разовое';
    var r=p.repeat,n=r.interval,labels={day:['Каждый день','дн.'],week:['Каждую неделю','нед.'],month:['Каждый месяц','мес.'],year:['Каждый год','г.']};
    var label=n===1?labels[r.unit][0]:'Каждые '+n+' '+labels[r.unit][1];
    if(r.unit==='week'&&r.weekdays&&r.weekdays.length)label+=' · '+r.weekdays.map(function(d){return ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][d-1];}).join(', ');
    return label;
  }
  function row(o,p){
    var late=!p.paused&&Date.parse(o.due_at)<Date.now();
    return '<li class="reminder-event'+(late?' is-overdue':'')+(p.paused?' is-paused':'')+(p.priority==='important'?' reminder-important':'')+'"><span class="reminder-point" aria-hidden="true"></span><div class="reminder-event__card"><button type="button" class="reminder-event__open" data-action="reminder-edit" '+attrs(p.id)+'><time datetime="'+e(o.due_at)+'">'+e(o.time)+'</time><span class="reminder-event__body"><span class="reminder-event__icon">'+icon(p.paused?'pause':'bell')+'</span><span class="reminder-event__text"><strong>'+e(p.title)+'</strong><small>'+e(repeatLabel(p))+'</small>'+(p.priority==='important'?'<small class="reminder-badge">Важное</small>':'')+(late?'<small class="reminder-late">Просрочено</small>':'')+(p.paused?'<small>Приостановлено</small>':'')+'</span></span></button>'+control('complete','Подтвердить: '+p.title,'<span class="reminder-check">'+icon('check')+'</span>',attrs(o.id)+'')+'</div></li>';
  }
  function calendar(s,rows){
    var selected=s.selected||root.Fmt.todayIso(),d=new Date(selected+'T12:00:00Z'),week=[];
    d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
    for(var i=0;i<7;i++){week.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}
    var cells=s.expanded?C.cells(s.month):week,counts=Object.create(null);
    rows.forEach(function(o){counts[o.date]=(counts[o.date]||0)+1;});
    var html='<div class="reminder-calendar__head"><strong>'+e(new Date(s.month+'-01T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}))+'</strong>'+control('month','Предыдущий месяц',icon('back'),'data-delta="-1"')+control('month','Следующий месяц',icon('next'),'data-delta="1"')+control('expand',s.expanded?'Свернуть до недели':'Раскрыть месяц',icon('expand'),'aria-expanded="'+!!s.expanded+'" aria-controls="reminder-days"')+'</div><div class="reminder-week">';
    ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function(day){html+='<span>'+day+'</span>';});
    html+='</div><div id="reminder-days" class="reminder-days">';
    cells.forEach(function(day){if(!day){html+='<span></span>';return;}html+='<button type="button" class="reminder-day" data-action="reminder-day" data-date="'+day+'" aria-pressed="'+(day===selected)+'" aria-label="'+day+', событий: '+(counts[day]||0)+'"'+(day===root.Fmt.todayIso()?' aria-current="date"':'')+'><span>'+Number(day.slice(-2))+'</span><span class="reminder-dot'+(counts[day]?' has-events':'')+'" aria-hidden="true"></span></button>';});
    html+='</div>';
    if(!s.expanded)html+='<div class="reminder-week-nav">'+b('week','‹ Неделя','data-delta="-1" aria-label="Предыдущая неделя"')+b('week','Неделя ›','data-delta="1" aria-label="Следующая неделя"')+'</div>';
    return html;
  }
  function plural(n){return n%10===1&&n%100!==11?'напоминание':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'напоминания':'напоминаний';}
  function dayLabel(day){return (day===root.Fmt.todayIso()?'Сегодня, ':'')+new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});}
  function page(s){
    var data=s.data||{reminders:[],occurrences:[]},defs=data.reminders,byId=Object.create(null),today=root.Fmt.todayIso(),filter=s.filter||'today',selected=s.selected||today;
    defs.forEach(function(p){byId[p.id]=p;});
    var rows=data.occurrences.filter(function(o){return !!byId[o.reminder_id];}),active=rows.filter(function(o){return !byId[o.reminder_id].paused;}),late=active.filter(function(o){return Date.parse(o.due_at)<Date.now();});
    var visible=(filter==='date'?rows:active).filter(function(o){return filter==='upcoming'?Date.parse(o.due_at)>=Date.now():filter==='overdue'?Date.parse(o.due_at)<Date.now():o.date===(filter==='today'?today:selected);}).slice().sort(function(a,b){return a.due_at.localeCompare(b.due_at)||a.id.localeCompare(b.id);});
    var html='<section class="payments reminders"><header class="reminder-header"><button type="button" class="reminder-icon" data-action="modules-home" aria-label="Назад к модулям">'+icon('back')+'</button><h1>Напоминания</h1></header>';
    if(!root.RemindersApi.available())return html+'<p role="status">Модуль ожидает подключения серверного API.</p></section>';
    html+='<div data-reminder-region="notice">'+(root.RemindersApi.isMock()?'<p class="payments-notice">Демо: данные до перезагрузки. Telegram-уведомления не отправляются.</p>':'')+'</div><div class="reminder-calendar" data-reminder-region="calendar" data-gesture-lock>'+calendar(s,rows)+'</div><div data-reminder-region="filters" class="reminder-filters" role="group" aria-label="Период напоминаний">';
    [['today','Сегодня'],['upcoming','Предстоящие'],['overdue','Просроченные']].forEach(function(f){html+='<button type="button" data-action="reminder-filter" data-filter="'+f[0]+'" aria-pressed="'+(filter===f[0])+'">'+f[1]+(f[0]==='overdue'&&late.length?'<span class="reminder-count">'+late.length+'</span>':'')+'</button>';});
    html+='</div><div data-reminder-region="timeline"><div class="reminder-day-title"><h2>'+e(filter==='upcoming'?'Предстоящие':filter==='overdue'?'Просроченные':dayLabel(filter==='today'?today:selected))+'</h2><span>'+visible.length+' '+plural(visible.length)+'</span></div>';
    if(s.loading)html+='<p role="status">Обновляем напоминания…</p>';
    if(s.error)html+='<p role="alert">'+e(s.error)+'</p>'+b('retry','Повторить');
    html+='<ol class="reminder-timeline">';var lastDate=null;
    visible.forEach(function(o){if((filter==='upcoming'||filter==='overdue')&&lastDate!==o.date){html+='<li class="reminder-date-label">'+e(dayLabel(o.date))+'</li>';lastDate=o.date;}html+=row(o,byId[o.reminder_id]);});
    html+='</ol>'+(!visible.length&&!s.loading&&!s.error?'<p class="reminder-empty">'+(filter==='overdue'?'Просроченных напоминаний нет':filter==='upcoming'?'Предстоящих напоминаний нет':'На этот день напоминаний нет')+'</p>':'')+'</div><details class="reminder-schedules" data-reminder-region="schedules"><summary>Управление расписаниями · '+defs.length+'</summary><p class="reminder-zone">Личные события · '+e(s.timezone)+'</p>'+defs.map(function(p){return '<article class="payment-row'+(p.paused?' is-paused':'')+'"><strong>'+e(p.title)+'</strong><p>'+e(repeatLabel(p))+(p.paused?' · Приостановлено':'')+'</p><div class="payment-actions">'+b('edit','Открыть / изменить',attrs(p.id))+b('pause',p.paused?'Возобновить':'Приостановить',attrs(p.id))+b('delete','Удалить',attrs(p.id))+'</div></article>';}).join('')+'</details><button type="button" class="reminder-fab" data-action="reminder-new" aria-label="Добавить напоминание">'+icon('plus')+'</button></section>';
    return html;
  }
  function form(p,day,zone){
    p=p||{};var r=p.repeat||{unit:'day',interval:1,weekdays:[]};
    return '<form class="payment-form reminder-form" data-form="reminder" data-id="'+e(p.id||'')+'"><h2>'+(p.id?'Напоминание':'Новое напоминание')+'</h2>'+field('Название',input('title',p.title,'text','required maxlength="120"'))+field('Описание','<textarea class="input" name="description" maxlength="1000">'+e(p.description)+'</textarea>')+field('Дата',input('date',p.date||day,'date','required min="2000-01-01" max="2100-12-31"'))+field('Время',input('time',p.time||'09:00','time','required'))+field('Часовой пояс',input('timezone',p.timezone||zone,'text','required'))+field('Повторение','<select class="input" name="repeat">'+options([['once','Разовое событие'],['day','Ежедневно / каждые N дней'],['week','Еженедельно / каждые N недель'],['month','Ежемесячно / каждые N месяцев'],['year','Ежегодно / каждые N лет']],p.repeat?r.unit:'once')+'</select>')+field('Интервал повторения',input('interval',r.interval,'number','min="1" max="365" step="1"'))+'<fieldset><legend>Дни недели (для еженедельного повторения)</legend><div class="reminder-weekdays">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(function(d,i){return '<label><input type="checkbox" name="weekday" value="'+(i+1)+'"'+(r.weekdays.includes(i+1)?' checked':'')+'>'+d+'</label>';}).join('')+'</div></fieldset>'+field('Уведомления: за сколько минут, через запятую',input('notifications',(p.notifications||[]).join(', '),'text','placeholder="1440, 60, 15, 0"'))+'<p>1440 — за день, 60 — за час, 15 — за 15 минут, 0 — в назначенное время. Пустое поле — без уведомлений.</p>'+field('Приоритет','<select class="input" name="priority">'+options([['normal','Обычный'],['important','Важный']],p.priority||'normal')+'</select>')+'<p class="payment-form-error" role="alert"></p><div class="payment-actions"><button class="payment-button" type="submit">Сохранить</button>'+b('cancel','Отмена')+(p.id?b('pause',p.paused?'Возобновить':'Приостановить',attrs(p.id))+b('delete','Удалить',attrs(p.id)):'')+'</div></form>';
  }
  root.RemindersViews={page:page,form:form};
})(window);
