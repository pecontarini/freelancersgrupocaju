insert into public.user_stores (user_id, loja_id)
select '3daa96e9-da3c-4225-bb8d-e57bc89dbe18', id from public.config_lojas
where tenant_id = '72221fb6-f60d-4db8-aed9-fe73f248ecb6'
on conflict do nothing;

update public.profiles set full_name = coalesce(nullif(full_name,'samira.costa@b2hr.com'),'Samira Costa'), unidade_id = 'e2ad5403-dcfb-4a70-a9cc-15106bb348f5'
where user_id = '3daa96e9-da3c-4225-bb8d-e57bc89dbe18';