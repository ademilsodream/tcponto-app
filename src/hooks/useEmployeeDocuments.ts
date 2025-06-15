
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EmployeeDocument {
  id: string;
  title: string;
  description?: string;
  file_name: string;
  file_type: string;
  file_path: string;
  uploaded_at: string;
  category?: string;
  is_read?: boolean;
  read_at?: string;
  expires_at?: string;
}

export function useEmployeeDocuments(employeeId: string | undefined | null) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDocuments = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("employee_documents")
      .select("*")
      .eq("employee_id", employeeId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      setError("Erro ao buscar documentos.");
      setLoading(false);
      return;
    }
    setDocuments(data as EmployeeDocument[]);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Marcar documento como lido
  const markAsRead = useCallback(async (docId: string) => {
    if (!employeeId) return;
    // Só fazer se ainda não lido
    const doc = documents.find((d) => d.id === docId);
    if (!doc || doc.is_read) return;
    await supabase
      .from("employee_documents")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", docId);
    // Refaz fetch rápido para atualizar UI
    setDocuments((docs) =>
      docs.map((d) =>
        d.id === docId ? { ...d, is_read: true, read_at: new Date().toISOString() } : d
      )
    );
  }, [employeeId, documents]);

  return { documents, loading, error, refetch: fetchDocuments, markAsRead };
}

