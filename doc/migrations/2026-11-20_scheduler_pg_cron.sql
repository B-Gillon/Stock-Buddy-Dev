-- Database scheduler: pg_cron ticks every minute and calls the app for each enabled job that is due.
-- The login secret (vault 'cron_secret') is generated in the database and checked via scheduler_check_secret();
-- the app URL (vault 'app_url') must be changed when this is applied to another project.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.scheduled_jobs (
  job_key text primary key,
  path text not null,
  enabled boolean not null default true,
  interval_minutes int not null check (interval_minutes between 5 and 1440),
  last_triggered_at timestamptz,
  running_since timestamptz,
  last_finished_at timestamptz,
  last_status text,
  last_message text,
  last_trigger text,
  updated_at timestamptz not null default now()
);
alter table public.scheduled_jobs enable row level security;

insert into public.scheduled_jobs (job_key, path, enabled, interval_minutes) values
  ('ship_file_pickup', '/api/cron/ship-file-pickup', true, 15),
  ('sftp_status',      '/api/cron/sftp-status',      true, 60),
  ('ack_reminders',    '/api/cron/ack-reminders',    true, 60)
on conflict (job_key) do nothing;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'Login the database scheduler uses to call the app');
  end if;
  if not exists (select 1 from vault.secrets where name = 'app_url') then
    perform vault.create_secret('https://stock-buddy-dev.brandongillon.com', 'app_url', 'Base URL of the app that the scheduler calls');
  end if;
end $$;

create or replace function public.scheduler_check_secret(candidate text) returns boolean
language sql security definer set search_path = public, vault as $$
  select candidate is not null and length(candidate) >= 32
     and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = candidate);
$$;

create or replace function public.scheduler_status() returns jsonb
language sql security definer set search_path = public, vault, cron as $$
  select jsonb_build_object(
    'secret_set', exists (select 1 from vault.secrets where name = 'cron_secret'),
    'app_url', (select decrypted_secret from vault.decrypted_secrets where name = 'app_url'),
    'tick_scheduled', exists (select 1 from cron.job where jobname = 'scheduled-jobs-tick' and active),
    'last_tick_at', (select max(d.start_time) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'scheduled-jobs-tick')
  );
$$;

create or replace function public.run_due_scheduled_jobs() returns void
language plpgsql security definer set search_path = public, vault, net as $$
declare j record; base text; secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or secret is null then return; end if;
  for j in
    select * from public.scheduled_jobs
    where enabled and (last_triggered_at is null or last_triggered_at + make_interval(mins => interval_minutes) <= now() + interval '30 seconds')
    for update skip locked
  loop
    perform net.http_post(
      url := base || j.path,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json', 'X-Trigger', 'schedule'),
      timeout_milliseconds := 60000
    );
    update public.scheduled_jobs set last_triggered_at = now() where job_key = j.job_key;
  end loop;
end $$;

revoke all on function public.scheduler_check_secret(text), public.scheduler_status(), public.run_due_scheduled_jobs() from public, anon, authenticated;
grant execute on function public.scheduler_check_secret(text), public.scheduler_status(), public.run_due_scheduled_jobs() to service_role;

select cron.schedule('scheduled-jobs-tick', '* * * * *', $$select public.run_due_scheduled_jobs()$$);
