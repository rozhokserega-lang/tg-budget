/** Injectable adapter; no guessed backend endpoints. Mock lifetime is the demo session. */
(function(root) {
  var stores = Object.create(null), seq = 0;
  function copy(v) { return JSON.parse(JSON.stringify(v)); }
  function store(q) { if (!q.scope || q.scope === 'anonymous') throw new Error('Войдите в приложение'); return stores[q.scope] || (stores[q.scope] = {lists:[], tasks:[], preferences:{selected:'all',sort:'due',orders:{}}, requests:{}}); }
  function task(s,id) { var t=s.tasks.find(function(t){return t.id===id;}); if(!t) throw new Error('Задача уже удалена'); return t; }
  function checkList(s,id) { if(id && !s.lists.some(function(l){return l.id===id;})) throw new Error('Список уже удалён'); }
  var mock = {
    list:function(q){ var s=store(q); return copy({lists:s.lists,tasks:s.tasks,preferences:s.preferences}); },
    saveList:function(q){var s=store(q), name=q.name.trim(); if(!name || name.length>80) throw new Error('Название списка: 1–80 символов'); var l=s.lists.find(function(l){return l.id===q.id;}); if(q.id&&!l) throw new Error('Список уже удалён'); if(l) l.name=name; else s.lists.push({id:'list-'+ ++seq,name:name});},
    removeList:function(q){var s=store(q); s.tasks.forEach(function(t){if(t.list_id===q.id)t.list_id=null;}); s.lists=s.lists.filter(function(l){return l.id!==q.id;}); if(s.preferences.selected===q.id)s.preferences.selected='none'; delete s.preferences.orders[q.id];},
    save:function(q){var s=store(q), t=root.TasksModel.validate(copy(q.task)); checkList(s,t.list_id); if(t.id){var old=task(s,t.id); if(old.completed_at)throw new Error('Сначала восстановите задачу'); Object.assign(old,t); old.anchor_day=Number((t.due_on||'').slice(-2)); old.anchor_month=t.due_on?Number(t.due_on.slice(5,7))-1:null;} else {if(s.requests[q.idempotency_key])return; t.id='task-'+ ++seq; t.created_at=new Date().toISOString(); t.completed_at=null; t.delete_after=null; t.anchor_day=t.due_on?Number(t.due_on.slice(-2)):null; t.anchor_month=t.due_on?Number(t.due_on.slice(5,7))-1:null; s.tasks.push(t); s.requests[q.idempotency_key]=t.id;}},
    complete:function(q){var s=store(q), t=task(s,q.id); if(t.completed_at)return; t.completed_at=new Date().toISOString(); t.delete_after=new Date(Date.now()+30*86400000).toISOString(); if(t.repeat&&!t.next_id){var next=copy(t); next.id='task-'+ ++seq; next.due_on=root.TasksModel.nextDate(t); next.completed_at=null;next.delete_after=null;next.created_at=new Date().toISOString();delete next.next_id;t.next_id=next.id;s.tasks.push(next);}},
    restore:function(q){var t=task(store(q),q.id); if(t.delete_after&&Date.parse(t.delete_after)<=Date.now())throw new Error('Срок восстановления истёк');t.completed_at=null;t.delete_after=null;},
    remove:function(q){var s=store(q);s.tasks=s.tasks.filter(function(t){return t.id!==q.id;});},
    preferences:function(q){var s=store(q);if(q.selected!==undefined){if(!['all','none'].includes(q.selected))checkList(s,q.selected);s.preferences.selected=q.selected;}if(q.sort!==undefined){if(!['due','priority','created','manual'].includes(q.sort))throw new Error('Неизвестная сортировка');s.preferences.sort=q.sort;}if(q.order)s.preferences.orders[q.view]=copy(q.order);}
  };
  function adapter(){return root.APP_TASKS_ADAPTER || (root.Api.isDemo()?mock:root.TasksRest);}
  root.TasksApi={available:function(){return !!adapter();},isMock:function(){return !root.APP_TASKS_ADAPTER&&root.Api.isDemo();},invoke:function(method,q){return Promise.resolve().then(function(){var a=adapter();if(!a||typeof a[method]!=='function')throw new Error('Модуль ожидает подключения серверного API');return a[method](q);});}};
})(window);
