
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Calendar, User, Users, FileDown } from 'lucide-react';
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
  const [timeRecords, setTimeRecords] = useState([]);

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

  const loadTimeRecords = async (employeeId?: string) => {
    try {
      let query = supabase
        .from('time_records')
        .select(`
          *,
          profiles:user_id (
            name,
            email,
            hourly_rate
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (employeeId) {
        query = query.eq('user_id', employeeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar registros:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
      return [];
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
      const records = await loadTimeRecords(selectedEmployeeId);
      setTimeRecords(records);
      console.log('Registros carregados:', records);
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
      const records = await loadTimeRecords();
      setTimeRecords(records);
      console.log('Registros carregados:', records);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--';
    return timeString.slice(0, 5);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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
        {/* Card com filtros */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Selecionar Período e Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Labels em linha */}
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Funcionário</Label>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data Inicial</Label>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Data Final</Label>
                </div>
                <div></div>
                <div></div>
              </div>

              {/* Inputs e botões em linha */}
              <div className="grid grid-cols-5 gap-4 items-center">
                {/* Select Funcionário */}
                <div>
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
                <div>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Data Final */}
                <div>
                  <Input
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
                    className="bg-blue-600 hover:bg-blue-700 text-white h-10 w-full"
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
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 h-10 w-full"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {loading ? 'Gerando...' : 'Gerar Todos'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Resultados */}
        {timeRecords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="w-5 h-5" />
                Registros de Ponto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Data</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Funcionário</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Entrada</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Almoço Saída</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Almoço Volta</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Saída</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Horas Normais</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Horas Extras</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Total Horas</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeRecords.map((record: any) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">
                          {new Date(record.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {record.profiles?.name || 'N/A'}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTime(record.clock_in)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTime(record.lunch_start)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTime(record.lunch_end)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatTime(record.clock_out)}
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {Number(record.normal_hours).toFixed(2)}h
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {Number(record.overtime_hours).toFixed(2)}h
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {Number(record.total_hours).toFixed(2)}h
                        </td>
                        <td className="border border-gray-300 px-4 py-2">
                          {formatCurrency(Number(record.total_pay))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DetailedTimeReport;
