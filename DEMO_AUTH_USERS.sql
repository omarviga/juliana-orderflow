-- Demo users for login with no email confirmation flow
-- Replace this password once the demo ends.
-- Generic password for all users:
--   JulianaDemo2026!

create extension if not exists pgcrypto;

do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password text := 'JulianaDemo2026!';
  v_email text;
  v_role public.app_role;
  v_user_id uuid;
begin
  for v_email, v_role in
    values
      ('pau@julianacot.com', 'admin'::public.app_role),
      ('dany@julianacot.com', 'admin'::public.app_role),
      ('abu@julianacot.com', 'admin'::public.app_role),
      ('operador@julianacot.com', 'staff'::public.app_role)
  loop
    select id into v_user_id
    from auth.users
    where email = lower(v_email);

    if v_user_id is null then
      v_user_id := gen_random_uuid();

      insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
      )
      values (
        v_instance_id,
        v_user_id,
        'authenticated',
        'authenticated',
        lower(v_email),
        crypt(v_password, gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        now(),
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email)),
        'email',
        now(),
        now()
      )
      on conflict (provider_id, provider) do update
      set identity_data = excluded.identity_data,
          updated_at = now();
    else
      update auth.users
      set encrypted_password = crypt(v_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_user_id;
    end if;

    insert into public.user_profiles (user_id, email, role)
    values (v_user_id, lower(v_email), v_role)
    on conflict (user_id) do update
    set email = excluded.email,
        role = excluded.role;
  end loop;
end $$;

