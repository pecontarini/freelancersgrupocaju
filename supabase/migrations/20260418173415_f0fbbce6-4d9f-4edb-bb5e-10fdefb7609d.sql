-- Tabela de parcerias entre setores (lojas casadas)
create table if not exists public.sector_partnerships (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectors(id) on delete cascade,
  partner_sector_id uuid not null references public.sectors(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique(sector_id, partner_sector_id),
  check(sector_id <> partner_sector_id)
);

-- Índices para lookup rápido
create index if not exists idx_sector_partnerships_sector on public.sector_partnerships(sector_id);
create index if not exists idx_sector_partnerships_partner on public.sector_partnerships(partner_sector_id);

alter table public.sector_partnerships enable row level security;

-- Admin e Operator podem fazer tudo
create policy "Admin/operator gerenciam parcerias"
  on public.sector_partnerships
  for all
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'operator')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'operator')
  );

-- Demais usuários autenticados podem ler (necessário para grid de escalas funcionar)
create policy "Usuários autenticados leem parcerias"
  on public.sector_partnerships
  for select
  to authenticated
  using (true);