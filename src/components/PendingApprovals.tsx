import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle, Unlock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut';
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface PendingApprovalsProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'employee';
    hourlyRate: number;
    overtimeRate: number;
  }>;
}

const PendingApprovals: React.FC<PendingApprovalsProps> = ({ employees }) => {
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [message, setMessage] = useState('');

  const loadEditRequests = () => {
    const savedRequests = localStorage.getItem('tcponto_edit_requests');
    if (savedRequests) {
      setEditRequests(JSON.parse(savedRequests));
    }
  };

  useEffect(() => {
    loadEditRequests();
    
    // Atualizar a cada 10 segundos para verificar novas solicitações
    const interval = setInterval(loadEditRequests, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const clearFieldRequestMark = (employeeId: string, date: string, field: string) => {
    const key = `tcponto_edit_requested_${employeeId}_${date}`;
    const savedFields = localStorage.getItem(key);
    if (savedFields) {
      const fields = new Set(JSON.parse(savedFields));
      fields.delete(field);
      if (fields.size === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(Array.from(fields)));
      }
    }
  };

  const handleApproval = (requestId: string, approved: boolean) => {
    const request = editRequests.find(r => r.id === requestId);
    if (!request) return;

    // Atualizar status da solicitação
    const updatedRequests = editRequests.map(r => 
      r.id === requestId 
        ? { ...r, status: approved ? 'approved' as const : 'rejected' as const }
        : r
    );
    setEditRequests(updatedRequests);
    localStorage.setItem('tcponto_edit_requests', JSON.stringify(updatedRequests));

    if (approved) {
      // Aplicar a edição no registro do funcionário
      const savedRecords = localStorage.getItem(`tcponto_records_${request.employeeId}`);
      if (savedRecords) {
        const records = JSON.parse(savedRecords);
        const recordIndex = records.findIndex((r: any) => r.date === request.date);
        
        if (recordIndex !== -1) {
          records[recordIndex][request.field] = request.newValue;
          
          // Recalcular horas e valores
          const employee = employees.find(e => e.id === request.employeeId);
          if (employee) {
            const { totalHours, normalHours, overtimeHours } = calculateHours(
              records[recordIndex].clockIn,
              records[recordIndex].lunchStart,
              records[recordIndex].lunchEnd,
              records[recordIndex].clockOut
            );

            const normalPay = normalHours * employee.hourlyRate;
            const overtimePay = overtimeHours * employee.overtimeRate;
            const totalPay = normalPay + overtimePay;

            records[recordIndex] = {
              ...records[recordIndex],
              totalHours,
              normalHours,
              overtimeHours,
              normalPay,
              overtimePay,
              totalPay
            };
          }
          
          localStorage.setItem(`tcponto_records_${request.employeeId}`, JSON.stringify(records));
        }
      }
      
      setMessage(`Edição de ${getFieldLabel(request.field)} aprovada para ${request.employeeName}`);
    } else {
      setMessage(`Edição de ${getFieldLabel(request.field)} rejeitada para ${request.employeeName}`);
    }

    // Limpar a marcação de campo solicitado (tanto para aprovado quanto rejeitado)
    clearFieldRequestMark(request.employeeId, request.date, request.field);
    
    setTimeout(() => setMessage(''), 3000);
  };

  const calculateHours = (clockIn?: string, lunchStart?: string, lunchEnd?: string, clockOut?: string) => {
    if (!clockIn || !clockOut) return { totalHours: 0, normalHours: 0, overtimeHours: 0 };

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours + minutes / 60;
    };

    const clockInHours = parseTime(clockIn);
    const clockOutHours = parseTime(clockOut);
    const lunchStartHours = lunchStart ? parseTime(lunchStart) : 0;
    const lunchEndHours = lunchEnd ? parseTime(lunchEnd) : 0;

    let totalHours = clockOutHours - clockInHours;

    if (lunchStart && lunchEnd && lunchEndHours > lunchStartHours) {
      totalHours -= (lunchEndHours - lunchStartHours);
    }

    totalHours = Math.max(0, totalHours);
    const normalHours = Math.min(totalHours, 8);
    const overtimeHours = Math.max(0, totalHours - 8);

    return { totalHours, normalHours, overtimeHours };
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'clockIn': return 'Entrada';
      case 'lunchStart': return 'Início do Almoço';
      case 'lunchEnd': return 'Fim do Almoço';
      case 'clockOut': return 'Saída';
      default: return field;
    }
  };

  const pendingRequests = editRequests.filter(r => r.status === 'pending');
  const processedRequests = editRequests.filter(r => r.status !== 'pending').slice(0, 10);

  return (
    <div className="space-y-6">
      {message && (
        <Alert className="border-accent-200 bg-accent-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-accent-800">
            {message}
          </AlertDescription>
        </Alert>
      )}

      {/* Solicitações Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes ({pendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma solicitação pendente no momento
            </p>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{request.employeeName}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(request.date).toLocaleDateString('pt-BR')} - {getFieldLabel(request.field)}
                      </p>
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        Campo será desbloqueado após decisão
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {new Date(request.timestamp).toLocaleString('pt-BR')}
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-red-600">Valor Atual:</span>
                        <p className="text-gray-900">{request.oldValue}</p>
                      </div>
                      <div>
                        <span className="font-medium text-green-600">Novo Valor:</span>
                        <p className="text-gray-900">{request.newValue}</p>
                      </div>
                    </div>
                    {request.reason && (
                      <div className="mt-2">
                        <span className="font-medium">Motivo:</span>
                        <p className="text-gray-700">{request.reason}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproval(request.id, true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleApproval(request.id, false)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Aprovações */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico Recente</CardTitle>
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
                      Campo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Alteração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.employeeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getFieldLabel(request.field)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.oldValue} → {request.newValue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={request.status === 'approved' ? 'default' : 'destructive'}>
                          {request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.timestamp).toLocaleDateString('pt-BR')}
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
  );
};

export default PendingApprovals;
