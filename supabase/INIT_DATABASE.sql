-- Juliana Orderflow - Supabase bootstrap script
-- Safe to run on a new project and re-run (idempotent where possible).

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'staff');
  end if;
end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name text not null,
  description text,
  price decimal(10,2),
  is_customizable boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_sizes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  name text not null,
  price decimal(10,2) not null,
  display_order int not null default 0
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('proteina', 'topping', 'crocante', 'aderezo')),
  name text not null,
  is_premium boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number serial,
  total decimal(10,2) not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'cancelado')),
  customer_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_size_id uuid references public.product_sizes(id),
  quantity int not null default 1,
  unit_price decimal(10,2) not null,
  subtotal decimal(10,2) not null,
  custom_label text,
  kitchen_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_item_customizations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id),
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric not null default 0,
  closing_amount numeric,
  expected_amount numeric,
  difference numeric,
  opening_denominations jsonb,
  closing_denominations jsonb,
  notes text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create unique index if not exists products_category_normalized_name_uidx
  on public.products (category_id, lower(trim(name)));

alter table public.orders add column if not exists customer_name text;
alter table public.order_items add column if not exists kitchen_note text;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.ingredients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_customizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.cash_register_sessions enable row level security;

drop policy if exists "Categories are publicly readable" on public.categories;
drop policy if exists "Categories can be inserted" on public.categories;
create policy "Categories are publicly readable" on public.categories for select using (true);
create policy "Categories can be inserted" on public.categories for insert with check (true);

drop policy if exists "Products are publicly readable" on public.products;
drop policy if exists "Products can be inserted" on public.products;
drop policy if exists "Products can be updated" on public.products;
create policy "Products are publicly readable" on public.products for select using (true);
create policy "Products can be inserted" on public.products for insert with check (true);
create policy "Products can be updated" on public.products for update using (true) with check (true);

drop policy if exists "Product sizes are publicly readable" on public.product_sizes;
create policy "Product sizes are publicly readable" on public.product_sizes for select using (true);

drop policy if exists "Ingredients are publicly readable" on public.ingredients;
create policy "Ingredients are publicly readable" on public.ingredients for select using (true);

drop policy if exists "Orders are publicly readable" on public.orders;
drop policy if exists "Orders can be inserted" on public.orders;
drop policy if exists "Orders can be updated" on public.orders;
create policy "Orders are publicly readable" on public.orders for select using (true);
create policy "Orders can be inserted" on public.orders for insert with check (true);
create policy "Orders can be updated" on public.orders for update using (true) with check (true);

drop policy if exists "Order items are publicly readable" on public.order_items;
drop policy if exists "Order items can be inserted" on public.order_items;
create policy "Order items are publicly readable" on public.order_items for select using (true);
create policy "Order items can be inserted" on public.order_items for insert with check (true);

drop policy if exists "Customizations are publicly readable" on public.order_item_customizations;
drop policy if exists "Customizations can be inserted" on public.order_item_customizations;
create policy "Customizations are publicly readable" on public.order_item_customizations for select using (true);
create policy "Customizations can be inserted" on public.order_item_customizations for insert with check (true);

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Cash sessions are publicly readable" on public.cash_register_sessions;
drop policy if exists "Cash sessions can be inserted" on public.cash_register_sessions;
drop policy if exists "Cash sessions can be updated" on public.cash_register_sessions;
create policy "Cash sessions are publicly readable" on public.cash_register_sessions for select using (true);
create policy "Cash sessions can be inserted" on public.cash_register_sessions for insert with check (true);
create policy "Cash sessions can be updated" on public.cash_register_sessions for update using (true) with check (true);

-- Seed: categories expected by app
insert into public.categories (name, display_order)
select
  'Baguettes',
  coalesce((select display_order + 1 from public.categories where name = 'Sándwiches' limit 1),
           (select max(display_order) + 1 from public.categories),
           0)
where not exists (select 1 from public.categories where lower(name) = 'baguettes');

insert into public.categories (name, display_order)
select 'Extras', coalesce((select max(display_order) + 1 from public.categories), 0)
where not exists (select 1 from public.categories where lower(name) = 'extras');

insert into public.categories (name, display_order)
select 'Postres', coalesce((select max(display_order) + 1 from public.categories), 0)
where not exists (select 1 from public.categories where lower(name) = 'postres');

-- Seed: baguettes
insert into public.products (category_id, name, price, is_customizable, display_order)
select c.id, v.name, v.price, false, v.display_order
from (
  values
    ('Baguette Pavo y Panela', 85.00::decimal(10,2), 1),
    ('Baguette Serrano y Queso', 110.00::decimal(10,2), 2),
    ('Baguette Healthy', 75.00::decimal(10,2), 3),
    ('Baguette Roast Beef', 110.00::decimal(10,2), 4),
    ('Baguette Garlic Grill Cheese', 75.00::decimal(10,2), 5)
) as v(name, price, display_order)
join (
  select id
  from public.categories
  where lower(name) = 'baguettes'
  limit 1
) c on true
where not exists (
  select 1
  from public.products p
  where p.name = v.name
);

-- Seed: product used for standalone extras
insert into public.products (category_id, name, price, is_customizable, display_order)
select c.id, 'Extra suelto', 0.00, false, 1
from (
  select id
  from public.categories
  where lower(name) = 'extras'
  order by display_order asc
  limit 1
) c
where not exists (select 1 from public.products where lower(name) = 'extra suelto');
