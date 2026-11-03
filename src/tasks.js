(function(root){
  root.Tasks={create:function(host){
    var s={data:null,selected:'all',sort:'due',completed:false,loading:false,error:null},scope=null,generation=0,busy=false,drag=null,touch=null,formScope=null,formSnapshot=null,formKey=null,operationKeys={};
    function reset(){var next=host.scope();if(next!==scope){scope=next;generation++;s.data=null;s.selected='all';s.sort='due';s.completed=false;formSnapshot=null;formKey=null;operationKeys={};}}
    function paint(){if(host.active())host.render(root.TasksViews.page(s),true);}
    function load(force){reset();var gen=++generation,current=scope;s.loading=true;s.error=null;paint();if(!root.TasksApi.available()){s.loading=false;paint();return Promise.resolve();}
      return host.load('tasks:'+scope,function(){return root.TasksApi.invoke('list',{scope:current});},force).then(function(data){if(gen!==generation||current!==host.scope())return;s.data=data;s.selected=data.preferences.selected;s.sort=data.preferences.sort;s.loading=false;paint();}).catch(function(err){if(gen!==generation||current!==host.scope())return;s.loading=false;s.error=err.message;paint();});
    }
    function mutate(method,q,form){if(busy)return Promise.resolve();if(host.expired()){host.toast('Срок доступа закончился');return Promise.resolve();}reset();var current=scope;busy=true;host.lock(true);if(form){form.querySelector('[type="submit"]').disabled=true;form.querySelector('.task-form-error').textContent='';}
      return root.TasksApi.invoke(method,Object.assign({},q,{scope:current})).then(function(){if(current!==host.scope())return;generation++;host.invalidate('tasks:'+current);if(form)host.close();return load(true);}).catch(function(err){if(current!==host.scope())return;if(form&&form.isConnected)form.querySelector('.task-form-error').textContent=err.message;else host.toast(err.message);}).finally(function(){busy=false;host.lock(false);if(form)form.querySelector('[type="submit"]').disabled=false;});
    }
    function sheet(html,snapshot){formScope=host.scope();formSnapshot=snapshot?JSON.parse(JSON.stringify(snapshot)):null;formKey=key();host.sheet(html);}
    function operationKey(method,id){var value=find(id),version=value&&value.server?value.server.version:value&&value.completed_at||'active',slot=method+':'+id+':'+version;return operationKeys[slot]||(operationKeys[slot]=key());}
    function find(id){return s.data&&s.data.tasks.find(function(t){return t.id===id;});}
    function key(){return root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now()+'-'+Math.random();}
    function reorder(id,target){if(busy||s.sort!=='manual'||s.completed)return;var rows=root.TasksModel.rows(s,root.Fmt.todayIso()),a=rows.findIndex(function(t){return t.id===id;}),b=rows.findIndex(function(t){return t.id===target;});if(a<0||b<0)return;if(s.selected==='all'&&root.TasksModel.overdue(rows[a],root.Fmt.todayIso())!==root.TasksModel.overdue(rows[b],root.Fmt.todayIso()))return;var ids=rows.map(function(t){return t.id;});ids.splice(b,0,ids.splice(a,1)[0]);return mutate('preferences',{view:s.selected,order:ids});}
    function action(a,node){if(busy)return;reset();var id=node.getAttribute('data-id');if(a==='task-home')return host.home();if(a==='task-retry')return load(true);if(a==='task-cancel')return host.close();if(!s.data)return;
      if(a==='task-new'||a==='task-edit'){var t=find(id);if(id&&!t)return;return sheet(root.TasksViews.form(t,s,key()),t);}
      if(a==='task-list-new'||a==='task-list-edit'){var list=s.data.lists.find(function(l){return l.id===id;});return sheet(root.TasksViews.listForm(list),list);}
      if(a==='task-completed'){s.completed=!s.completed;return paint();}
      if(a==='task-delete'||a==='task-list-delete'){var current=scope;return host.confirm(a==='task-list-delete'?'Удалить список? Все задачи сохранятся в «Без списка».':'Удалить задачу без возможности восстановления?').then(function(ok){if(ok&&current===host.scope())return mutate(a==='task-delete'?'remove':'removeList',{id:id});});}
      if(a==='task-restore')return mutate('restore',{id:id,idempotency_key:operationKey('restore',id)});
      if(a==='task-up'||a==='task-down'){var rows=root.TasksModel.rows(s,root.Fmt.todayIso()),i=rows.findIndex(function(t){return t.id===id;}),other=rows[i+(a==='task-up'?-1:1)];if(other)return reorder(id,other.id);}
    }
    function submit(form,isList){if(busy)return;if(formScope!==host.scope()){host.close();host.toast('Пользователь изменился. Откройте форму заново');return;}var v=form.elements,id=form.getAttribute('data-id');try{if(isList)return mutate('saveList',{id:id||null,name:v.name.value.trim(),server:formSnapshot&&formSnapshot.server,idempotency_key:formKey},form);var t=root.TasksModel.validate({id:id||undefined,title:v.title.value.trim(),description:v.description.value.trim(),list_id:v.list_id.value==='none'?null:v.list_id.value,due_on:v.due_on.value||null,priority:v.priority.value,repeat:v.unit.value?{unit:v.unit.value,interval:Number(v.interval.value),weekdays:Array.from(form.querySelectorAll('[name="weekday"]:checked')).map(function(n){return Number(n.value);})}:null,reminders:v.reminders.value.trim()?Array.from(new Set(v.reminders.value.split(',').map(function(n){return n.trim()?Number(n):NaN;}))):[]});if(formSnapshot&&formSnapshot.server)t.server=formSnapshot.server;return mutate('save',{task:t,edit_scope:v.edit_scope?v.edit_scope.value:undefined,idempotency_key:formKey||form.getAttribute('data-key')},form);}catch(err){form.querySelector('.task-form-error').textContent=err.message;}}
    function change(node){if(node.hasAttribute('data-task-complete')){node.disabled=true;return mutate('complete',{id:node.getAttribute('data-task-complete'),idempotency_key:operationKey('complete',node.getAttribute('data-task-complete'))}).finally(function(){node.checked=false;node.disabled=false;});}var field=node.getAttribute('data-task-select');if(field){var q={};q[field]=node.value;return mutate('preferences',q);}}
    function pointer(ev){if(!host.active()||busy||s.sort!=='manual')return;var row=ev.target.closest('[data-task-id]');if(ev.type==='dragstart'){if(!row)return;drag=row.getAttribute('data-task-id');ev.dataTransfer.setData('text/plain',drag);}if(ev.type==='dragover'&&row)ev.preventDefault();if(ev.type==='drop'&&row){ev.preventDefault();var from=drag;drag=null;return reorder(from,row.getAttribute('data-task-id'));}if(ev.type==='dragend')drag=null;}
    function touchDrag(ev){
      if(!host.active()||busy||s.sort!=='manual')return;
      if(ev.type==='pointerdown'){
        var handle=ev.target.closest('[data-task-drag]');if(!handle)return;
        var row=handle.closest('[data-task-id]');touch={id:row.getAttribute('data-task-id'),target:null,pointer:ev.pointerId};handle.setPointerCapture(ev.pointerId);ev.preventDefault();
      }
      if(!touch||touch.pointer!==ev.pointerId)return;
      if(ev.type==='pointermove'){var hit=root.document.elementFromPoint(ev.clientX,ev.clientY),target=hit&&hit.closest('[data-task-id]');touch.target=target&&target.getAttribute('data-task-id');}
      if(ev.type==='pointerup'){var moved=touch;touch=null;if(moved.target)return reorder(moved.id,moved.target);}
      if(ev.type==='pointercancel')touch=null;
    }
    return {touch:touchDrag,open:function(){host.enter();reset();return load(false);},refresh:function(){return load(true);},action:action,submit:submit,change:change,pointer:pointer};
  }};
})(window);
