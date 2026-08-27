-- Harry Potter Monopoly Deal — schema for local Supabase development.
-- 110-card deck (exact card list) + singleton realtime game_state.
-- RLS: anonymous read/write (dev only — do not use these policies in production).

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

drop table if exists public.game_state;
drop table if exists public.deck;

create table public.deck (
  id integer generated always as identity primary key,
  name text not null,
  type text not null check (
    type in ('action', 'money', 'property', 'wildcard', 'character')
  ),
  value integer,
  "colorSet" text,
  "rentValues" jsonb,
  effect text
);

comment on table public.deck is 'Static 110-card Harry Potter Monopoly Deal deck.';
comment on column public.deck.type is 'action | money | property | wildcard | character';
comment on column public.deck.value is 'Bank value in points when the card is used as money.';
comment on column public.deck."colorSet" is 'Property/rent color set(s), e.g. Red or Red/Yellow.';
comment on column public.deck."rentValues" is 'Rent charged for 1..n properties in the set, e.g. [2, 3, 6].';

create table public.game_state (
  id integer primary key default 1 check (id = 1),
  player_1_state jsonb not null default '{}'::jsonb,
  player_2_state jsonb not null default '{}'::jsonb,
  draw_pile jsonb not null default '[]'::jsonb,
  discard_pile jsonb not null default '[]'::jsonb,
  current_turn text not null default 'player_1'
    check (current_turn in ('player_1', 'player_2'))
);

comment on table public.game_state is 'Singleton row holding live two-player board state.';
comment on column public.game_state.player_1_state is 'Hand, bank, and properties for player 1.';
comment on column public.game_state.player_2_state is 'Hand, bank, and properties for player 2.';
comment on column public.game_state.draw_pile is 'Ordered array of deck card ids remaining to draw.';
comment on column public.game_state.discard_pile is 'Ordered array of discarded card ids (top = last).';

-- -----------------------------------------------------------------------------
-- Seed: 110 cards (exact list)
-- 47 action, 19 money, 28 property, 11 wildcard, 5 character
-- -----------------------------------------------------------------------------

