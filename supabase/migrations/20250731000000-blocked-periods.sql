-- Criar tabela para períodos bloqueados
CREATE TABLE public.blocked_periods (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text null,
  start_date date not null,
  end_date date not null,
  created_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint blocked_periods_pkey primary key (id)
) TABLESPACE pg_default;

-- Habilitar Row Level Security
ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;

-- Política para visualização: todos os usuários autenticados podem ver períodos bloqueados
CREATE POLICY "Authenticated users can view blocked periods" 
ON public.blocked_periods
FOR SELECT
TO authenticated
USING (true);

-- Política para inserção: apenas admins podem criar períodos bloqueados
CREATE POLICY "Admins can create blocked periods" 
ON public.blocked_periods
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para atualização: apenas admins podem atualizar períodos bloqueados
CREATE POLICY "Admins can update blocked periods" 
ON public.blocked_periods
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Política para exclusão: apenas admins podem deletar períodos bloqueados
CREATE POLICY "Admins can delete blocked periods" 
ON public.blocked_periods
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Índice para melhorar performance de consultas por data
CREATE INDEX idx_blocked_periods_dates 
ON public.blocked_periods (start_date, end_date);

-- Índice para consultas por criador
CREATE INDEX idx_blocked_periods_created_by 
ON public.blocked_periods (created_by);

-- Comentários na tabela
COMMENT ON TABLE public.blocked_periods IS 'Períodos bloqueados para edição de registros de ponto';
COMMENT ON COLUMN public.blocked_periods.name IS 'Nome do período bloqueado';
COMMENT ON COLUMN public.blocked_periods.description IS 'Descrição opcional do período';
COMMENT ON COLUMN public.blocked_periods.start_date IS 'Data de início do período bloqueado';
COMMENT ON COLUMN public.blocked_periods.end_date IS 'Data de fim do período bloqueado';
COMMENT ON COLUMN public.blocked_periods.created_by IS 'ID do usuário que criou o período bloqueado';
COMMENT ON COLUMN public.blocked_periods.created_at IS 'Data e hora de criação do registro';

-- Habilitar realtime para blocked_periods
ALTER TABLE public.blocked_periods REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_periods; 