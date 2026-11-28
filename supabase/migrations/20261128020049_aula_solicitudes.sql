create table public.aula_solicitudes (
  id uuid primary key,
  alumno uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('Crédito de práctica','Activación de plan de práctica','Retiro de práctica')),
  importe numeric(14,2) not null check (importe > 0 and importe <= 1000000000),
  creada timestamptz not null default now()
);
create index aula_solicitudes_por_alumno on public.aula_solicitudes (alumno, creada desc);
alter table public.aula_solicitudes enable row level security;
revoke all on public.aula_solicitudes from public, anon, authenticated;
grant select on public.aula_solicitudes to authenticated;
grant insert (id,tipo,importe) on public.aula_solicitudes to authenticated;
create policy leer_propias on public.aula_solicitudes for select to authenticated using (alumno = (select auth.uid()));
create policy crear_propias on public.aula_solicitudes for insert to authenticated with check (alumno = (select auth.uid()));
grant select on public.aula_solicitudes to service_role;
