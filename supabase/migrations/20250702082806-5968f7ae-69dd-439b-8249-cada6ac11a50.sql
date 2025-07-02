
-- Ajustar política de férias para 22 dias (legislação portuguesa)
UPDATE vacation_policies 
SET max_days_per_year = 22 
WHERE max_days_per_year = 30;

-- Ajustar saldos existentes de férias proporcionalmente
UPDATE vacation_balances 
SET total_days = 22,
    available_days = GREATEST(0, 22 - used_days)
WHERE total_days = 30;

-- Ajustar valores padrão para novos funcionários (na migração que cria saldos iniciais)
-- Atualizar a próxima inserção para usar 22 dias em vez de 30
UPDATE vacation_balances 
SET total_days = 22,
    available_days = 22
WHERE total_days = 30 AND used_days = 0;
