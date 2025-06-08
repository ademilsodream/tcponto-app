import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Edit, UserX, UserCheck } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';


interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
  employeeCode?: string;
  status?: 'active' | 'inactive';
  terminationDate?: string;
  departmentId?: string;
  jobFunctionId?: string;
  shiftId?: string;
  department?: { name: string };
  jobFunction?: { name: string };
  shift?: { name: string };
}


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


interface WorkShift {
  id: string;
  name: string;
  is_active: boolean;
}


interface UserManagementProps {
  onUserChange?: () => void;
}

// ✨ NOVA: Função para formatar horas no padrão HH:MM
// Nota: Esta função foi adicionada conforme solicitado,
// mas não é diretamente utilizada na tabela deste componente (UserManagement),
// que exibe valores monetários por hora, não totais de horas.
// Se você precisar formatar totais de horas, isso deve ser feito onde eles são exibidos.
const formatHoursAsTime = (hours: number) => {
  if (!hours || hours === 0) return '00:00';

  const totalMinutes = Math.round(hours * 60);
  const hoursDisplay = Math.floor(totalMinutes / 60);
  const minutesDisplay = totalMinutes % 60;

  return `${hoursDisplay.toString().padStart(2, '0')}:${minutesDisplay.toString().padStart(2, '0')}`;
};


