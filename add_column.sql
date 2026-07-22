-- Adicionar coluna withdrawal_id à tabela salary_payments
alter table public.salary_payments
add column if not exists withdrawal_id uuid references public.withdrawals(id) on delete set null;