insert into public.deck (name, type, value, "colorSet", "rentValues", effect)
select *
from (
  -- Action cards (47)
  select 'Geminio', 'action', 1, null::text, null::jsonb, 'Draw 2 cards'
  from generate_series(1, 10)
  union all
  select 'Accio - Red/Yellow', 'action', 1, 'Red/Yellow', null, 'Collect rent for red or yellow'
  from generate_series(1, 2)
  union all
  select 'Accio - Dark Blue/Dark Green', 'action', 1, 'Dark Blue/Dark Green', null, 'Collect rent for dark blue or dark green'
  from generate_series(1, 2)
  union all
  select 'Accio - Light Green/Black', 'action', 1, 'Light Green/Black', null, 'Collect rent for light green or black'
  from generate_series(1, 2)
  union all
  select 'Accio - Pink/Orange', 'action', 1, 'Pink/Orange', null, 'Collect rent for pink or orange'
  from generate_series(1, 2)
  union all
  select 'Accio - Brown/Light Blue', 'action', 1, 'Brown/Light Blue', null, 'Collect rent for brown or light blue'
  from generate_series(1, 2)
  union all
  select 'Alohomora', 'action', 2, null, null, 'Collect 2 points from each player'
  from generate_series(1, 3)
  union all
  select 'Reparo', 'action', 2, null, null, 'Take any 1 card from discard pile'
  from generate_series(1, 2)
  union all
  select 'Accio - Wild Any Color', 'action', 3, 'Any Color', null, 'Collect rent for any color'
  from generate_series(1, 3)
  union all
  select 'Stupefy', 'action', 3, null, null, 'Collect 5 points from any player'
  from generate_series(1, 3)
  union all
  select 'Confundo', 'action', 3, null, null, 'Swap 1 item with another player, cannot be from complete set'
  from generate_series(1, 3)
  union all
  select 'Levicorpus', 'action', 3, null, null, 'Steal 1 item from any player, cannot be from complete set'
  from generate_series(1, 3)
  union all
  select 'Wingardium Leviosa', 'action', 4, null, null, 'Force player to discard 1 item, cannot be from complete set'
  from generate_series(1, 3)
  union all
  select 'Protego', 'action', 4, null, null, 'Block a spell cast against you'
  from generate_series(1, 3)
  union all
  select 'Petrificus Totalus', 'action', 5, null, null, 'Place on character card to freeze ability, costs 10 points to reverse'
  from generate_series(1, 2)
  union all
  select 'Obliviate', 'action', 5, null, null, 'Steal a complete item set'
  from generate_series(1, 2)

  -- Money cards (19)
  union all
  select '1-Point', 'money', 1, null, null, null
  from generate_series(1, 6)
  union all
  select '2-Point', 'money', 2, null, null, null
  from generate_series(1, 5)
  union all
  select '3-Point', 'money', 3, null, null, null
  from generate_series(1, 3)
  union all
  select '4-Point', 'money', 4, null, null, null
  from generate_series(1, 2)
  union all
  select '5-Point', 'money', 5, null, null, null
  from generate_series(1, 2)
  union all
  select '10-Point', 'money', 10, null, null, null
  from generate_series(1, 1)

  -- Property cards (28)
  union all
  select * from (values
    ('Cat', 'property', 2, 'Black', '[1, 2, 3, 4]'::jsonb, null),
    ('Owl', 'property', 2, 'Black', '[1, 2, 3, 4]'::jsonb, null),
    ('Rat', 'property', 2, 'Black', '[1, 2, 3, 4]'::jsonb, null),
    ('Toad', 'property', 2, 'Black', '[1, 2, 3, 4]'::jsonb, null),
    ('Felix Felicis', 'property', 4, 'Dark Blue', '[3, 8]'::jsonb, null),
    ('Veritaserum', 'property', 4, 'Dark Blue', '[3, 8]'::jsonb, null),
    ('Pumpkin Juice', 'property', 1, 'Brown', '[1, 2]'::jsonb, null),
    ('Butterbeer', 'property', 1, 'Brown', '[1, 2]'::jsonb, null),
    ('Floo Powder', 'property', 2, 'Light Green', '[1, 2]'::jsonb, null),
    ('Portkey', 'property', 2, 'Light Green', '[1, 2]'::jsonb, null),
    ('Brass Scales', 'property', 2, 'Pink', '[1, 2, 4]'::jsonb, null),
    ('Dragon Hide Gloves', 'property', 2, 'Pink', '[1, 2, 4]'::jsonb, null),
    ('Cauldron', 'property', 2, 'Pink', '[1, 2, 4]'::jsonb, null),
    ('The Monster Book of Monsters', 'property', 2, 'Orange', '[1, 3, 5]'::jsonb, null),
    ('Hogwarts: A History', 'property', 2, 'Orange', '[1, 3, 5]'::jsonb, null),
    ('A Beginner''s Guide to Transfiguration', 'property', 2, 'Orange', '[1, 3, 5]'::jsonb, null),
    ('Sneakoscope', 'property', 3, 'Yellow', '[2, 4, 6]'::jsonb, null),
    ('Remembrall', 'property', 3, 'Yellow', '[2, 4, 6]'::jsonb, null),
    ('Omnioculars', 'property', 3, 'Yellow', '[2, 4, 6]'::jsonb, null),
    ('Snitch', 'property', 3, 'Red', '[2, 3, 6]'::jsonb, null),
    ('Bludger', 'property', 3, 'Red', '[2, 3, 6]'::jsonb, null),
    ('Quaffle', 'property', 3, 'Red', '[2, 3, 6]'::jsonb, null),
    ('Cauldron Cake', 'property', 1, 'Light Blue', '[1, 2, 3]'::jsonb, null),
    ('Chocolate Frog', 'property', 1, 'Light Blue', '[1, 2, 3]'::jsonb, null),
    ('Bertie Bott''s Every Flavor Beans', 'property', 1, 'Light Blue', '[1, 2, 3]'::jsonb, null),
    ('Aging Potion', 'property', 4, 'Dark Green', '[2, 4, 7]'::jsonb, null),
    ('Polyjuice Potion', 'property', 4, 'Dark Green', '[2, 4, 7]'::jsonb, null),
    ('Amortentia', 'property', 4, 'Dark Green', '[2, 4, 7]'::jsonb, null)
  ) as properties(name, type, value, "colorSet", "rentValues", effect)

  -- Wildcards (11)
  union all
  select 'Any Color', 'wildcard', 0, 'Any Color', null::jsonb, null
  from generate_series(1, 2)
  union all
  select 'Dark Green/Dark Blue', 'wildcard', 4, 'Dark Green/Dark Blue', null, null
  from generate_series(1, 1)
  union all
  select 'Black/Dark Green', 'wildcard', 4, 'Black/Dark Green', null, null
  from generate_series(1, 1)
  union all
  select 'Pink/Orange', 'wildcard', 2, 'Pink/Orange', null, null
  from generate_series(1, 2)
  union all
  select 'Brown/Light Blue', 'wildcard', 1, 'Brown/Light Blue', null, null
  from generate_series(1, 1)
  union all
  select 'Black/Light Blue', 'wildcard', 4, 'Black/Light Blue', null, null
  from generate_series(1, 1)
  union all
  select 'Red/Yellow', 'wildcard', 3, 'Red/Yellow', null, null
  from generate_series(1, 2)
  union all
  select 'Black/Light Green', 'wildcard', 2, 'Black/Light Green', null, null
  from generate_series(1, 1)

  -- Character cards (5)
  union all
  select * from (values
    ('Luna Lovegood', 'character', null::integer, null::text, null::jsonb, null::text),
    ('Harry Potter', 'character', null, null, null, null),
    ('Draco Malfoy', 'character', null, null, null, null),
    ('Cedric Diggory', 'character', null, null, null, null),
    ('Hermione Granger', 'character', null, null, null, null)
  ) as characters(name, type, value, "colorSet", "rentValues", effect)
) as cards(name, type, value, "colorSet", "rentValues", effect);

