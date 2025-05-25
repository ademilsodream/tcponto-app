
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  hourlyRate: number;
  overtimeRate: number;
}

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
}

interface EmployeeStatus {
  employee: User;
  isWorking: boolean;
  todayRecord?: TimeRecord;
  currentStatus: string;
  lastActivity?: string;
}

interface AdminDashboardProps {
  employees: User[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ employees }) => {
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadEmployeeStatuses = () => {
    const today = new Date().toISOString().split('T')[0];
    const statuses: EmployeeStatus[] = [];

    employees.forEach(employee => {
      if (employee.role === 'employee') {
        const savedRecords = localStorage.getItem(`tcponto_records_${employee.id}`);
        let todayRecord: TimeRecord | undefined;

        if (savedRecords) {
          const records: TimeRecord[] = JSON.parse(savedRecords);
          todayRecord = records.find(r => r.date === today);
        }

        let isWorking = false;
        let currentStatus = 'Não iniciou o trabalho';
        let lastActivity: string | undefined;

        if (todayRecord) {
          if (todayRecord.clockOut) {
            isWorking = false;
            currentStatus = 'Finalizou o expediente';
            lastActivity = `Saída: ${todayRecord.clockOut}`;
          } else if (todayRecord.lunchEnd) {
            isWorking = true;
            currentStatus = 'Voltou do almoço';
            lastActivity = `Voltou do almoço: ${todayRecord.lunchEnd}`;
          } else if (todayRecord.lunchStart) {
            isWorking = false;
            currentStatus = 'No horário de almoço';
            lastActivity = `Saiu para almoço: ${todayRecord.lunchStart}`;
          } else if (todayRecord.clockIn) {
            isWorking = true;
            currentStatus = 'Trabalhando';
            lastActivity = `Entrada: ${todayRecord.clockIn}`;
          }
        }

        statuses.push({
          employee,
          isWorking,
          todayRecord,
          currentStatus,
          lastActivity
        });
      }
    });

    setEmployeeStatuses(statuses);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    loadEmployeeStatuses();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(loadEmployeeStatuses, 30000);
    
    return () => clearInterval(interval);
  }, [employees]);

  const workingCount = employeeStatuses.filter(status => status.isWorking).length;
  const totalEmployees = employeeStatuses.length;

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Funcionários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary-900">{totalEmployees}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trabalhando Agora</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{workingCount}</div>
            <p className="text-xs text-muted-foreground">
              {totalEmployees - workingCount} não estão trabalhando
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadEmployeeStatuses}
              className="text-xs p-0 h-auto"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status dos funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Status dos Funcionários em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funcionário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Atividade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horas Hoje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeStatuses.map((status) => (
                  <tr key={status.employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          status.isWorking ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {status.employee.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {status.employee.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={status.isWorking ? 'default' : 'secondary'}>
                        {status.currentStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {status.lastActivity || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {status.todayRecord ? 
                        `${status.todayRecord.totalHours.toFixed(1)}h` : 
                        '0h'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
