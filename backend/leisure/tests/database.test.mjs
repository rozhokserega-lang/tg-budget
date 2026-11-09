import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.LEISURE_PGLITE_MODULE||'@electric-sql/pglite');
const sql=await readFile(new URL('../migrations/001_leisure.sql',import.meta.url),'utf8');
const owner='11111111-1111-1111-1111-111111111111', other='22222222-2222-2222-2222-222222222222';
test('PostgreSQL migration, daily stability, radius, history, owner isolation and saved merges',async()=>{
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated;create role service_role;create table members(id uuid primary key);');
 await db.exec(sql);await db.exec(sql);
 await db.query('insert into members values($1),($2)',[owner,other]);
 await db.exec("insert into leisure_cities(id,name,region,timezone,lat,lon,imported_at) values(1,'Тест','RU','Asia/Kamchatka',55,37,now()),(2,'Другой','RU','Europe/Moscow',50,30,now());");
 for(let i=1;i<=15;i++){
  await db.query('insert into leisure_places(id,name,category,lat,lon,source_url) values($1,$2,$3,55,37,$4)',[`osm:node:${i}`,`Place ${i}`,['park','cafe','museum'][i%3],`https://www.openstreetmap.org/node/${i}`]);
  await db.query('insert into leisure_city_places(city_id,place_id) values(1,$1)',[`osm:node:${i}`]);
 }
 const prefs=(who,cats=['park','cafe','museum'],rad=null,lat=null,lon=null)=>db.query('select leisure_set_preferences($1,1,$2,$3,$4,$5,true)',[who,cats,rad,lat,lon]);
 const load=async(who=owner)=>(await db.query('select leisure_snapshot($1) as s',[who])).rows[0].s;
 await prefs(owner);await prefs(other);
 const first=await load();assert.equal(first.daily.places.length,3);assert.equal(new Set(first.daily.places.map(p=>p.category)).size,3);
 assert.equal(first.daily.date,new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kamchatka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 assert.deepEqual((await load()).daily,first.daily);
 const id=first.daily.places[0].id;
 await db.query('select leisure_save($1,$2,$3)',[owner,id,{favorite:true,planned_on:'2027-01-15'}]);
 await db.query('select leisure_save($1,$2,$3)',[owner,id,{visited:true}]);
 let state=await load();assert.equal(state.saved[0].favorite,true);assert.equal(state.saved[0].planned_on,'2027-01-15');assert.equal(state.saved[0].visited,true);
 assert.equal((await load(other)).saved.length,0);
 await db.query('select leisure_save($1,$2,$3)',[owner,id,{planned_on:null}]);assert.equal((await load()).saved[0].favorite,true);assert.equal((await load()).saved[0].planned_on,null);
 // A new explicit preference revision creates a fresh snapshot and excludes visited.
 await prefs(owner);state=await load();assert(!state.daily.places.some(p=>p.id===id));
 const prior=state.daily.places.map(p=>p.id);
 await db.query("update leisure_days set local_date=local_date-1 where owner_id=$1 and revision=2",[owner]);
 state=await load();assert(state.daily.places.every(p=>!prior.includes(p.id)));
 await prefs(owner,['park'],1,10,10);assert.equal((await load()).daily.places.length,0);
 await prefs(owner,['park']);assert.equal((await load()).daily.places.length,3);
 await db.exec('update leisure_city_places set active=false');await prefs(owner);assert.equal((await load()).daily.places.length,0);
 // Anonymous/authenticated SQL roles cannot bypass the Edge Function.
 await db.exec('set role anon');await assert.rejects(db.query('select * from leisure_saved'));await assert.rejects(db.query('select leisure_snapshot($1)',[owner]));
 await db.close();
});
