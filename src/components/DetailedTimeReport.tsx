
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, User, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  hourlyRate: number;
  overtimeRate: number;
}

interface DetailedTimeReportProps {
  employees: Employee[];
  onBack: () => void;
}

const DetailedTimeReport: React.FC<DetailedTimeReportProps> = ({ employees, onBack }) => {
  const [startDate, setStartDate] = useState('2025-05-01');
  const [endDate, setEndDate] = useState('2025-05-31');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    loadEmployeesFromDB();
  }, []);

  const loadEmployeesFromDB = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('email', 'admin@tcponto.com');

      if (error) {
        console.error('Erro ao carregar funcionários:', error);
        return;
      }

      const employeesData = data.map(emp => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        hourlyRate: Number(emp.hourly_rate) || 0,
        overtimeRate: Number(emp.hourly_rate) || 0
      }));

      setDbEmployees(employeesData);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
    }
  };

  const generateSingleEmployeeReport = async () => {
    if (!startDate || !endDate || !selectedEmployeeId) {
      alert('Selecione todos os campos para gerar o relatório');
      return;
    }

    setLoading(true);
    
    try {
      console.log('Gerando relatório individual para:', selectedEmployeeId);
      // Implementar lógica aqui
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const generateAllEmployeesReport = async () => {
    if (!startDate || !endDate) {
      alert('Selecione o período para gerar o relatório');
      return;
    }

    setLoading(true);

    try {
      console.log('Gerando relatório de todos os funcionários');
      // Implementar lógica aqui
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
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
                <h1 className="text-xl font-semibold text-primary-900">Relatório Detalhado de Horas</h1>
                <p className="text-sm text-gray-600">Relatório diário por funcionário</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Selecionar Período e Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              {/* Funcionário */}
              <div className="min-w-[200px] flex-1">
                <Label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-1">
                  Funcionário
                </Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {dbEmployees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data Inicial */}
              <div className="min-w-[150px]">
                <Label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Inicial
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Data Final */}
              <div className="min-w-[150px]">
                <Label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Data Final
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Botão Gerar Individual */}
              <div>
                <Button
                  onClick={generateSingleEmployeeReport}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6"
                >
                  <User className="w-4 h-4 mr-2" />
                  {loading ? 'Gerando...' : 'Gerar Individual'}
                </Button>
              </div>

              {/* Botão Gerar Todos */}
              <div>
                <Button
                  onClick={generateAllEmployeesReport}
                  disabled={loading}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 h-10 px-6"
                >
                  <Users className="w-4 h-4 mr-2" />
                  {loading ? 'Gerando...' : 'Gerar Todos'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DetailedTimeReport;
