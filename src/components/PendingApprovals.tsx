import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle, Unlock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

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
        field: request.field as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
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

  const handleApproval = async (requestId: string, approved: boolean) => {
    const request = editRequests.find(r => r.id === requestId);
    if (!request) return;

    try {
      // Update the request status
      const { error: updateError } = await supabase
        .from('edit_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      if (approved) {
        // Apply the edit to the time record
        const { data: timeRecords, error: fetchError } = await supabase
          .from('time_records')
          .select('*')
          .eq('user_id', request.employeeId)
          .eq('date', request.date)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        const fieldMap = {
          clockIn: 'clock_in',
          lunchStart: 'lunch_start',
          lunchEnd: 'lunch_end',
          clockOut: 'clock_out'
        };

        const updateData = {
          [fieldMap[request.field]]: request.newValue
        };

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
              user_id: request.employeeId,
              date: request.date,
              ...updateData
            });

          if (insertError) throw insertError;
        }

        setMessage(`Edição de ${getFieldLabel(request.field)} aprovada para ${request.employeeName}.`);
      } else {
        setMessage(`Edição de ${getFieldLabel(request.field)} rejeitada para ${request.employeeName}.`);
      }

      await loadEditRequests();
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error handling approval:', error);
      alert('Erro ao processar aprovação');
    }
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

  if (loading) {
    return <div>Carregando solicitações...</div>;
  }

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
