-- Enable RLS on employee_documents table
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own documents
CREATE POLICY "Users can view their own documents" ON public.employee_documents
    FOR SELECT USING (auth.uid() = employee_id);

-- Policy for users to insert their own documents
CREATE POLICY "Users can insert their own documents" ON public.employee_documents
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

-- Policy for users to update their own documents (for marking as read)
CREATE POLICY "Users can update their own documents" ON public.employee_documents
    FOR UPDATE USING (auth.uid() = employee_id);

-- Policy for users to delete their own documents (optional)
CREATE POLICY "Users can delete their own documents" ON public.employee_documents
    FOR DELETE USING (auth.uid() = employee_id);

-- Policy for admins to view all documents (if needed)
-- Uncomment if you want admins to see all documents
-- CREATE POLICY "Admins can view all documents" ON public.employee_documents
--     FOR SELECT USING (
--         EXISTS (
--             SELECT 1 FROM public.profiles 
--             WHERE id = auth.uid() AND role = 'admin'
--         )
--     );

-- Create bucket policy for employee-documents storage
-- This allows users to upload files to their own folder
INSERT INTO storage.buckets (id, name, public) 
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy for users to upload files to their own folder
CREATE POLICY "Users can upload to their own folder" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'employee-documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy for users to view files in their own folder
CREATE POLICY "Users can view files in their own folder" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'employee-documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy for users to update files in their own folder
CREATE POLICY "Users can update files in their own folder" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'employee-documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy for users to delete files in their own folder
CREATE POLICY "Users can delete files in their own folder" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'employee-documents' 
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
