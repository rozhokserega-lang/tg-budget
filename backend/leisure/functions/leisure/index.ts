import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { telegramUser } from './auth.ts';
const env = (k:string)=>Deno.env.get(k)||'';
const db = createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
const headers = {'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization, content-type, apikey','access-control-allow-methods':'GET, POST, OPTIONS'};
const reply = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
function invalid():never { throw new Error('VALIDATION_ERROR'); }
function check<T>(r:{data:T,error:unknown}):T { if(r.error) { console.error('leisure database operation failed'); throw new Error('UNAVAILABLE'); } return r.data; }
Deno.serve(async req=>{
 if(req.method==='OPTIONS') return new Response(null,{headers});
 if(req.method==='GET' && new URL(req.url).pathname.endsWith('/catalog')) {
  try {
   const url=new URL(req.url),city=Number(url.searchParams.get('city_id')),cursor=url.searchParams.get('cursor')||'';
   if(!Number.isSafeInteger(city)||city<=0||cursor&&!/^osm:(node|way|relation):[1-9][0-9]*$/.test(cursor)) return reply({error:'VALIDATION_ERROR'},400);
   let query=db.from('leisure_city_places').select('place_id,place:leisure_places(*)').eq('city_id',city).eq('active',true).order('place_id').limit(201);
   if(cursor)query=query.gt('place_id',cursor);
   const rows=check(await query)||[],page=rows.slice(0,200);
   return reply({license:'ODbL-1.0',licenseUrl:'https://opendatacommons.org/licenses/odbl/1-0/',attribution:'© OpenStreetMap contributors',city_id:city,data:page.map(r=>r.place),nextCursor:rows.length>200?page[199].place_id:null});
  } catch {return reply({error:'UNAVAILABLE'},503);}
 }
 if(req.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405);
 try {
  if(Number(req.headers.get('content-length'))>20000) return reply({error:'TOO_LARGE'},413);
  const raw=await req.text(); if(raw.length>20000) return reply({error:'TOO_LARGE'},413);
  let body; try {body=JSON.parse(raw);} catch {return reply({error:'VALIDATION_ERROR'},400);}
  if(!body || typeof body!=='object' || Array.isArray(body)) invalid();
  const telegramId=await telegramUser(body.initData,env('BOT_TOKEN'));
  const member=check(await db.from('members').select('id').eq('telegram_id',telegramId).maybeSingle());
  if(!member) return reply({error:'UNAUTHORIZED'},401);
  const owner=member.id, action=body.action;
  if(action==='cities') {
   const q=String(body.query||'').trim().slice(0,80);
   if(q.length<2) return reply({cities:[]});
   // Escape LIKE metacharacters; no client-supplied filter expressions.
   const term=q.replace(/[\\%_]/g,'\\$&');
   return reply({cities:check(await db.from('leisure_cities').select('id,name,region,timezone').ilike('name',term+'%').order('name').limit(30))});
  }
  if(action==='preferences') {
   const p=body.preferences;if(!p||!Number.isSafeInteger(p.city_id)||!Array.isArray(p.categories)||!p.categories.length||p.categories.length>50) invalid();
   const cats=check(await db.from('leisure_categories').select('id'))||[];
   if(p.categories.some((c:unknown)=>!cats.some(x=>x.id===c))||new Set(p.categories).size!==p.categories.length||typeof p.exclude_visited!=='boolean') invalid();
   const city=check(await db.from('leisure_cities').select('id').eq('id',p.city_id).maybeSingle());if(!city) invalid();
   const radius=p.radius_km??null,lat=p.origin_lat??null,lon=p.origin_lon??null;
   if(radius!==null&&(!Number.isInteger(radius)||radius<1||radius>30)) invalid();
   if((lat===null)!==(lon===null)||lat!==null&&(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lon!=='number'||!Number.isFinite(lon)||Math.abs(lon)>180)||radius!==null&&lat===null) invalid();
   // Transactional RPC increments revision under the same lock used by daily picks.
   check(await db.rpc('leisure_set_preferences',{p_owner:owner,p_city:p.city_id,p_categories:p.categories,p_radius:radius,p_lat:lat,p_lon:lon,p_exclude:p.exclude_visited}));
  } else if(action==='saved') {
   const id=body.id;if(typeof id!=='string'||!/^osm:(node|way|relation):[1-9][0-9]*$/.test(id)) invalid();
   const patch:Record<string,unknown>={};
   if(body.favorite!==undefined) {if(typeof body.favorite!=='boolean') invalid();patch.favorite=body.favorite;}
   if(body.visited!==undefined) {if(typeof body.visited!=='boolean') invalid();patch.visited=body.visited;}
   if(body.planned_on!==undefined) {const d=body.planned_on;if(d!==null&&(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)) invalid();patch.planned_on=d;}
   check(await db.rpc('leisure_save',{p_owner:owner,p_id:id,p_patch:patch}));
  } else if(action!=='load') invalid();
  return reply(check(await db.rpc('leisure_snapshot',{p_owner:owner})));
 } catch(e) {
  const code=e instanceof Error?e.message:'UNAVAILABLE';
  return reply({error:['UNAUTHORIZED','VALIDATION_ERROR'].includes(code)?code:'UNAVAILABLE'},code==='UNAUTHORIZED'?401:code==='VALIDATION_ERROR'?400:503);
 }
});
