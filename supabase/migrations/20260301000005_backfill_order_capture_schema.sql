-- Backfill schema required by POS order capture ("Arma tu ensalada" included).
-- Safe to run on instances that are partially migrated.

create extension if not exists pgcrypto;

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

alter table public.orders add column if not exists customer_name text;
alter table public.order_items add column if not exists kitchen_note text;

create unique index if not exists products_category_normalized_name_uidx
  on public.products (category_id, lower(trim(name)));

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.ingredients enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_customizations enable row level security;

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
