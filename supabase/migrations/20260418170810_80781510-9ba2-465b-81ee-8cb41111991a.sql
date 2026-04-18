alter table public.agenda_eventos
add column if not exists participantes text[] not null default '{}';