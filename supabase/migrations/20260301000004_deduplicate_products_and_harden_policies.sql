-- Cleanup duplicate products and prevent re-insertion of duplicates.
-- Keeps the oldest row per (category_id, normalized product name).

with ranked_products as (
  select
    id,
    category_id,
    lower(trim(name)) as normalized_name,
    row_number() over (
      partition by category_id, lower(trim(name))
      order by created_at asc, id asc
    ) as rn
  from public.products
),
duplicates as (
  select
    d.id as duplicate_id,
    k.id as keep_id
  from ranked_products d
  join ranked_products k
    on d.category_id = k.category_id
   and d.normalized_name = k.normalized_name
   and k.rn = 1
  where d.rn > 1
)
update public.order_items oi
set product_id = d.keep_id
from duplicates d
where oi.product_id = d.duplicate_id;

with ranked_products as (
  select
    id,
    row_number() over (
      partition by category_id, lower(trim(name))
      order by created_at asc, id asc
    ) as rn
  from public.products
)
delete from public.products p
using ranked_products rp
where p.id = rp.id
  and rp.rn > 1;

create unique index if not exists products_category_normalized_name_uidx
  on public.products (category_id, lower(trim(name)));

-- Ensure UPDATE policy includes WITH CHECK explicitly.
drop policy if exists "Products can be updated" on public.products;
create policy "Products can be updated"
  on public.products
  for update
  using (true)
  with check (true);
