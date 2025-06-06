import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ✨ DEFINIR TIPO Json LOCALMENTE
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// Interface para os detalhes de localização
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  locationName: string;
}

// Interface para o conteúdo de localização
interface EditRequestLocation {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined;
}

// ✨ Interface for the raw data directly from the Supabase 'edit_requests' table
interface RawEditRequestData {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  field: string;
  old_value: string | null;
  new_value: string;
  reason: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at: string | null;
  reviewed_by: string | null;
  location: Json | null;
}

// Interface para dados mapeados usados no componente
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
  location?: EditRequestLocation | null;
}

// ✨ Interface for the raw data from the 'time_records' table
interface RawTimeRecordData {
    id: string;
    user_id: string;
    date: string;
    clock_in: string | null;
    lunch_start: string | null;
    lunch_end: string | null;
    clock_out: string | null;
    locations: Json | null;
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

// ✨ FUNÇÃO HELPER para conversão segura
const safeConvertToEditRequestLocation = (jsonData: Json | null): EditRequestLocation | null => {
  if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
    return null;
  }
  
  try {
    const obj = jsonData as { [key: string]: Json | undefined };
    const result: EditRequestLocation = {};
    
    const validFields = ['clock_in', 'lunch_start', 'lunch_end', 'clock_out'];
    
    for (const field of validFields) {
      if (obj[field] && typeof obj[field] === 'object' && !Array.isArray(obj[field])) {
        // ✨ Conversão segura via unknown
        result[field] = obj[field] as unknown as LocationDetailsForEdit;
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('Erro ao converter Json para EditRequestLocation:', error);
    return null;
  }
};

// Helper function para mapear campos do banco para camelCase
const mapFieldDbToCamelCase = (dbField: string): 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut' => {
  switch (dbField) {
    case 'clock_in': return 'clockIn';
    case 'lunch_start': return 'lunchStart';
    case 'lunch_end': return 'lunchEnd';
    case 'clock_out': return 'clockOut';
    default:
      console.error(`Campo inesperado do DB: ${dbField}`);
      return 'clockIn'; // Fallback seguro
  }
};

// Helper function para mapear camelCase para snake_case do banco
const mapFieldCamelCaseToDb = (camelCaseField: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut'): string => {
    switch (camelCaseField) {
        case 'clockIn': return 'clock_in';
        case 'lunchStart': return 'lunch_start';
        case 'lunchEnd': return 'lunch_end';
        case 'clockOut': return 'clock_out';
    }
};

// Função removida - não precisamos exibir email

const PendingApprovals: React.FC<PendingApprovalsProps> = ({ employees, onApprovalChange }) => {
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  // Query para buscar dados e mapear para interface do componente
  const {
    data: editRequests = [],
    isLoading,
    refetch
  } = useQuery<EditRequest[]>({
    queryKey: ['edit-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('edit_requests')
        .select('id, employee_id, employee_name, date, field, old_value, new_value, reason, created_at, status, reviewed_at, reviewed_by, location')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
          console.error('Erro ao buscar solicitações:', error);
          throw error;
      }

      // ✨ Mapear dados do banco para interface do componente
      return (data as unknown as RawEditRequestData[]).map(request => ({
        id: request.id,
        employeeId: request.employee_id,
        employeeName: request.employee_name,
        date: request.date,
        field: mapFieldDbToCamelCase(request.field),
        oldValue: request.old_value || '',
        newValue: request.new_value,
        reason: request.reason,
        timestamp: request.created_at,
        status: request.status,
        // ✨ CORRIGIDO: Usar função de conversão segura
        location: safeConvertToEditRequestLocation(request.location),
      }));
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Real-time com throttling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const subscription = supabase
      .channel('edit_requests_realtime')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'edit_requests'
        },
        () => {
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

  // Cálculos memoizados
  const { pendingRequests, processedRequests, groupedPendingRequests } = useMemo(() => {
    const pending = editRequests.filter(r => r.status === 'pending');
    const processed = editRequests.filter(r => r.status !== 'pending');

    // Agrupar solicitações pendentes
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

  // Paginação
  const paginatedProcessedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);

  // Handler para aprovação/rejeição
  const handleGroupApproval = useCallback(async (group: GroupedRequest, approved: boolean) => {
    try {
      const requestIds = group.requests.map(r => r.id);

      // Obter ID do usuário atual
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const reviewerId = user?.id || null;

      // Atualizar status das solicitações
      const { error: updateError } = await supabase
        .from('edit_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId
        })
        .in('id', requestIds);

      if (updateError) throw updateError;

      if (approved) {
        console.log('🔍 DEBUG: Aprovando solicitações para', group.employeeName, 'data:', group.date);
        
        // Buscar registro existente
        const { data: timeRecord, error: fetchError } = await supabase
          .from('time_records')
          .select('id, locations')
          .eq('user_id', group.employeeId)
          .eq('date', group.date)
          .maybeSingle<RawTimeRecordData>();

        if (fetchError) throw fetchError;
        
        console.log('🔍 DEBUG: Registro existente:', timeRecord);

        // Preparar dados para atualização
        const updateData: any = {};
        let mergedLocationContent: EditRequestLocation = safeConvertToEditRequestLocation(timeRecord?.locations) || {};
        
        console.log('🔍 DEBUG: Localizações existentes:', mergedLocationContent);

        for (const request of group.requests) {
          const dbFieldName = mapFieldCamelCaseToDb(request.field);
          
          console.log('🔍 DEBUG: Processando request:', {
            field: request.field,
            dbFieldName,
            location: request.location,
            newValue: request.newValue
          });

          // Adicionar novo valor de tempo
          updateData[dbFieldName] = request.newValue;

          // Se a solicitação tem dados de localização, extrair o valor correto
          if (request.location && request.location[dbFieldName]) {
            mergedLocationContent[dbFieldName] = request.location[dbFieldName];
            console.log('🔍 DEBUG: Adicionando localização para', dbFieldName, ':', request.location[dbFieldName]);
          } else {
            console.log('⚠️ DEBUG: Nenhuma localização encontrada para', dbFieldName);
          }
        }

        console.log('🔍 DEBUG: Localizações mescladas finais:', mergedLocationContent);
        
        // Adicionar conteúdo de localização mesclado aos dados de atualização
        updateData.locations = Object.keys(mergedLocationContent).length > 0 ? mergedLocationContent : null;
        
        console.log('🔍 DEBUG: Dados finais do update:', updateData);

        if (timeRecord) {
          // Atualizar registro existente
          console.log('🔍 DEBUG: Atualizando registro existente ID:', timeRecord.id);
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData)
            .eq('id', timeRecord.id);

          if (updateRecordError) {
            console.error('❌ DEBUG: Erro ao atualizar registro:', updateRecordError);
            throw updateRecordError;
          }
          console.log('✅ DEBUG: Registro atualizado com sucesso');
        } else {
          // Criar novo registro
          console.log('🔍 DEBUG: Criando novo registro');
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData,
            });

          if (insertError) {
            console.error('❌ DEBUG: Erro ao inserir registro:', insertError);
            throw insertError;
          }
          console.log('✅ DEBUG: Novo registro criado com sucesso');
        }

        setMessage(`Edições aprovadas para ${group.employeeName}`);
      } else {
        setMessage(`Edições rejeitadas para ${group.employeeName}`);
      }

      // Invalidar cache para recarregar dados
      queryClient.invalidateQueries({
        queryKey: ['edit-requests'],
        exact: true
      });

      // Chamar callback se fornecido
      if (onApprovalChange) {
        onApprovalChange();
      }

      // Limpar mensagem automaticamente
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
      setMessage('Erro ao processar aprovação');
      setTimeout(() => setMessage(''), 3000);
    }
  }, [queryClient, onApprovalChange]);

  // Função para obter label do campo
  const getFieldLabel = useCallback((field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    const labels = {
      clockIn: 'Entrada',
      lunchStart: 'Início do Almoço',
      lunchEnd: 'Fim do Almoço',
      clockOut: 'Saída'
    };
    return labels[field];
  }, []);

  // Loading
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

      {/* Solicitações Pendentes */}
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
                        📅 {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
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
                          {/* Exibir localização se disponível */}
                          {request.location && request.location[mapFieldCamelCaseToDb(request.field)] && (
                              <div className="text-xs text-gray-600 mt-1">
                                Localização: {request.location[mapFieldCamelCaseToDb(request.field)]?.locationName || 'N/A'}
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

      {/* Histórico */}
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

export default PendingApprovals;