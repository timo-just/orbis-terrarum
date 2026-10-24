-- Active state stays private. Permanent backups are downloaded by the players.
grant delete on public.orbis_rooms to service_role;
create index if not exists orbis_rooms_updated_at_idx on public.orbis_rooms(updated_at);

-- Geometry is immutable: do not transfer it on each action or notification read.
create or replace function public.orbis_read_room(room_id uuid, compact boolean default false)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('id',id,'revision',revision,'snapshot',
   case when compact then snapshot - 'world' else snapshot end)
 from public.orbis_rooms where id=room_id;
$$;
create or replace function public.orbis_update_room(room_id uuid, expected_revision bigint, room_snapshot jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 update public.orbis_rooms
 set snapshot=snapshot || room_snapshot, revision=expected_revision+1, updated_at=now()
 where id=room_id and revision=expected_revision;
 return found;
end;
$$;
revoke all on function public.orbis_read_room(uuid,boolean) from public,anon,authenticated;
revoke all on function public.orbis_update_room(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.orbis_read_room(uuid,boolean) to service_role;
grant execute on function public.orbis_update_room(uuid,bigint,jsonb) to service_role;
