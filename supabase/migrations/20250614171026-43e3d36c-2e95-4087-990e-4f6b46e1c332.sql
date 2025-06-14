
-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow read access to all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to modify profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.profiles;

-- Habilitar RLS e criar políticas para time_records
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes de time_records se houver
DROP POLICY IF EXISTS "Employees can view their own time records" ON public.time_records;
DROP POLICY IF EXISTS "Employees can create their own time records" ON public.time_records;
DROP POLICY IF EXISTS "Employees can update their own time records" ON public.time_records;
DROP POLICY IF EXISTS "Admins can view all time records" ON public.time_records;

-- Políticas para time_records
CREATE POLICY "Employees can view their own time records" 
ON public.time_records 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Employees can create their own time records" 
ON public.time_records 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Employees can update their own time records" 
ON public.time_records 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all time records" 
ON public.time_records 
FOR ALL 
TO authenticated 
USING (public.get_current_user_role() = 'admin');

-- Políticas para profiles (usando a função security definer existente)
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
TO authenticated 
USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Allow profile creation during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Habilitar RLS para allowed_locations
ALTER TABLE public.allowed_locations ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes de allowed_locations se houver
DROP POLICY IF EXISTS "Authenticated users can view active locations" ON public.allowed_locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON public.allowed_locations;

CREATE POLICY "Authenticated users can view active locations" 
ON public.allowed_locations 
FOR SELECT 
TO authenticated 
USING (is_active = true);

CREATE POLICY "Admins can manage locations" 
ON public.allowed_locations 
FOR ALL 
TO authenticated 
USING (public.get_current_user_role() = 'admin');

-- Habilitar RLS para edit_requests
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes de edit_requests se houver
DROP POLICY IF EXISTS "Employees can view their own edit requests" ON public.edit_requests;
DROP POLICY IF EXISTS "Employees can create their own edit requests" ON public.edit_requests;
DROP POLICY IF EXISTS "Admins can view all edit requests" ON public.edit_requests;

CREATE POLICY "Employees can view their own edit requests" 
ON public.edit_requests 
FOR SELECT 
TO authenticated 
USING (auth.uid() = employee_id);

CREATE POLICY "Employees can create their own edit requests" 
ON public.edit_requests 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Admins can view all edit requests" 
ON public.edit_requests 
FOR ALL 
TO authenticated 
USING (public.get_current_user_role() = 'admin');

-- Habilitar realtime para time_records (para sincronização em tempo real)
ALTER TABLE public.time_records REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_records;

-- Habilitar realtime para profiles
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
