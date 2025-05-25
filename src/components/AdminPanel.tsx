
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Users, Plus, Edit, Trash2, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [employees, setEmployees] = useState<User[]>([
    {
      id: '1',
      name: 'João Silva',
      email: 'joao@tcponto.com',
      role: 'employee',
      hourlyRate: 25,
      overtimeRate: 37.5
    },
    {
      id: '3',
      name: 'Ana Santos',
      email: 'ana@tcponto.com',
      role: 'employee',
      hourlyRate: 30,
      overtimeRate: 45
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'employee' as 'admin' | 'employee',
    hourlyRate: 0,
    overtimeRate: 0
  });
  const [message, setMessage] = useState('');

  const handleAddEmployee = () => {
    if (!formData.name || !formData.email || !formData.hourlyRate) {
      setMessage('Preencha todos os campos obrigatórios');
      return;
    }

    const newEmployee: User = {
      id: Date.now().toString(),
      ...formData
    };

    setEmployees([...employees, newEmployee]);
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      hourlyRate: 0,
      overtimeRate: 0
    });
    setShowAddForm(false);
    setMessage('Funcionário adicionado com sucesso');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEditEmployee = (employee: User) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      email: employee.email,
      role: employee.role,
      hourlyRate: employee.hourlyRate,
      overtimeRate: employee.overtimeRate
    });
    setShowAddForm(true);
  };

  const handleUpdateEmployee = () => {
    if (!editingEmployee) return;

    const updatedEmployees = employees.map(emp =>
      emp.id === editingEmployee.id ? { ...editingEmployee, ...formData } : emp
    );

    setEmployees(updatedEmployees);
    setEditingEmployee(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      email: '',
      role: 'employee',
      hourlyRate: 0,
      overtimeRate: 0
    });
    setMessage('Funcionário atualizado com sucesso');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleDeleteEmployee = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      setEmployees(employees.filter(emp => emp.id !== id));
      setMessage('Funcionário excluído com sucesso');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const exportReport = () => {
    // Simular exportação de relatório
    setMessage('Relatório exportado com sucesso');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                onClick={onBack}
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-primary-900">Painel Administrativo</h1>
                <p className="text-sm text-gray-600">Gerenciamento de funcionários</p>
              </div>
            </div>
            
            <Button
              onClick={exportReport}
              variant="outline"
              size="sm"
              className="text-primary-700 border-primary-200 hover:bg-primary-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Relatório
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <Alert className="mb-6 border-accent-200 bg-accent-50">
            <AlertDescription className="text-accent-800">
              {message}
            </AlertDescription>
          </Alert>
        )}

        {/* Formulário de Adicionar/Editar */}
        {showAddForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingEmployee ? 'Editar Funcionário' : 'Adicionar Funcionário'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Digite o nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Digite o e-mail"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Perfil</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'admin' | 'employee') => 
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionário</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">Valor Hora Normal (R$)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="overtimeRate">Valor Hora Extra (R$)</Label>
                  <Input
                    id="overtimeRate"
                    type="number"
                    step="0.01"
                    value={formData.overtimeRate}
                    onChange={(e) => setFormData({ ...formData, overtimeRate: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                  className="bg-primary-800 hover:bg-primary-700"
                >
                  {editingEmployee ? 'Atualizar' : 'Adicionar'} Funcionário
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingEmployee(null);
                    setFormData({
                      name: '',
                      email: '',
                      role: 'employee',
                      hourlyRate: 0,
                      overtimeRate: 0
                    });
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Funcionários */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Funcionários ({employees.length})
              </CardTitle>
              <Button
                onClick={() => setShowAddForm(true)}
                className="bg-accent-600 hover:bg-accent-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Funcionário
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hora Normal
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
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{employee.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.role === 'admin' 
                            ? 'bg-primary-100 text-primary-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.role === 'admin' ? 'Admin' : 'Funcionário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R$ {employee.hourlyRate.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        R$ {employee.overtimeRate.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditEmployee(employee)}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteEmployee(employee.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPanel;
