-- Seed defaults required by "Arma tu Ensalada" and house salad extras.
-- Idempotent: safe to run multiple times.

-- Ensure required categories exist.
insert into public.categories (name, display_order)
select
  'Ensaladas de la casa',
  coalesce((select max(display_order) + 1 from public.categories), 0)
where not exists (
  select 1
  from public.categories
  where lower(trim(name)) = 'ensaladas de la casa'
);

insert into public.categories (name, display_order)
select
  'Arma tu Ensalada',
  coalesce(
    (select display_order + 1 from public.categories where lower(trim(name)) = 'ensaladas de la casa' limit 1),
    (select max(display_order) + 1 from public.categories),
    0
  )
where not exists (
  select 1
  from public.categories
  where lower(trim(name)) = 'arma tu ensalada'
);

-- Seed customizable product for salad builder.
insert into public.products (category_id, name, price, is_customizable, display_order)
select c.id, 'Arma tu Ensalada', null, true, 1
from (
  select id
  from public.categories
  where lower(trim(name)) = 'arma tu ensalada'
  order by display_order asc
  limit 1
) c
where not exists (
  select 1
  from public.products p
  where p.category_id = c.id
    and lower(trim(p.name)) = 'arma tu ensalada'
);

-- Seed sizes for the customizable salad product.
insert into public.product_sizes (product_id, name, price, display_order)
select p.id, s.name, s.price, s.display_order
from (
  values
    ('Mediana', 110.00::decimal(10,2), 1),
    ('Grande', 125.00::decimal(10,2), 2)
) as s(name, price, display_order)
join (
  select id
  from public.products
  where lower(trim(name)) = 'arma tu ensalada'
  order by created_at asc
  limit 1
) p on true
where not exists (
  select 1
  from public.product_sizes ps
  where ps.product_id = p.id
    and lower(trim(ps.name)) = lower(trim(s.name))
);

-- Seed "Ensaladas de la casa" products if missing.
insert into public.products (category_id, name, price, is_customizable, display_order)
select c.id, v.name, v.price, false, v.display_order
from (
  values
    ('Clásica', 128.00::decimal(10,2), 1),
    ('Del Huerto', 128.00::decimal(10,2), 2),
    ('Rústica', 128.00::decimal(10,2), 3),
    ('Jardinera', 128.00::decimal(10,2), 4)
) as v(name, price, display_order)
join (
  select id
  from public.categories
  where lower(trim(name)) = 'ensaladas de la casa'
  order by display_order asc
  limit 1
) c on true
where not exists (
  select 1
  from public.products p
  where p.category_id = c.id
    and lower(trim(p.name)) = lower(trim(v.name))
);

-- Seed ingredients used by both custom and extras flows.
insert into public.ingredients (type, name, is_premium, display_order)
select v.type, v.name, v.is_premium, v.display_order
from (
  values
    -- Proteinas
    ('proteina', 'Pollo', false, 1),
    ('proteina', 'Pollo del día', false, 2),
    ('proteina', 'Huevo cocido', false, 3),
    ('proteina', 'Queso panela', false, 4),
    ('proteina', 'Atún', false, 5),
    ('proteina', 'Salmón', true, 6),
    ('proteina', 'Jamón serrano', true, 7),
    ('proteina', 'Roast beef', true, 8),

    -- Toppings
    ('topping', 'Espinaca', false, 20),
    ('topping', 'Zanahoria', false, 21),
    ('topping', 'Champiñón', false, 22),
    ('topping', 'Aceituna negra', false, 23),
    ('topping', 'Jitomate cherry', false, 24),
    ('topping', 'Brócoli', false, 25),
    ('topping', 'Pasta fussili', false, 26),
    ('topping', 'Pepino persa', false, 27),
    ('topping', 'Pimientos', false, 28),
    ('topping', 'Piña en almíbar', false, 29),
    ('topping', 'Elote', false, 30),
    ('topping', 'Fresa', false, 31),
    ('topping', 'Apio', false, 32),
    ('topping', 'Cebolla morada', false, 33),
    ('topping', 'Queso feta', true, 34),
    ('topping', 'Queso manchego', true, 35),
    ('topping', 'Queso de cabra', true, 36),
    ('topping', 'Queso parmesano', true, 37),
    ('topping', 'Tocino', true, 38),

    -- Crocantes
    ('crocante', 'Crutones', false, 50),
    ('crocante', 'Pepita tostada', false, 51),
    ('crocante', 'Almendra fileteada', false, 52),

    -- Aderezos
    ('aderezo', 'Ranch', false, 70),
    ('aderezo', 'César', false, 71),
    ('aderezo', 'Balsámico', false, 72),
    ('aderezo', 'Mostaza miel', false, 73),
    ('aderezo', 'Vinagreta de la casa', false, 74)
) as v(type, name, is_premium, display_order)
where not exists (
  select 1
  from public.ingredients i
  where i.type = v.type
    and lower(trim(i.name)) = lower(trim(v.name))
);
