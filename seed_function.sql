-- Função para semear dados padrão (executar apenas se necessário)
create or replace function public.seed_default_data()
returns jsonb
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from public.sectors limit 1) then
    insert into public.sectors (name, color, icon) values
      ('Vendas', '#1a8a5c', 'store'),
      ('Serviços', '#d4a843', 'wrench'),
      ('Consultoria', '#3498db', 'handshake'),
      ('Produtos', '#9b59b6', 'gem');
  end if;
  if not exists (select 1 from public.rules limit 1) then
    insert into public.rules (name, percentage, color) values
      ('Fundos Pessoal', 35, '#1a8a5c'),
      ('Fundos de Investimento', 30, '#d4a843'),
      ('Fundos de Caixa da Empresa', 35, '#3498db');
  end if;
  return jsonb_build_object('success', true);
end;
$$;
