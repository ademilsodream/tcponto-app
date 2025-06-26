
-- Remover a política RLS atual que está incorreta
DROP POLICY IF EXISTS "Users can view announcements sent to them" ON announcements;

-- Criar a política RLS correta
CREATE POLICY "Users can view announcements sent to them" 
ON announcements 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM announcement_recipients ar 
    WHERE ar.announcement_id = announcements.id 
    AND ar.employee_id = auth.uid()
  )
);
