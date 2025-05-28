
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourlyRate: number;
  overtimeRate: number;
}

interface EditRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';
  oldValue: string;
  newValue: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface GroupedRequest {
  employeeId: string;
  employeeName: string;
  date: string;
  requests: EditRequest[];
  timestamp: string;
}

interface PendingApprovalsProps {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    hourlyRate: number;
    overtimeRate: number;
  }>;
}

const PendingApprovals: React.FC<PendingApprovalsProps> = ({ employees }) => {
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEditRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = data.map(request => ({
        id: request.id,
        employeeId: request.employee_id,
        employeeName: request.employee_name,
        date: request.date,
        field: request.field as 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out',
        oldValue: request.old_value || '',
        newValue: request.new_value,
        reason: request.reason,
        timestamp: request.created_at,
        status: request.status as 'pending' | 'approved' | 'rejected'
      }));

      setEditRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEditRequests();
    
    // Set up real-time listener for edit requests
    const subscription = supabase
      .channel('edit_requests_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edit_requests'
        },
        () => {
          loadEditRequests();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Agrupar solicitações por funcionário e data
  const groupRequestsByEmployeeAndDate = (requests: EditRequest[]): GroupedRequest[] => {
    const groups: { [key: string]: GroupedRequest } = {};

    requests.forEach(request => {
      const key = `${request.employeeId}-${request.date}`;
      
      if (!groups[key]) {
        groups[key] = {
          employeeId: request.employeeId,
          employeeName: request.employeeName,
          date: request.date,
          requests: [],
          timestamp: request.timestamp
        };
      }
      
      groups[key].requests.push(request);
    });

    return Object.values(groups);
  };

  const handleGroupApproval = async (group: GroupedRequest, approved: boolean) => {
    try {
      const requestIds = group.requests.map(r => r.id);
      
      // Update all request statuses in the group
      const { error: updateError } = await supabase
        .from('edit_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .in('id', requestIds);

      if (updateError) throw updateError;

      if (approved) {
        // Apply all edits to the time record
        const { data: timeRecords, error: fetchError } = await supabase
          .from('time_records')
          .select('*')
          .eq('user_id', group.employeeId)
          .eq('date', group.date)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        // Prepare update data from all requests
        const updateData: any = {};
        group.requests.forEach(request => {
          const fieldMap = {
            clock_in: 'clock_in',
            lunch_start: 'lunch_start',
            lunch_end: 'lunch_end',
            clock_out: 'clock_out'
          };
          updateData[fieldMap[request.field]] = request.newValue;
        });

        if (timeRecords) {
          // Update existing record
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData)
            .eq('id', timeRecords.id);

          if (updateRecordError) throw updateRecordError;
        } else {
          // Create new record
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData
            });

          if (insertError) throw insertError;
        }

        setMessage(`Todas as edições de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} foram aprovadas.`);
      } else {
        setMessage(`Todas as edições de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} foram rejeitadas.`);
      }

      await loadEditRequests();
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error handling group approval:', error);
      alert('Erro ao processar aprovação');
    }
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'clock_in': return 'Entrada';
      case 'lunch_start': return 'Início do Almoço';
      case 'lunch_end': return 'Fim do Almoço';
      case 'clock_out': return 'Saída';
      default: return field;
    }
  };

  if (loading) {
    return <div>Carregando solicitações...</div>;
  }

  const pendingRequests = editRequests.filter(r => r.status === 'pending');
  const processedRequests = editRequests.filter(r => r.status !== 'pending').slice(0, 10);
  
  const groupedPendingRequests = groupRequestsByEmployeeAndDate(pendingRequests);

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

      {/* Solicitações Pendentes Agrupadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes ({groupedPendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedPendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma solicitação pendente no momento
            </p>
          ) : (
            <div className="space-y-4">
              {groupedPendingRequests.map((group, index) => (
                <div key={`${group.employeeId}-${group.date}`} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{group.employeeName}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {new Date(group.timestamp).toLocaleString('pt-BR')}
                    </Badge>
                  </div>
                  
                  <div className="mb-3">
                    <h5 className="font-medium mb-2">Ajustes Solicitados:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-sm border rounded p-2 bg-white">
                          <div className="font-medium">{getFieldLabel(request.field)}</div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          {request.reason && (
                            <div className="text-xs text-gray-600 mt-1">
                              Motivo: {request.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGroupApproval(group, true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar Todos
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleGroupApproval(group, false)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar Todos
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
                        {request.oldValue || 'Vazio'} → {request.newValue}
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
