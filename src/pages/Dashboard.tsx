
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, Calendar, DollarSign, Users, LogOut, Edit, CalendarDays } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import TimeRegistration from '../components/TimeRegistration';
import AdminPanel from '../components/AdminPanel';
import { calculateMonthlyStats } from '../utils/timeCalculations';

interface TimeRecord {
  id: string;
  date: string;
  clockIn?: string;
  lunchStart?: string;
  lunchEnd?: string;
  clockOut?: string;
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  normalPay: number;
  overtimePay: number;
  totalPay: number;
  locations?: {
    clockIn?: { lat: number; lng: number; address: string; timestamp: string };
    lunchStart?: { lat: number; lng: number; address: string; timestamp: string };
    lunchEnd?: { lat: number; lng: number; address: string; timestamp: string };
    clockOut?: { lat: number; lng: number; address: string; timestamp: string };
  };
}

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [timeRecords, setTimeRecords] = useState<TimeRecord[]>([]);
  const [currentRecord, setCurrentRecord] = useState<TimeRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    // Carregar registros do localStorage
    const savedRecords = localStorage.getItem(`tcponto_records_${user?.id}`);
    let records: TimeRecord[] = [];
    
    if (savedRecords) {
      records = JSON.parse(savedRecords);
    }

    setTimeRecords(records);
  }, [user?.id]);

  useEffect(() => {
    // Encontrar ou criar registro para a data selecionada
    let selectedRecord = timeRecords.find(r => r.date === selectedDate);

    if (!selectedRecord) {
      selectedRecord = {
        id: `${user?.id}_${selectedDate}`,
        date: selectedDate,
        totalHours: 0,
        normalHours: 0,
        overtimeHours: 0,
        normalPay: 0,
        overtimePay: 0,
        totalPay: 0
      };
    }

    setCurrentRecord(selectedRecord);
  }, [selectedDate, timeRecords, user?.id]);

  const updateTimeRecord = (updatedRecord: TimeRecord) => {
    const existingRecordIndex = timeRecords.findIndex(record => record.id === updatedRecord.id);
    let updatedRecords: TimeRecord[];
    
    if (existingRecordIndex !== -1) {
      updatedRecords = timeRecords.map(record => 
        record.id === updatedRecord.id ? updatedRecord : record
      );
    } else {
      updatedRecords = [...timeRecords, updatedRecord];
    }
    
    setTimeRecords(updatedRecords);
    setCurrentRecord(updatedRecord);
    localStorage.setItem(`tcponto_records_${user?.id}`, JSON.stringify(updatedRecords));
  };

  const getCurrentMonthStats = () => {
    // Calcular dias úteis do mês atual (segunda a sexta)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let workDays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Segunda a sexta
        workDays++;
      }
    }

    // Usar a função utilitária para calcular estatísticas
    return calculateMonthlyStats(timeRecords, workDays, user?.hourlyRate || 0);
  };

  const monthStats = getCurrentMonthStats();
  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  if (!user) return null;

  if (user.role === 'admin' && showAdminPanel) {
    return <AdminPanel onBack={() => setShowAdminPanel(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="/lovable-uploads/4b2c75fc-26d4-4be4-9e7e-3a415e06b623.png" 
                alt="TCPonto" 
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="text-xl font-semibold text-primary-900">TCPonto</h1>
                <p className="text-sm text-gray-600">Olá, {user.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user.role === 'admin' && (
                <Button
                  onClick={() => setShowAdminPanel(true)}
                  variant="outline"
                  size="sm"
                  className="text-primary-700 border-primary-200 hover:bg-primary-50"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Seletor de Data */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Selecionar Data para Registro
              </CardTitle>
              <CardDescription>
                Escolha o dia para registrar ou visualizar os pontos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
                <Button
                  onClick={() => setSelectedDate(today)}
                  variant="outline"
                  size="sm"
                >
                  Hoje
                </Button>
                {!isToday && (
                  <div className="text-sm text-amber-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Registrando dia anterior
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Registro de Ponto */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Registro de Ponto - {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}
          </h2>
          {currentRecord && (
            <TimeRegistration
              record={currentRecord}
              onUpdate={updateTimeRecord}
              user={user}
              isHistoricalEntry={!isToday}
            />
          )}
        </div>

        {/* Resumo do Mês */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Resumo do Mês</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Horas Trabalhadas</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary-900">
                  {monthStats.totalHours.toFixed(1)}h
                </div>
                <p className="text-xs text-muted-foreground">
                  +{monthStats.totalOvertimeHours.toFixed(1)}h extras
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent-600">
                  R$ {monthStats.totalPay.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Este mês
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faltas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {monthStats.absentDays}
                </div>
                <p className="text-xs text-muted-foreground">
                  -R$ {monthStats.absenceDeduction.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hoje</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary-900">
                  {timeRecords.find(r => r.date === today)?.totalHours.toFixed(1) || '0'}h
                </div>
                <p className="text-xs text-muted-foreground">
                  R$ {timeRecords.find(r => r.date === today)?.totalPay.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Histórico Recente */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Histórico Recente</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entrada
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Almoço
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saída
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {timeRecords.slice(-10).reverse().map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.clockIn || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.lunchStart && record.lunchEnd 
                            ? `${record.lunchStart} - ${record.lunchEnd}` 
                            : '-'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.clockOut || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.totalHours.toFixed(1)}h
                          {record.overtimeHours > 0 && (
                            <span className="text-accent-600 ml-1">
                              (+{record.overtimeHours.toFixed(1)}h)
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-accent-600">
                          R$ {record.totalPay.toFixed(2)}
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
    </div>
  );
};

export default Dashboard;
