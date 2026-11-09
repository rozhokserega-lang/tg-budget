const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
function fakeIndexedDb(options = {}) {
  const data = options.data || new Map();
  let storeExists = false;

  function request(exec, tx) {
    const req = {};
    queueMicrotask(() => {
      try {
        req.result = exec();
        if (req.onsuccess) req.onsuccess();
        queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
      } catch (err) {
        req.error = err;
        if (req.onerror) req.onerror();
        queueMicrotask(() => { if (tx.onabort) tx.onabort(); else if (tx.onerror) tx.onerror(); });
      }
    });
    return req;
  }

  const db = {
    objectStoreNames: { contains: name => storeExists && name === 'images' },
    createObjectStore() { storeExists = true; return {}; },
    close() {},
    transaction(name, mode) {
      if (name !== 'images') throw new Error('unknown store');
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = () => ({
        get(key) { return request(() => data.get(key), tx); },
        put(value, key) {
          if (options.quota) {
            const err = new Error('quota exceeded');
            err.name = 'QuotaExceededError';
            return request(() => { throw err; }, tx);
          }
          data.set(key, value);
          return request(() => key, tx);
        },
        delete(key) { data.delete(key); return request(() => undefined, tx); },
      });
      return tx;
    },
    mode: null,
  };

  return {
    data,
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        if (!storeExists && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
}


function setup({saved, data = new Map(), quota = false, corrupt = false} = {}) {
  const prefs = new Map(saved ? [['budget.appearance', JSON.stringify(saved)]] : []);
  const handlers = {}, css = new Map(), attrs = {}, urls = new Set(), status = {textContent:''};
  let sequence = 0;
  const window = {
    Blob, setTimeout: () => {},
    localStorage: {getItem: k => prefs.get(k), setItem: (k,v) => prefs.set(k,v)},
    URL: {createObjectURL: () => {const url = 'blob:test-' + ++sequence; urls.add(url); return url;}, revokeObjectURL: u => urls.delete(u)},
    Image: class { naturalWidth = 4000; naturalHeight = 3000; set src(v) {queueMicrotask(() => corrupt ? this.onerror() : this.onload());} },
    indexedDB: fakeIndexedDb({data, quota}),
    document: {
      documentElement: {dataset:attrs, style:{setProperty:(k,v) => css.set(k,v)}},
      querySelector: s => s === '[data-bg-status]' ? status : null,
      addEventListener:(k,fn) => handlers[k] = fn,
      createElement: () => ({getContext:()=>({drawImage(){}}), toBlob: fn => fn(new Blob(['compressed'], {type:'image/webp'}))})
    }
  };
  runInNewContext(readFileSync(require.resolve('../src/appearance.js'),'utf8'), {window});
  async function upload(file) {
    handlers.change({target:{hasAttribute:k=>k==='data-bg-file', files:[file], value:'file', dataset:{}}});
    await new Promise(r => setImmediate(r));
  }
  function pick(id) {handlers.click({target:{closest:()=>({hasAttribute:()=>false,dataset:{bgPreset:id}})}});}
  return {window, appearance:window.Appearance, handlers, prefs, data, css, attrs, urls, status, upload, pick};
}
test('invalid stored settings are bounded and restored before view rendering', async()=>{
 const s=setup({saved:{preset:'evil',dim:999,blur:-3,cards:1,fit:'evil',x:-1,y:101}}); await s.appearance.ready;
 assert.equal(s.attrs.appBackground,'default'); assert.equal(s.css.get('--app-bg-dim'),.8);
 assert.equal(s.css.get('--app-bg-blur'),'0px'); assert.equal(s.css.get('--app-card-opacity'),'60%');
 assert.match(s.appearance.render(),/data-bg-reset/);
});
test('presets save JSON only and sliders apply CSS without rendering',()=>{
 const s=setup();s.pick('waves'); assert.equal(JSON.parse(s.prefs.get('budget.appearance')).preset,'waves');
 const input={dataset:{bgSetting:'dim',unit:'%'},value:'41',hasAttribute:()=>false};
 s.handlers.input({target:input});s.handlers.change({target:input});
 assert.equal(s.css.get('--app-bg-dim'),.41);assert.equal(JSON.parse(s.prefs.get('budget.appearance')).dim,41);
});
test('upload compresses to IndexedDB, restores on restart, and reset frees URLs and image only',async()=>{
 const s=setup();s.data.set('home-cover','keep');
 await s.upload(new Blob(['original'],{type:'image/png'}));
 assert.equal(s.attrs.appBackground,'custom');assert.equal(s.css.get('--app-bg-dim'),.35);
 assert.equal(s.data.get('app-background').type,'image/webp');assert.equal(s.urls.size,1);
 assert.ok(!s.prefs.get('budget.appearance').includes('base64'));
 const reload=setup({saved:JSON.parse(s.prefs.get('budget.appearance')),data:s.data});await reload.appearance.ready;
 assert.equal(reload.attrs.appBackground,'custom');assert.equal(reload.urls.size,1);
 s.handlers.click({target:{closest:()=>({hasAttribute:()=>true})}});await new Promise(r=>setImmediate(r));
 assert.equal(s.attrs.appBackground,'default');assert.equal(s.urls.size,0);assert.ok(!s.data.has('app-background'));assert.equal(s.data.get('home-cover'),'keep');
});
test('invalid format, oversized file, corrupt image and quota errors retain the current background',async()=>{
 const s=setup();s.pick('geometry');
 await s.upload({type:'image/gif',size:1});assert.match(s.status.textContent,/JPG/);
 await s.upload({type:'image/png',size:11*1024*1024});assert.match(s.status.textContent,/10 МБ/);assert.equal(s.attrs.appBackground,'geometry');
 const bad=setup({corrupt:true});await bad.upload(new Blob(['bad'],{type:'image/png'}));assert.equal(bad.urls.size,0);assert.equal(bad.attrs.appBackground,'default');
 const full=setup({quota:true});await full.upload(new Blob(['image'],{type:'image/png'}));assert.match(full.status.textContent,/места/);assert.equal(full.attrs.appBackground,'default');assert.equal(full.urls.size,0);
});
test('missing or corrupt stored image falls back without touching the balance cover',async()=>{
 const data=new Map([['home-cover','keep'],['app-background',new Blob(['bad'])]]);
 const s=setup({saved:{preset:'custom'},data,corrupt:true});await s.appearance.ready;
 assert.equal(s.attrs.appBackground,'default');assert.equal(s.urls.size,0);assert.equal(data.get('home-cover'),'keep');
});
