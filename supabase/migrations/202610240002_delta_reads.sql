-- Construct small observer responses inside Postgres; full game rows never cross
-- the database/function boundary just to relay a one-province change.
create or replace function public.orbis_read_delta(room_id uuid, since_revision bigint, seat_secret text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
 r public.orbis_rooms%rowtype;
 who integer;
 changes jsonb;
 fields jsonb;
 provinces jsonb;
 visible_snapshot jsonb;
begin
 select * into r from public.orbis_rooms where id=room_id;
 if not found then return null; end if;
 select (seat->>'color')::integer into who
 from jsonb_array_elements(r.snapshot->'seats') seat where seat->>'secret'=seat_secret;
 if who is null then raise exception 'Unauthorized seat'; end if;
 select coalesce(jsonb_agg(c order by (c->>'revision')::bigint),'[]'::jsonb) into changes
 from jsonb_array_elements(coalesce(r.snapshot->'recentChanges','[]'::jsonb)) c
 where (c->>'revision')::bigint>since_revision;
 if jsonb_array_length(changes)=0 or (changes->0->>'revision')::bigint<>since_revision+1
    or (changes->-1->>'revision')::bigint<>r.revision then
   return jsonb_build_object('id',r.id,'revision',r.revision,'snapshot',r.snapshot-'world');
 end if;
 select coalesce(jsonb_object_agg(f.key,f.value order by (c->>'revision')::bigint),'{}'::jsonb)
 into fields from jsonb_array_elements(changes) c cross join lateral jsonb_each(c->'fields') f;
 select coalesce(jsonb_agg(p),'[]'::jsonb) into provinces from (
   select distinct on ((p->>0)::integer) p
   from jsonb_array_elements(changes) c cross join lateral jsonb_array_elements(c->'provinces') p
   order by (p->>0)::integer,(c->>'revision')::bigint desc
 ) latest;
 fields=fields || jsonb_build_object('undo',case
   when r.snapshot->'state'->'undo'->-1->>'actor'=who::text then r.snapshot->'state'->'undo'
   else '[]'::jsonb end);
 visible_snapshot=(r.snapshot-'world'-'state'-'recentChanges') ||
   jsonb_build_object('state',fields,'provinces',provinces,'delta',true);
 select visible_snapshot || jsonb_build_object('recentRequests',coalesce(jsonb_agg(q),'[]'::jsonb))
 into visible_snapshot from jsonb_array_elements(coalesce(r.snapshot->'recentRequests','[]'::jsonb)) q
 where (q->>'player')::integer=who and ((q->>'revision') is null or (q->>'revision')::bigint>since_revision);
 return jsonb_build_object('id',r.id,'revision',r.revision,'snapshot',visible_snapshot);
end;
$$;
revoke all on function public.orbis_read_delta(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.orbis_read_delta(uuid,bigint,text) to service_role;
