
import React, { useMemo, useState } from "react";
import { useOptimizedAuth } from "@/contexts/OptimizedAuthContext";
import { Folder, FileText, Loader2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEmployeeDocuments } from "@/hooks/useEmployeeDocuments";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const iconsByType: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-6 h-6 text-red-600" />,
  doc: <FileText className="w-6 h-6 text-blue-600" />,
  docx: <FileText className="w-6 h-6 text-blue-600" />,
  xls: <FileText className="w-6 h-6 text-green-600" />,
  xlsx: <FileText className="w-6 h-6 text-green-600" />,
  default: <FileText className="w-6 h-6 text-gray-500" />,
};

function getFileExtension(filename: string) {
  if (!filename) return "default";
  const split = filename.split(".");
  return split.length > 1 ? split.pop()!.toLowerCase() : "default";
}

// Defina o nome do bucket usado para armazenar os arquivos dos documentos.
const BUCKET_NAME = "employee-documents"; // ajuste aqui se o bucket for diferente

export default function EmployeeDocuments() {
  const { user } = useOptimizedAuth();
  const employeeId = user?.id ?? "";
  const { documents, loading, error, refetch, markAsRead } = useEmployeeDocuments(employeeId);
  const { toast } = useToast();

  // Filtros e busca
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "read" | "unread">("all");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Extrai categorias diferentes
  const categories = useMemo(() => {
    const cats: string[] = [];
    documents.forEach((doc) => {
      if (doc.category && !cats.includes(doc.category)) cats.push(doc.category);
    });
    return cats;
  }, [documents]);

  // Busca e filtros
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch =
          doc.title.toLowerCase().includes(search.toLowerCase()) ||
          (doc.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
        const matchesStatus =
          filterStatus === "all"
            ? true
            : filterStatus === "read"
            ? doc.is_read
            : !doc.is_read;
        const matchesCategory =
          !filterCategory || doc.category === filterCategory;
        return matchesSearch && matchesStatus && matchesCategory;
      });
  }, [documents, search, filterStatus, filterCategory]);

  // Download e marcar como lido (corrigido)
  const handleDownload = async (doc: typeof documents[0]) => {
    try {
      // Usar BUCKET_NAME, file_path como path dentro do bucket
      const filePath = doc.file_path; // e.g., "employee-uuid/arquivo.pdf"
      if (!filePath) {
        toast({ title: "Erro", description: "Caminho do documento ausente.", variant: "destructive" });
        return;
      }
      // Debug: mostrar o bucket e o path que está sendo usado
      console.log("[DOCUMENT DOWNLOADER] Using bucket:", BUCKET_NAME, "| filePath:", filePath);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(filePath);

      if (error || !data) {
        toast({
          title: "Erro ao baixar",
          description: `Falha ao baixar do bucket '${BUCKET_NAME}'. Verifique se o bucket existe e se o arquivo está lá.`,
          variant: "destructive"
        });
        console.error("Erro ao baixar arquivo do Supabase Storage:", error, "BUCKET:", BUCKET_NAME, "file_path:", filePath);
        return;
      }

      // download retorna Blob (no browser)
      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      await markAsRead(doc.id);
      toast({ title: "Download concluído", description: "Documento baixado e marcado como lido." });
    } catch (e: any) {
      toast({ title: "Erro", description: "Falha ao baixar documento.", variant: "destructive" });
      console.error("Exceção ao baixar arquivo:", e);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full mt-8 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Folder className="w-8 h-8 text-blue-600" />
          <CardTitle className="text-lg">Meus Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-center gap-2 mb-4">
            <Input
              placeholder="Buscar documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lg:w-1/2"
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
            >
              <option value="all">Todos</option>
              <option value="unread">Não lidos</option>
              <option value="read">Lidos</option>
            </select>
            {categories.length > 0 && (
              <select
                className="border rounded px-2 py-1 text-sm"
                value={filterCategory || ""}
                onChange={e => setFilterCategory(e.target.value || null)}
              >
                <option value="">Todas categorias</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
          {loading && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin w-6 h-6 mr-2" /> Carregando documentos...
            </div>
          )}
          {error && (
            <div className="text-red-500">{error}</div>
          )}
          {!loading && filteredDocuments.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">Nenhum documento encontrado.</div>
          )}
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="border p-3 rounded-lg bg-white shadow flex gap-3 items-center">
                <div>
                  {iconsByType[getFileExtension(doc.file_name)] ?? iconsByType.default}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{doc.title}</div>
                  <div className="text-xs text-gray-600">{doc.category || "Sem categoria"}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(doc.uploaded_at).toLocaleDateString()} 
                    {doc.expires_at && (
                      <>
                        {" "}
                        <span className="ml-2 text-orange-600">(Expira: {new Date(doc.expires_at).toLocaleDateString()})</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-gray-700 line-clamp-2">
                    {doc.description}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {!doc.is_read && (
                    <Badge className="bg-blue-500 text-white">Novo</Badge>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} title="Baixar documento">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
