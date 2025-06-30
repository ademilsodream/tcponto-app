
-- Criar tabela para solicitações de vale salarial
CREATE TABLE public.salary_advance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES auth.users NOT NULL,
  requested_amount NUMERIC(10,2) NOT NULL CHECK (requested_amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_amount NUMERIC(10,2),
  admin_notes TEXT,
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para histórico de solicitações
CREATE TABLE public.salary_advance_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salary_advance_id UUID REFERENCES public.salary_advance_requests(id) NOT NULL,
  action TEXT NOT NULL,
  action_by UUID REFERENCES auth.users,
  action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_amount NUMERIC(10,2),
  new_amount NUMERIC(10,2),
  notes TEXT
);

-- Habilitar Row Level Security
ALTER TABLE public.salary_advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advance_history ENABLE ROW LEVEL SECURITY;

-- Política para salary_advance_requests: funcionário vê apenas suas próprias solicitações
CREATE POLICY "Funcionário vê próprias solicitações de vale" 
ON public.salary_advance_requests
FOR SELECT
USING (employee_id = auth.uid());

-- Política para inserir: funcionário pode criar apenas para si mesmo
CREATE POLICY "Funcionário pode criar solicitação para si" 
ON public.salary_advance_requests
FOR INSERT
WITH CHECK (employee_id = auth.uid());

-- Política para histórico: funcionário vê apenas histórico de suas solicitações
CREATE POLICY "Funcionário vê histórico próprio" 
ON public.salary_advance_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.salary_advance_requests sar
    WHERE sar.id = salary_advance_history.salary_advance_id 
    AND sar.employee_id = auth.uid()
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_salary_advance_requests_updated_at 
  BEFORE UPDATE ON public.salary_advance_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir algumas configurações do sistema para limites
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('salary_advance_min_amount', '100.00', 'Valor mínimo para solicitação de vale salarial em R$'),
('salary_advance_max_amount', '2000.00', 'Valor máximo para solicitação de vale salarial em R$')
ON CONFLICT (setting_key) DO NOTHING;
