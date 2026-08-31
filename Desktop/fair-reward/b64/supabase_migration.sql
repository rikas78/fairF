-- STREAMING_CHUNK:Setting up database schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  level TEXT,
  kyc_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  required_quota NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_reward NUMERIC(14,2) NOT NULL DEFAULT 0,
  cofinancing_allowed BOOLEAN DEFAULT false,
  partner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE TABLE IF NOT EXISTS user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  status TEXT NOT NULL,
  user_quota NUMERIC(14,2) DEFAULT 0,
  fr_quota NUMERIC(14,2) DEFAULT 0,
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE UNIQUE INDEX IF NOT EXISTS ux_user_tasks_idempotency ON user_tasks(idempotency_key) WHERE idempotency_key IS NOT NULL;CREATE TABLE IF NOT EXISTS cofinancing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_task_id UUID NOT NULL REFERENCES user_tasks(id),
  fr_amount NUMERIC(14,2) DEFAULT 0,
  user_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE TABLE IF NOT EXISTS fr_liquidity (
  id INT PRIMARY KEY DEFAULT 1,
  available_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now());CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT,
  action TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now());INSERT INTO fr_liquidity(id, available_amount) VALUES (1, 3000.00)ON CONFLICT (id) DO UPDATE SET available_amount = EXCLUDED.available_amount;