const UserManagement: React.FC<UserManagementProps> = ({ onUserChange }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShift[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTerminationDialogOpen, setIsTerminationDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [terminatingUser, setTerminatingUser] = useState<User | null>(null);
  const [terminationDate, setTerminationDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    hourlyRate: '50',
    overtimeRate: '75',
    employeeCode: '',
    departmentId: '',
    jobFunctionId: '',
    shiftId: ''
  });
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadDepartmentsJobFunctionsAndShifts();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(name),
          job_functions(name),
          work_shifts(name)
        `)
        .order('name');

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao carregar usuários",
          variant: "destructive"
        });
        return;
      }

      const formattedUsers = data?.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role === 'admin' ? 'admin' : 'user' as 'admin' | 'user',
        hourlyRate: Number(profile.hourly_rate) || 50,
        overtimeRate: Number(profile.overtime_rate) || 75,
        employeeCode: profile.employee_code || '',
        status: profile.status || 'active',
        terminationDate: profile.termination_date || undefined,
        departmentId: profile.department_id || '',
        jobFunctionId: profile.job_function_id || '',
        shiftId: profile.shift_id || '',
        department: profile.departments,
        jobFunction: profile.job_functions,
        shift: profile.work_shifts
      })) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar usuários",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const loadDepartmentsJobFunctionsAndShifts = async () => {
    try {
      const [deptResult, jobResult, shiftResult] = await Promise.all([
        supabase.from('departments').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('job_functions').select('id, name, is_active').eq('is_active', true).order('name'),
        supabase.from('work_shifts').select('id, name, is_active').eq('is_active', true).order('name')
      ]);

      if (deptResult.error) throw deptResult.error;
      if (jobResult.error) throw jobResult.error;
      if (shiftResult.error) throw shiftResult.error;

      setDepartments(deptResult.data || []);
      setJobFunctions(jobResult.data || []);
      setWorkShifts(shiftResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos, funções e turnos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar departamentos, funções e turnos",
        variant: "destructive"
      });
    }
  };


  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      hourlyRate: '50',
      overtimeRate: '75',
      employeeCode: '',
      departmentId: '',
      jobFunctionId: '',
      shiftId: ''
    });
    setEditingUser(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || (!editingUser && !formData.password) || !formData.departmentId || !formData.jobFunctionId) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (incluindo Departamento e Função)",
        variant: "destructive"
      });
      return;
    }

    const hourlyRate = parseFloat(formData.hourlyRate) || 50;
    const overtimeRate = parseFloat(formData.overtimeRate) || 75;

    try {
      setSubmitting(true);

      if (editingUser) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            hourly_rate: hourlyRate,
            overtime_rate: overtimeRate,
            employee_code: formData.employeeCode || null,
            department_id: formData.departmentId,
            job_function_id: formData.jobFunctionId,
            shift_id: formData.shiftId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id);

        if (error) {
          throw error;
        }

        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso!"
        });
      } else {
        // Criar novo usuário via Edge Function
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            hourlyRate: hourlyRate,
            overtimeRate: overtimeRate,
            employeeCode: formData.employeeCode,
            departmentId: formData.departmentId,
            jobFunctionId: formData.jobFunctionId,
            shiftId: formData.shiftId || null
          }
        });

        if (response.error) {
          throw new Error(response.error.message || 'Erro ao criar usuário');
        }

        toast({
          title: "Sucesso",
          description: "Usuário criado com sucesso!"
        });
      }

      await loadUsers();
      onUserChange?.();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar usuário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Senha não é preenchida ao editar
      role: user.role,
      hourlyRate: user.hourlyRate.toString(),
      overtimeRate: user.overtimeRate.toString(),
      employeeCode: user.employeeCode || '',
      departmentId: user.departmentId || '',
      jobFunctionId: user.jobFunctionId || '',
      shiftId: user.shiftId || ''
    });
    setIsDialogOpen(true);
  };


  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        throw error;
      }

      await loadUsers();
      onUserChange?.();

      toast({
        title: "Sucesso",
        description: "Usuário (perfil) excluído com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuário",
        variant: "destructive"
      });
    } finally {
       setSubmitting(false);
    }
  };


  const handleTerminate = (user: User) => {
    setTerminatingUser(user);
    setTerminationDate(new Date().toISOString().split('T')[0]);
    setIsTerminationDialogOpen(true);
  };


  const confirmTermination = async () => {
    if (!terminatingUser || !terminationDate) {
       toast({
        title: "Erro",
        description: "Selecione a data de demissão.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'inactive',
          termination_date: terminationDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', terminatingUser.id);

      if (error) {
        throw error;
      }

      await loadUsers();
      onUserChange?.();
      setIsTerminationDialogOpen(false);
      setTerminatingUser(null);
      setTerminationDate('');

      toast({
        title: "Sucesso",
        description: `Funcionário ${terminatingUser.name} foi demitido em ${new Date(terminationDate).toLocaleDateString('pt-BR')}`
      });
    } catch (error: any) {
      console.error('Erro ao demitir usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao demitir usuário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handleReactivate = async (user: User) => {
    if (!confirm(`Tem certeza que deseja reativar o funcionário ${user.name}?`)) {
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          termination_date: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await loadUsers();
      onUserChange?.();

      toast({
        title: "Sucesso",
        description: `Funcionário ${user.name} foi reativado com sucesso!`
      });
    } catch (error: any) {
      console.error('Erro ao reativar usuário:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao reativar usuário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando usuários...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-primary-900">Gerenciamento de Usuários</h2>
          <p className="text-gray-600">Criar e gerenciar usuários do sistema</p>
        </div>

        {/* ✅ ÚNICA MUDANÇA: Botão simples sem DialogTrigger */}
        <Button onClick={() => { 
          resetForm(); 
          setIsDialogOpen(true); 
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* ✅ ÚNICA MUDANÇA: Dialog sem DialogTrigger */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={submitting || !!editingUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCode">Código do Funcionário</Label>
                <Input
                  id="employeeCode"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  placeholder="Ex: EMP001"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Departamento *</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
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
                  value={formData.jobFunctionId}
                  onValueChange={(value) => setFormData({ ...formData, jobFunctionId: value })}
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
                <Label htmlFor="shift">Turno (Opcional)</Label>
                <select
                  value={formData.shiftId}
                  onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={submitting}
                >
                  <option value="">Sem turno</option>
                  {workShifts && workShifts.length > 0 ? (
                    workShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Nenhum turno cadastrado
                    </option>
                  )}
                </select>
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha * (mínimo 6 caracteres)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Nível *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'admin' | 'user') => setFormData({ ...formData, role: value })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Funcionário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Valor por Hora *</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="overtimeRate">Valor Hora Extra * (Campo Livre)</Label>
                <Input
                  id="overtimeRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.overtimeRate}
                  onChange={(e) => setFormData({ ...formData, overtimeRate: e.target.value })}
                  required
                  disabled={submitting}
                />
                <p className="text-sm text-gray-600">
                  Valor livre para hora extra (não calculado automaticamente)
                </p>
              </div>
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
                {submitting ? 'Salvando...' : (editingUser ? 'Salvar' : 'Criar')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Demissão - MANTIDO COMPLETO */}
      <Dialog open={isTerminationDialogOpen} onOpenChange={setIsTerminationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demitir Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Tem certeza que deseja demitir o funcionário <strong>{terminatingUser?.name}</strong>?</p>
            <div className="space-y-2">
              <Label htmlFor="terminationDate">Data da Demissão *</Label>
              <Input
                id="terminationDate"
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTerminationDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmTermination}
                disabled={submitting || !terminationDate}
                className="bg-red-600 hover:bg-red-700"
              >
                {submitting ? 'Demitindo...' : 'Confirmar Demissão'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* TABELA COMPLETA MANTIDA - TODAS AS COLUNAS E FUNCIONALIDADES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Lista de Usuários ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário encontrado</p>
              <p className="text-sm">Clique em "Novo Usuário" para criar o primeiro usuário</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Função
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Turno
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nível
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hora Extra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${user.status === 'inactive' ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.employeeCode || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.jobFunction?.name || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.shift?.name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status === 'active' ? 'Ativo' : `Demitido em ${user.terminationDate ? new Date(user.terminationDate).toLocaleDateString('pt-BR') : ''}`}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(user.hourlyRate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(user.overtimeRate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user.status === 'active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTerminate(user)}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReactivate(user)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          )}
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


export default UserManagement;