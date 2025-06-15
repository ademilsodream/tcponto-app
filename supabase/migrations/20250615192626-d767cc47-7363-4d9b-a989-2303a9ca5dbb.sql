
-- 1. Insere política global padrão (caso nenhuma exista)
INSERT INTO vacation_policies (min_period_days, allow_retroactive, max_split, max_days_per_year)
SELECT 5, false, 3, 30
WHERE NOT EXISTS (SELECT 1 FROM vacation_policies);

-- 2. Cria saldos iniciais de férias para todos os funcionários ativos que ainda não têm registro em vacation_balances para o ano atual
INSERT INTO vacation_balances (employee_id, year, total_days, used_days, available_days)
SELECT p.id, EXTRACT(YEAR FROM CURRENT_DATE)::int, 30, 0, 30
FROM profiles p
WHERE p.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM vacation_balances vb
    WHERE vb.employee_id = p.id AND vb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int
  );

-- Pronto! Agora todos os funcionários ativos terão saldo inicial de férias para este ano.
