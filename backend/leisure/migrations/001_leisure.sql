-- Additive standalone module. Run against the existing TG Budget database.
begin;
create table if not exists public.leisure_categories(id text primary key, title text not null, symbol text not null);
insert into public.leisure_categories values
('cafe','Кафе и кофейни','☕'),('restaurant','Рестораны','🍽'),('park','Парки и скверы','🌳'),('museum','Музеи','🏛'),('theatre','Театры','🎭'),('cinema','Кинотеатры','🎬'),('sight','Достопримечательности','🏰'),('walk','Прогулки и пространства','🚶'),('active','Активный отдых','🚲') on conflict(id) do nothing;
create table if not exists public.leisure_cities(
 id bigint primary key, name text not null, region text not null, region_code text not null default '', timezone text not null,
 lat double precision not null check(lat between -90 and 90), lon double precision not null check(lon between -180 and 180),
 country text not null default 'RU' check(country='RU'), imported_at timestamptz, source text not null default 'GeoNames CC BY 4.0'
);
create index if not exists leisure_city_name on public.leisure_cities(lower(name));
create table if not exists public.leisure_places(
 id text primary key check(id ~ '^osm:(node|way|relation):[1-9][0-9]*$'),
 name text not null check(length(name) between 1 and 300), category text not null references public.leisure_categories,
 lat double precision not null check(lat between -90 and 90), lon double precision not null check(lon between -180 and 180),
 address text, description text, source_url text not null, updated_at timestamptz not null default now()
);
create table if not exists public.leisure_city_places(
 city_id bigint references public.leisure_cities on delete cascade, place_id text references public.leisure_places on delete cascade,
 active boolean not null default true, primary key(city_id,place_id)
);
create table if not exists public.leisure_preferences(
 owner_id uuid primary key references public.members(id) on delete cascade,
 city_id bigint not null references public.leisure_cities, categories text[] not null default array['park','walk','cafe'],
 radius_km integer check(radius_km between 1 and 30), origin_lat double precision check(origin_lat between -90 and 90),
 origin_lon double precision check(origin_lon between -180 and 180), exclude_visited boolean not null default true,
 revision integer not null default 1,
 check((origin_lat is null)=(origin_lon is null)), check(radius_km is null or origin_lat is not null),
 check(cardinality(categories) between 1 and 50)
);
create table if not exists public.leisure_saved(
 owner_id uuid references public.members(id) on delete cascade, place_id text references public.leisure_places,
 favorite boolean not null default false, visited boolean not null default false, planned_on date,
 updated_at timestamptz not null default now(), primary key(owner_id,place_id)
);
create table if not exists public.leisure_days(
 owner_id uuid references public.members(id) on delete cascade, city_id bigint references public.leisure_cities,
 local_date date not null, revision integer not null, place_ids text[] not null, created_at timestamptz not null default now(),
 primary key(owner_id,city_id,local_date,revision)
);
create index if not exists leisure_history on public.leisure_days(owner_id,local_date desc);
create table if not exists public.leisure_imports(
 city_id bigint primary key references public.leisure_cities, lease_until timestamptz, lease_token uuid,
 last_success timestamptz, next_attempt timestamptz, failures integer not null default 0, last_error text,
 source text, row_count integer
);
-- No client policies: access only through the authenticated Edge Function (service_role).
alter table public.leisure_categories enable row level security;
alter table public.leisure_cities enable row level security;
alter table public.leisure_places enable row level security;
alter table public.leisure_city_places enable row level security;
alter table public.leisure_preferences enable row level security;
alter table public.leisure_saved enable row level security;
alter table public.leisure_days enable row level security;
alter table public.leisure_imports enable row level security;
revoke all on public.leisure_categories, public.leisure_cities, public.leisure_places, public.leisure_city_places, public.leisure_preferences, public.leisure_saved, public.leisure_days, public.leisure_imports from anon, authenticated;
grant all on public.leisure_categories, public.leisure_cities, public.leisure_places, public.leisure_city_places, public.leisure_preferences, public.leisure_saved, public.leisure_days, public.leisure_imports to service_role;

create or replace function public.leisure_distance(a double precision,b double precision,c double precision,d double precision)
returns double precision language sql immutable strict set search_path=public as $$
 select 6371.0088 * 2 * asin(sqrt(least(1.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))));
$$;

