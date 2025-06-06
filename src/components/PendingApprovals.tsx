import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ✨ Interface para o objeto JSON de localização que será salvo DENTRO da chave do campo (ex: "clock_in": {...})
// Replicando a estrutura que definimos na tela de ajuste
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null; // Pode ser nulo para edições manuais
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // Timestamp da solicitação de edição
  locationName: string;
}

// ✨ Interface para a estrutura esperada na coluna location do edit_requests
// Ex: { "clock_in": { ...LocationDetailsForEdit... } }
interface EditRequestLocation {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Para permitir acesso dinâmico
}


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
  location?: EditRequestLocation | null; // ✨ ADICIONADO: Usar a nova interface para location
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
  onApprovalChange?: () => void;
}

const PendingApprovals: React.FC<PendingApprovalsProps> = ({ employees, onApprovalChange }) => {
  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadEditRequests();
  }, []);

  const loadEditRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*') // ✨ MANTER '*': Para buscar a coluna 'location'
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedRequests = data?.map(request => ({
        id: request.id,
        employeeId: request.employee_id,
        employeeName: request.employee_name,
        date: request.date,
        field: request.field as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut',
        oldValue: request.old_value || '',
        newValue: request.new_value,
        reason: request.reason,
        timestamp: request.created_at,
        status: request.status as 'pending' | 'approved' | 'rejected',
        location: request.location as EditRequestLocation | null, // ✨ ADICIONADO: Mapear a coluna location com a nova interface
      })) || [];

      setEditRequests(formattedRequests);
    } catch (error) {
      console.error('Error loading edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupApproval = async (group: GroupedRequest, approved: boolean) => {
    try {
      const requestIds = group.requests.map(r => r.id);

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
        // ✨ ADICIONADO: Buscar registro existente de forma otimizada, incluindo a localização atual
        const { data: timeRecord, error: fetchError } = await supabase
          .from('time_records')
          .select('id, location') // ✨ ADICIONADO: Buscar a coluna location
          .eq('user_id', group.employeeId)
          .eq('date', group.date)
          .maybeSingle();

        if (fetchError) throw fetchError;

        // Preparar dados de atualização para time_records
        const updateData: any = {};
        const fieldMap = {
          clockIn: 'clock_in',
          lunchStart: 'lunch_start',
          lunchEnd: 'lunch_end',
          clockOut: 'clock_out'
        };

        // ✨ Lógica para mesclar localizações
        let mergedLocations: any = timeRecord?.location || {}; // Inicia com a localização existente ou um objeto vazio

        for (const request of group.requests) {
          const dbFieldName = fieldMap[request.field] as keyof EditRequestLocation; // Nome do campo no DB (snake_case)
          updateData[dbFieldName] = request.newValue; // Adiciona o novo valor do horário

          // Se a solicitação de edição tiver dados de localização para este campo, mesclar
          if (request.location && request.location[dbFieldName]) {
             mergedLocations[dbFieldName] = request.location[dbFieldName];
          }
        }

        // ✨ ADICIONADO: Adicionar o objeto de localização mesclada aos dados de atualização
        updateData.location = mergedLocations;

        if (timeRecord) {
          // Atualizar registro existente
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData) // ✨ updateData agora inclui location mesclada
            .eq('id', timeRecord.id);

          if (updateRecordError) throw updateRecordError;
        } else {
          // Criar novo registro
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData, // ✨ updateData agora inclui location mesclada
            });

          if (insertError) throw insertError;
        }

        setMessage(`Edições aprovadas para ${group.employeeName}`);
      } else {
        setMessage(`Edições rejeitadas para ${group.employeeName}`);
      }

      await loadEditRequests();

      // Chamar callback se fornecido
      if (onApprovalChange) {
        onApprovalChange();
      }

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error handling group approval:', error);
      setMessage('Erro ao processar aprovação');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const getFieldLabel = (field: string) => {
    const labels = {
      clockIn: 'Entrada',
      lunchStart: 'Início do Almoço',
      lunchEnd: 'Fim do Almoço',
      clockOut: 'Saída'
    };
    return labels[field as keyof typeof labels] || field;
  };

  const pendingRequests = editRequests.filter(r => r.status === 'pending');
  const processedRequests = editRequests.filter(r => r.status !== 'pending');

  // Agrupar solicitações pendentes por funcionário e data
  const groupedPendingRequests = pendingRequests.reduce((acc, request) => {
    const key = `${request.employeeId}-${request.date}`;
    if (!acc[key]) {
      acc[key] = {
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        date: request.date,
        requests: [],
        timestamp: request.timestamp
      };
    }
    acc[key].requests.push(request);
    return acc;
  }, {} as Record<string, GroupedRequest>);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Solicitações Pendentes ({Object.keys(groupedPendingRequests).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedPendingRequests).length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma solicitação pendente
            </p>
          ) : (
            <div className="space-y-4">
              {Object.values(groupedPendingRequests).map((group) => (
                <div key={`${group.employeeId}-${group.date}`} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{group.employeeName}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {new Date(group.timestamp).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>

                  <div className="mb-3">
                    <h5 className="font-medium mb-2">Ajustes:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-sm border rounded p-2 bg-white">
                          <div className="font-medium">{getFieldLabel(request.field)}</div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          {/* ✨ Exibir localização se disponível na solicitação */}
                          {request.location && Object.keys(request.location).length > 0 && (
                              <div className="text-xs text-gray-600 mt-1">
                                Localização: {Object.values(request.location)[0]?.locationName || 'N/A'}
                              </div>
                          )}
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
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleGroupApproval(group, false)}
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

      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Funcionário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Campo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Alteração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
