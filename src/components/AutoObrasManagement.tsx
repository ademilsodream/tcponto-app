
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Building2, Edit, Plus, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Department {
  id: string;
  name: string;
  is_active: boolean;
}

interface JobFunction {
  id: string;
  name: string;
  is_active: boolean;
}

interface AutoObrasValue {
  id: string;
  department_id: string;
  job_function_id: string;
  auto_value: number;
  is_active: boolean;
  departments: { name: string };
  job_functions: { name: string };
}

const AutoObrasManagement = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [autoObrasValues, setAutoObrasValues] = useState<AutoObrasValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<AutoObrasValue | null>(null);
  
  const [formData, setFormData] = useState({
    department_id: '',
    job_function_id: '',
    auto_value: ''
  });
  
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [deptResult, jobResult, valuesResult] = await Promise.all([
        supabase.from('departments').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('job_functions').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase
          .from('auto_obras_values')
          .select(`
            *,
            departments(name),
            job_functions(name)
          `)
          .order('created_at', { ascending: false })
      ]);

      if (deptResult.error) throw deptResult.error;
      if (jobResult.error) throw jobResult.error;
      if (valuesResult.error) throw valuesResult.error;

      setDepartments(deptResult.data || []);
      setJobFunctions(jobResult.data || []);
      setAutoObrasValues(valuesResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      department_id: '',
      job_function_id: '',
      auto_value: ''
    });
    setEditingValue(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.department_id || !formData.job_function_id || !formData.auto_value) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    const autoValue = parseFloat(formData.auto_value);
    if (isNaN(autoValue) || autoValue <= 0) {
      toast({
        title: "Erro",
        description: "Valor deve ser um número positivo",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      if (editingValue) {
        // Atualizar valor existente
        const { error } = await supabase
          .from('auto_obras_values')
          .update({
            department_id: formData.department_id,
            job_function_id: formData.job_function_id,
            auto_value: autoValue
          })
          .eq('id', editingValue.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Valor atualizado com sucesso"
        });
      } else {
        // Criar novo valor
        const { error } = await supabase
          .from('auto_obras_values')
          .insert([{
            department_id: formData.department_id,
            job_function_id: formData.job_function_id,
            auto_value: autoValue
          }]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Valor cadastrado com sucesso"
        });
      }

      await loadData();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar valor:', error);
      
      if (error.code === '23505') {
        toast({
          title: "Erro",
          description: "Já existe um valor cadastrado para este departamento e função",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao salvar valor",
          variant: "destructive"
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (value: AutoObrasValue) => {
    setEditingValue(value);
    setFormData({
      department_id: value.department_id,
      job_function_id: value.job_function_id,
      auto_value: value.auto_value.toString()
    });
    setIsDialogOpen(true);
  };

  const toggleValueStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('auto_obras_values')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Valor ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`
      });

      loadData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do valor",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-primary-900">Valor para Auto de Obras</h2>
          <p className="text-gray-600">Definir valores por departamento e função</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Valor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingValue ? 'Editar Valor' : 'Cadastrar Novo Valor'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department">Departamento *</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobFunction">Função *</Label>
                <Select
                  value={formData.job_function_id}
                  onValueChange={(value) => setFormData({ ...formData, job_function_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobFunctions.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="autoValue">Valor do Auto *</Label>
                <Input
                  id="autoValue"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.auto_value}
                  onChange={(e) => setFormData({ ...formData, auto_value: e.target.value })}
                  placeholder="0.00"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : (editingValue ? 'Salvar' : 'Cadastrar')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Valores Cadastrados ({autoObrasValues.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {autoObrasValues.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum valor cadastrado</p>
              <p className="text-sm">Clique em "Novo Valor" para cadastrar o primeiro valor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Departamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor do Auto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {autoObrasValues.map((value) => (
                    <tr key={value.id} className={`hover:bg-gray-50 ${!value.is_active ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {value.departments.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {value.job_functions.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(value.auto_value)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          value.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {value.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(value)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleValueStatus(value.id, value.is_active)}
                            className={value.is_active ? "text-red-600" : "text-green-600"}
                          >
                            {value.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoObrasManagement;
