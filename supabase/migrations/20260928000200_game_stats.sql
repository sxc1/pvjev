-- One aggregate row per user and game. Results are from the human's perspective.
-- Supabase Auth manages auth.users.

create table public.game_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (game_id in ('tic-tac-toe', 'connect-four')),
  rng_wins integer not null default 0 check (rng_wins >= 0),
  rng_losses integer not null default 0 check (rng_losses >= 0),
  rng_draws integer not null default 0 check (rng_draws >= 0),
  jev_wins integer not null default 0 check (jev_wins >= 0),
  jev_losses integer not null default 0 check (jev_losses >= 0),
  jev_draws integer not null default 0 check (jev_draws >= 0),
  last_match_id uuid not null,
  last_match_completed_at timestamptz not null,
  primary key (user_id, game_id)
);

alter table public.game_stats enable row level security;

revoke all on public.game_stats from anon, authenticated;
grant select on public.game_stats to authenticated;

create policy "Read own game stats" on public.game_stats
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Record a game result via atomic increment.

create function public.record_game_result(
  p_game_id text,
  p_opponent text,
  p_result text,
  p_match_id uuid
)
returns public.game_stats
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recorded_at timestamptz := clock_timestamp();
  v_stats public.game_stats;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_game_id is null
     or p_game_id not in ('tic-tac-toe', 'connect-four') then
    raise exception 'Invalid game ID: %', p_game_id;
  end if;

  if p_opponent is null or p_opponent not in ('rng', 'jev') then
    raise exception 'Invalid opponent: %', p_opponent;
  end if;

  if p_result is null or p_result not in ('win', 'loss', 'draw') then
    raise exception 'Invalid result: %', p_result;
  end if;

  if p_match_id is null then
    raise exception 'Match ID required';
  end if;

  insert into public.game_stats (
    user_id,
    game_id,
    rng_wins,
    rng_losses,
    rng_draws,
    jev_wins,
    jev_losses,
    jev_draws,
    last_match_id,
    last_match_completed_at
  )
  values (
    v_user_id,
    p_game_id,
    case when p_opponent = 'rng' and p_result = 'win' then 1 else 0 end,
    case when p_opponent = 'rng' and p_result = 'loss' then 1 else 0 end,
    case when p_opponent = 'rng' and p_result = 'draw' then 1 else 0 end,
    case when p_opponent = 'jev' and p_result = 'win' then 1 else 0 end,
    case when p_opponent = 'jev' and p_result = 'loss' then 1 else 0 end,
    case when p_opponent = 'jev' and p_result = 'draw' then 1 else 0 end,
    p_match_id,
    v_recorded_at
  )
  on conflict (user_id, game_id) do update set
    rng_wins = public.game_stats.rng_wins + excluded.rng_wins,
    rng_losses = public.game_stats.rng_losses + excluded.rng_losses,
    rng_draws = public.game_stats.rng_draws + excluded.rng_draws,
    jev_wins = public.game_stats.jev_wins + excluded.jev_wins,
    jev_losses = public.game_stats.jev_losses + excluded.jev_losses,
    jev_draws = public.game_stats.jev_draws + excluded.jev_draws,
    last_match_id = excluded.last_match_id,
    last_match_completed_at = excluded.last_match_completed_at
  -- Don't record same match twice or a match that was completed too quickly.
  where public.game_stats.last_match_id <> excluded.last_match_id
    and public.game_stats.last_match_completed_at <= excluded.last_match_completed_at - interval '1 second'
  returning * into v_stats;

  if not found then
    raise exception 'Result already recorded or submitted too soon';
  end if;

  return v_stats;
end;
$$;

revoke all on function public.record_game_result(text, text, text, uuid) from public, anon;
grant execute on function public.record_game_result(text, text, text, uuid)
  to authenticated;