create or replace function public.leisure_daily(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare pref leisure_preferences; city leisure_cities; day date; ids text[]; pick record;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 -- Serializes settings changes and all simultaneous requests for this member.
 select * into pref from leisure_preferences where owner_id=p_owner for update;
 if not found then return jsonb_build_object('date',null,'places','[]'::jsonb); end if;
 select * into city from leisure_cities where id=pref.city_id;
 day := (now() at time zone city.timezone)::date;
 select place_ids into ids from leisure_days where owner_id=p_owner and city_id=city.id and local_date=day and revision=pref.revision;
 if ids is null then
  ids := '{}';
  -- Least recently seen first. Category diversity per round; fresh places before repeats.
  for pick in
   with candidates as (
    select p.*, (select max(h.local_date) from leisure_days h where h.owner_id=p_owner and p.id=any(h.place_ids)) as seen
    from leisure_places p join leisure_city_places cp on cp.place_id=p.id
    left join leisure_saved s on s.place_id=p.id and s.owner_id=p_owner
    where cp.city_id=city.id and cp.active and p.category=any(pref.categories)
    and (not pref.exclude_visited or not coalesce(s.visited,false))
    and (pref.radius_km is null or leisure_distance(pref.origin_lat,pref.origin_lon,p.lat,p.lon)<=pref.radius_km)
   ), ranked as (
    select *, row_number() over(partition by category order by (seen>=day-14) asc nulls first, seen asc nulls first, md5(p_owner::text||day::text||id)) as cat_rank
    from candidates
   ) select * from ranked order by (seen>=day-14) asc nulls first, cat_rank, seen asc nulls first, md5(p_owner::text||day::text||id) limit 3
  loop ids:=array_append(ids,pick.id); end loop;
  -- An empty, unpopulated catalog can be retried after the first successful import.
  if cardinality(ids)>0 or city.imported_at is not null then
   insert into leisure_days values(p_owner,city.id,day,pref.revision,ids,now());
  end if;
 end if;
 return jsonb_build_object('date',day,'timezone',city.timezone,'importedAt',city.imported_at,'places',coalesce((
  select jsonb_agg(to_jsonb(p)||jsonb_build_object('city',city.name,'distanceKm',leisure_distance(pref.origin_lat,pref.origin_lon,p.lat,p.lon)) order by array_position(ids,p.id))
  from leisure_places p where p.id=any(ids)
 ),'[]'::jsonb));
end $$;
revoke all on function public.leisure_daily(uuid) from public,anon,authenticated;
grant execute on function public.leisure_daily(uuid) to service_role;
create or replace function public.leisure_set_preferences(p_owner uuid,p_city bigint,p_categories text[],p_radius integer,p_lat double precision,p_lon double precision,p_exclude boolean)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if exists(select 1 from unnest(p_categories) c where not exists(select 1 from leisure_categories where id=c)) then raise exception 'Invalid categories'; end if;
 insert into leisure_preferences(owner_id,city_id,categories,radius_km,origin_lat,origin_lon,exclude_visited)
 values(p_owner,p_city,p_categories,p_radius,p_lat,p_lon,p_exclude)
 on conflict(owner_id) do update set city_id=p_city,categories=p_categories,radius_km=p_radius,origin_lat=p_lat,origin_lon=p_lon,exclude_visited=p_exclude,revision=leisure_preferences.revision+1;
end $$;
revoke all on function public.leisure_set_preferences(uuid,bigint,text[],integer,double precision,double precision,boolean) from public,anon,authenticated;
grant execute on function public.leisure_set_preferences(uuid,bigint,text[],integer,double precision,double precision,boolean) to service_role;
create or replace function public.leisure_save(p_owner uuid,p_id text,p_patch jsonb)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 insert into leisure_saved(owner_id,place_id) values(p_owner,p_id) on conflict do nothing;
 update leisure_saved set
 favorite=case when p_patch?'favorite' then (p_patch->>'favorite')::boolean else favorite end,
 visited=case when p_patch?'visited' then (p_patch->>'visited')::boolean else visited end,
 planned_on=case when p_patch?'planned_on' then (p_patch->>'planned_on')::date else planned_on end,
 updated_at=now() where owner_id=p_owner and place_id=p_id;
end $$;
create or replace function public.leisure_snapshot(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare daily jsonb; pref jsonb; saved jsonb; cats jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 daily:=leisure_daily(p_owner);
 select to_jsonb(p)||jsonb_build_object('city',to_jsonb(c)) into pref from leisure_preferences p join leisure_cities c on c.id=p.city_id where p.owner_id=p_owner;
 select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('place',to_jsonb(p)||jsonb_build_object('city',(
   select c.name from leisure_city_places cp join leisure_cities c on c.id=cp.city_id where cp.place_id=p.id order by c.id limit 1
 )))), '[]'::jsonb) into saved from leisure_saved s join leisure_places p on p.id=s.place_id where s.owner_id=p_owner and (s.favorite or s.visited or s.planned_on is not null);
 select jsonb_agg(to_jsonb(c) order by c.id) into cats from leisure_categories c;
 return jsonb_build_object('preferences',pref,'daily',daily,'saved',saved,'categories',cats);
end $$;
revoke all on function public.leisure_save(uuid,text,jsonb),public.leisure_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.leisure_save(uuid,text,jsonb),public.leisure_snapshot(uuid) to service_role;
commit;
