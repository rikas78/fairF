-- FairReward 50/50 - Schema Supabase
-- Esegui questo file nel SQL Editor di Supabase.

create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nickname text,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  title text not null,
  partner_url text not null,
  partner_type text not null default 'cpalead',
  quota_total numeric(12,2) not null default 0,
  net_reward numeric(12,2) not null default 0,
  hold_hours int not null default 24,
  highlight boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_id text not null,
  idempotency_key text unique not null,
  subid text,
  stake numeric(12,2) not null default 0,
  net_reward numeric(12,2) not null default 0,
  status text not null default 'pending',  -- pending | completed | failed
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Rendi lo schema idempotented: se la tabella esisteva già da una migrazione precedente,
-- aggiungi le colonne mancanti senza ricreare la tabella.
alter table transactions add column if not exists subid text;
alter table transactions add column if not exists completed_at timestamptz;

create index if not exists idx_tx_user on transactions(user_id);
create index if not exists idx_tx_subid on transactions(subid);

-- Seed dei task (fonte unica per card e modale)
insert into tasks (id, title, partner_url, partner_type, quota_total, net_reward, highlight, sort_order) values
 ('task-revolut','Revolut: Conto & 5 Spese','https://revolut.com/referral/?referral-code=riccardo_a78!SEP1-26-AR&geo-redirect','revolut',5.00,20.00,true,1),
 ('task-prime','Prime Video: Prova Gratuita','https://www.mobilerewards.link/view.php?id=5545891&pub=3358864','cpalead',0.50,1.50,false,2),
 ('task-xm','XM: App Trading','https://www.qckclk.com/view.php?id=5544825&pub=3358864','cpalead',1.00,3.00,false,3),
 ('task-ryb','Rybit: Iscrizione','https://www.cdnflyer.com/view.php?id=5546537&pub=3358864','cpalead',1.50,4.00,false,4)
on conflict (id) do nothing;