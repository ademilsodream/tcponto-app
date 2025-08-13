import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, X, Loader2, FileText } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { supabase } from '../integrations/supabase/client';
import { useOptimizedAuth } from '../contexts/OptimizedAuthContext';

const categories = [
  "Contrato",
  "Recibo de Vencimento", 
  "Comunicado",
  "Faturas",
  "Recibo Verde",
];

interface DocumentUploadDialogProps {
  onUploadSuccess: () => void;
}

export const DocumentUploadDialog: React.FC<DocumentUploadDialogProps> = ({ onUploadSuccess }) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const { toast } = useToast();
  const { user } = useOptimizedAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo de arquivo não suportado",
          description: "Por favor, selecione um arquivo PDF, DOC, DOCX, XLS ou XLSX.",
          variant: "destructive"
        });
        return;
      }

      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB.",
          variant: "destructive"
        });
        return;
      }

      setSelectedFile(file);
      // Auto-preencher título se estiver vazio
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, "")); // Remove extensão
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !title || !category || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);

      // Gerar nome único para o arquivo
      const timestamp = Date.now();
      const fileExtension = selectedFile.name.split('.').pop();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        toast({
          title: "Erro no upload",
          description: "Falha ao fazer upload do arquivo.",
          variant: "destructive"
        });
        return;
      }

      // Salvar informações na tabela employee_documents
      const { error: dbError } = await supabase
        .from('employee_documents')
        .insert({
          employee_id: user.id,
          title: title,
          description: description,
          category: category,
          file_name: selectedFile.name,
          file_path: filePath,
          file_type: selectedFile.type,
          file_size: selectedFile.size.toString(),
          uploaded_by: user.id,
          is_read: false
        });

      if (dbError) {
        console.error('Erro ao salvar no banco:', dbError);
        toast({
          title: "Erro ao salvar",
          description: "Falha ao salvar informações do documento.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sucesso!",
        description: "Documento enviado com sucesso.",
      });

      // Limpar formulário
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setCategory('');
      setOpen(false);
      
      // Notificar componente pai
      onUploadSuccess();

    } catch (error) {
      console.error('Erro geral:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setCategory('');
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <Button className="h-12 px-6 text-base font-semibold bg-blue-600 hover:bg-blue-700">
          <Upload className="w-5 h-5 mr-2" />
          Enviar Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Enviar Documento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Seleção de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="file" className="text-base font-medium">Arquivo *</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              <input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label htmlFor="file" className="cursor-pointer">
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-6 h-6 text-blue-600" />
                      <span className="font-medium">{selectedFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedFile(null);
                        }}
                        className="p-1 h-6 w-6"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 mx-auto text-gray-400" />
                    <p className="text-base font-medium">Clique para selecionar arquivo</p>
                    <p className="text-sm text-gray-500">
                      PDF, DOC, DOCX, XLS, XLSX (máx. 10MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do documento"
              className="h-12 text-base"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-medium">Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-medium">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Digite uma descrição do documento (opcional)"
              className="min-h-[100px] text-base resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 h-12 text-base"
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !title || !category}
              className="flex-1 h-12 text-base bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
