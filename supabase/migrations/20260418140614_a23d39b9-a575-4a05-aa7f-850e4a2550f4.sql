-- Tokens Google por usuário
create table if not exists public.user_google_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  access_token text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_google_tokens enable row level security;

create policy "Users manage their own google token"
  on public.user_google_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger update_user_google_tokens_updated_at
  before update on public.user_google_tokens
  for each row execute function public.update_updated_at_column();

-- Eventos da agenda
create table if not exists public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  google_event_id text,
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  categoria text not null default 'operacional' check (categoria in ('reuniao', 'operacional', 'pessoal', 'outro')),
  concluido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agenda_eventos enable row level security;

-- Usuário gerencia seus próprios eventos (CRUD completo)
create policy "Users manage their own events"
  on public.agenda_eventos
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admins e operadores veem todos os eventos
create policy "Admins and operators view all events"
  on public.agenda_eventos
  for select
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'operator')
  );

create trigger update_agenda_eventos_updated_at
  before update on public.agenda_eventos
  for each row execute function public.update_updated_at_column();

create index if not exists idx_agenda_eventos_user_id on public.agenda_eventos(user_id);
create index if not exists idx_agenda_eventos_data_inicio on public.agenda_eventos(data_inicio);