
-- Habilita Row-Level Security nas tabelas de férias
ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_request_history ENABLE ROW LEVEL SECURITY;

-- Permite que:
-- Funcionário veja e crie apenas suas próprias solicitações; Admin vê todas

-- SELECT para vacation_requests: Funcionário vê as suas, admin todas
CREATE POLICY "Funcionário vê próprias solicitações ou Admin vê todas" 
ON vacation_requests
FOR SELECT
USING (
  employee_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- INSERT: Funcionário cria apenas para si mesmo
CREATE POLICY "Funcionário pode criar solicitação apenas para si" 
ON vacation_requests
FOR INSERT
WITH CHECK (employee_id = auth.uid());

-- UPDATE: Apenas admin pode aprovar/rejeitar
CREATE POLICY "Somente Admin pode atualizar solicitações" 
ON vacation_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- DELETE: Apenas admin pode deletar (opcional)
CREATE POLICY "Somente Admin pode deletar solicitações" 
ON vacation_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- vacation_balances: Cada funcionário vê seu próprio saldo e admin vê todos
CREATE POLICY "Funcionário vê saldo próprio ou Admin vê todos" 
ON vacation_balances
FOR SELECT
USING (
  employee_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- vacation_policies: Todos podem consultar (política global)
CREATE POLICY "Todos podem consultar políticas de férias" 
ON vacation_policies
FOR SELECT
USING (true);

-- vacation_request_history: Funcionário vê histórico próprio, admin todos
CREATE POLICY "Funcionário vê histórico próprio ou Admin vê todos" 
ON vacation_request_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM vacation_requests vr
    WHERE vr.id = vacation_request_id
      AND (vr.employee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
      )
  )
);