-- Guardrail: the deck must be exactly 110 cards.
do $$
declare
  card_count integer;
begin
  select count(*) into card_count from public.deck;
  if card_count <> 110 then
    raise exception 'deck seed expected 110 cards, found %', card_count;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Seed: singleton game row
-- -----------------------------------------------------------------------------

insert into public.game_state (
  id,
  player_1_state,
  player_2_state,
  draw_pile,
  discard_pile,
  current_turn
) values (
  1,
  '{
    "hand": [],
    "bank": [],
    "properties": {},
    "houseHotel": {},
    "name": "Player 1"
  }'::jsonb,
  '{
    "hand": [],
    "bank": [],
    "properties": {},
    "houseHotel": {},
    "name": "Player 2"
  }'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'player_1'
);

-- -----------------------------------------------------------------------------
-- Realtime (board state only)
-- -----------------------------------------------------------------------------

alter table public.game_state replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.game_state;
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- Grants + RLS (anonymous read/write for local development)
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.deck to anon, authenticated;
grant select, insert, update, delete on table public.game_state to anon, authenticated;

alter table public.deck enable row level security;
alter table public.game_state enable row level security;

drop policy if exists "anon_all_deck" on public.deck;
create policy "anon_all_deck"
  on public.deck
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_all_game_state" on public.game_state;
create policy "anon_all_game_state"
  on public.game_state
  for all
  to anon, authenticated
  using (true)
  with check (true);
