import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

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

const ITEMS_PER_PAGE = 10;

const OptimizedPendingApprovals: React.FC<PendingApprovalsProps> = ({ employees, onApprovalChange }) => {
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Query extremamente otimizada
  const {
    data: editRequests = [],
    isLoading,
    refetch
  } = useQuery<EditRequest[]>({ // ✨ Tipagem para o hook useQuery
    queryKey: ['edit-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*') // ✨ MANTER '*': Para buscar a coluna 'location'
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      return data.map(request => ({
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
      }));
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Real-time otimizado com throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const subscription = supabase
      .channel('edit_requests_throttled')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edit_requests'
        },
        () => {
          // Throttling de 2 segundos
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Memoized calculations com dependências otimizadas
  const { pendingRequests, processedRequests, groupedPendingRequests } = useMemo(() => {
    const pending = editRequests.filter(r => r.status === 'pending');
    const processed = editRequests.filter(r => r.status !== 'pending');

    // Agrupar solicitações pendentes de forma mais eficiente
    const groupsMap = new Map<string, GroupedRequest>();

    for (const request of pending) {
      const key = `${request.employeeId}-${request.date}`;

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          employeeId: request.employeeId,
          employeeName: request.employeeName,
          date: request.date,
          requests: [],
          timestamp: request.timestamp
        });
      }

      groupsMap.get(key)!.requests.push(request);
    }

    return {
      pendingRequests: pending,
      processedRequests: processed,
      groupedPendingRequests: Array.from(groupsMap.values())
    };
  }, [editRequests]);

  // Paginação otimizada
  const paginatedProcessedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);

  // Handler otimizado com callback
  const handleGroupApproval = useCallback(async (group: GroupedRequest, approved: boolean) => {
    try {
      const requestIds = group.requests.map(r => r.id);

      // Atualização em lote mais eficiente
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
        // Buscar registro existente de forma otimizada, incluindo a localização atual
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
             // Mescla o objeto de localização específico deste campo
            mergedLocations[dbFieldName] = request.location[dbFieldName];
          } else {
             // Se a solicitação não tem localização para este campo, mas o time_records tinha,
             // podemos opcionalmente remover a localização antiga para este campo
             // ou simplesmente deixar a lógica de mesclagem anterior sobrescrever/manter.
             // A lógica atual de mesclagem (abaixo) já lida com isso:
             // Se request.location[dbFieldName] for undefined, ele não será mesclado,
             // mantendo a versão de timeRecord?.location[dbFieldName] se existir.
             // Se quisermos *remover* a localização antiga se a nova não tiver,
             // precisaríamos de uma lógica mais explícita:
             // if (mergedLocations[dbFieldName] && (!request.location || !request.location[dbFieldName])) {
             //   delete mergedLocations[dbFieldName];
             // }
             // Mas a instrução foi apenas para acrescentar o que falta, o que a mesclagem faz.
             // Vamos manter a mesclagem simples que adiciona/sobrescreve apenas o que veio na request.
          }
        }

        // Adiciona o objeto de localização mesclada aos dados de atualização
        updateData.location = mergedLocations;

        if (timeRecord) {
          // Atualizar registro existente
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData) // ✨ updateData agora inclui location mesclada
            .eq('id', timeRecord.id);

          if (updateRecordError) throw updateRecordError;
        } else {
          // Criar novo registro (isso só aconteceria se o registro original fosse deletado antes da aprovação)
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData, // ✨ updateData agora inclui location mesclada
              // A coluna 'location' já está em updateData
            });

          if (insertError) throw insertError;
        }

        setMessage(`Edições aprovadas para ${group.employeeName}`);
      } else {
        setMessage(`Edições rejeitadas para ${group.employeeName}`);
      }

      // Invalidação otimizada do cache
      queryClient.invalidateQueries({
        queryKey: ['edit-requests'],
        exact: true
      });

      // Chamar callback se fornecido
      if (onApprovalChange) {
        onApprovalChange();
      }

      // Auto-clear da mensagem
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error handling group approval:', error);
      setMessage('Erro ao processar aprovação');
      setTimeout(() => setMessage(''), 3000);
    }
  }, [queryClient, onApprovalChange]); // Adicionado onApprovalChange como dependência

  // Memoized field label function
  const getFieldLabel = useCallback((field: string) => {
    const labels = {
      clockIn: 'Entrada',
      lunchStart: 'Início do Almoço',
      lunchEnd: 'Fim do Almoço',
      clockOut: 'Saída'
    };
    return labels[field as keyof typeof labels] || field;
  }, []);

  // Loading otimizado
  if (isLoading) {
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

      {/* Solicitações Pendentes Otimizadas */}
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
              Nenhuma solicitação pendente
            </p>
          ) : (
            <div className="space-y-4">
              {groupedPendingRequests.map((group) => (
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

      {/* Histórico Otimizado */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Histórico</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardTitle>
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
                  {paginatedProcessedRequests.map((request) => (
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

export default OptimizedPendingApprovals;
