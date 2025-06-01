
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Briefcase, Plus, Edit, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Department {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface JobFunction {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

const DepartmentJobManagement = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [newDepartment, setNewDepartment] = useState({ name: '', description: '' });
  const [newJobFunction, setNewJobFunction] = useState({ name: '', description: '' });
  
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [deptResult, jobResult] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('job_functions').select('*').order('name')
      ]);

      if (deptResult.error) throw deptResult.error;
      if (jobResult.error) throw jobResult.error;

      setDepartments(deptResult.data || []);
      setJobFunctions(jobResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar departamentos e funções",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartment.name.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('departments')
        .insert([{
          name: newDepartment.name.trim(),
          description: newDepartment.description.trim() || null
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Departamento adicionado com sucesso"
      });

      setNewDepartment({ name: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar departamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar departamento",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddJobFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobFunction.name.trim()) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('job_functions')
        .insert([{
          name: newJobFunction.name.trim(),
          description: newJobFunction.description.trim() || null
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Função adicionada com sucesso"
      });

      setNewJobFunction({ name: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar função:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar função",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDepartmentStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Departamento ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`
      });

      loadData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do departamento",
        variant: "destructive"
      });
    }
  };

  const toggleJobFunctionStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('job_functions')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Função ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`
      });

      loadData();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status da função",
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Departamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddDepartment} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Nome *</Label>
                <Input
                  id="dept-name"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do departamento"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-desc">Descrição</Label>
                <Textarea
                  id="dept-desc"
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do departamento"
                  disabled={submitting}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={submitting || !newDepartment.name.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </form>

            <div className="space-y-2">
              <h4 className="font-medium">Departamentos Cadastrados</h4>
              {departments.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum departamento cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{dept.name}</div>
                        {dept.description && (
                          <div className="text-sm text-muted-foreground">{dept.description}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleDepartmentStatus(dept.id, dept.is_active)}
                        className={dept.is_active ? "text-green-600" : "text-red-600"}
                      >
                        {dept.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Funções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Funções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddJobFunction} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="job-name">Nome *</Label>
                <Input
                  id="job-name"
                  value={newJobFunction.name}
                  onChange={(e) => setNewJobFunction(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome da função"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-desc">Descrição</Label>
                <Textarea
                  id="job-desc"
                  value={newJobFunction.description}
                  onChange={(e) => setNewJobFunction(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição da função"
                  disabled={submitting}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={submitting || !newJobFunction.name.trim()}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </form>

            <div className="space-y-2">
              <h4 className="font-medium">Funções Cadastradas</h4>
              {jobFunctions.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma função cadastrada</p>
              ) : (
                <div className="space-y-2">
                  {jobFunctions.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{job.name}</div>
                        {job.description && (
                          <div className="text-sm text-muted-foreground">{job.description}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobFunctionStatus(job.id, job.is_active)}
                        className={job.is_active ? "text-green-600" : "text-red-600"}
                      >
                        {job.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DepartmentJobManagement;
