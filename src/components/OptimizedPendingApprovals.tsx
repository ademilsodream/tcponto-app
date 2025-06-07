import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, User, CalendarDays, Tag, Text, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Json } from '@/types/supabase';


interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  locationName: string;
}


interface LocationContent {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined;
}


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
  location?: LocationContent | null;
}


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


const mapFieldDbToCamelCase = (dbField: string): 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut' => {
  switch (dbField) {
    case 'clock_in': return 'clockIn';
    case 'lunch_start': return 'lunchStart';
    case 'lunch_end': return 'lunchEnd';
    case 'clock_out': return 'clockOut';
    default:
      console.error(`Unexpected field value from DB: ${dbField}`);
      return dbField as any;
  }
};


const mapFieldCamelCaseToDb = (camelCaseField: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut'): string => {
    switch (camelCaseField) {
        case 'clockIn': return 'clock_in';
        case 'lunchStart': return 'lunch_start';
        case 'lunchEnd': return 'lunch_end';
        case 'clockOut': return 'clock_out';
    }
};


const OptimizedPendingApprovals: React.FC<PendingApprovalsProps> = ({ employees, onApprovalChange }) => {
  const [message, setMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();


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
          console.error('Error fetching edit requests:', error);
          throw error;
      }


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
        location: request.location as unknown as LocationContent | null,
      }));
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1
  });


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


  const { pendingRequests, processedRequests, groupedPendingRequests } = useMemo(() => {
    const pending = editRequests.filter(r => r.status === 'pending');
    const processed = editRequests.filter(r => r.status !== 'pending');


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


  const paginatedProcessedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);


  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);


  const handleGroupApproval = useCallback(async (group: GroupedRequest, approved: boolean) => {
    try {
      console.log('🚀 Processando:', group.employeeName, 'Aprovação:', approved);


      const requestIds = group.requests.map(r => r.id);


      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }
      const reviewerId = user.id;


      if (approved) {
        console.log('✅ Aprovando solicitações para:', group.employeeName, group.date);


        const { data: existingTimeRecord, error: fetchTimeRecordError } = await supabase
          .from('time_records')
          .select('id, clock_in, lunch_start, lunch_end, clock_out, locations')
          .eq('user_id', group.employeeId)
          .eq('date', group.date)
          .maybeSingle<RawTimeRecordData>();


        if (fetchTimeRecordError) {
          console.error('Erro ao buscar registro existente:', fetchTimeRecordError);
          throw new Error(`Erro ao buscar registro de ponto: ${fetchTimeRecordError.message}`);
        }


        console.log('🔍 DEBUG: Registro existente encontrado:', existingTimeRecord);


        const timeRecordDataToSave: any = {
          user_id: group.employeeId,
          date: group.date,
          clock_in: existingTimeRecord?.clock_in || null,
          lunch_start: existingTimeRecord?.lunch_start || null,
          lunch_end: existingTimeRecord?.lunch_end || null,
          clock_out: existingTimeRecord?.clock_out || null,
          locations: (existingTimeRecord?.locations as unknown as LocationContent) || {},
        };


        console.log('🔍 DEBUG: Dados iniciais para salvar:', timeRecordDataToSave);


        for (const request of group.requests) {
          const dbFieldName = mapFieldCamelCaseToDb(request.field);
          timeRecordDataToSave[dbFieldName] = request.newValue;


          if (request.location && request.location[dbFieldName]) {
            timeRecordDataToSave.locations[dbFieldName] = request.location[dbFieldName];
            console.log(`🔍 DEBUG: Mesclando localização para ${dbFieldName}:`, request.location[dbFieldName]);
          } else {
            console.log(`⚠️ DEBUG: Nenhuma localização na solicitação para ${dbFieldName}`);
          }
        }


        if (Object.keys(timeRecordDataToSave.locations).length === 0) {
          timeRecordDataToSave.locations = null;
        }


        console.log('🔍 DEBUG: Dados finais para salvar em time_records:', timeRecordDataToSave);


        let timeRecordOperationError = null;


        if (existingTimeRecord) {
          console.log('🔍 DEBUG: Atualizando registro existente ID:', existingTimeRecord.id);
          const { error } = await supabase
            .from('time_records')
            .update(timeRecordDataToSave)
            .eq('id', existingTimeRecord.id);
          timeRecordOperationError = error;
          console.log('🔍 DEBUG: Resultado do update:', { error });


        } else {
          console.log('🔍 DEBUG: Criando novo registro');
          const { error } = await supabase
            .from('time_records')
            .insert(timeRecordDataToSave);
          timeRecordOperationError = error;
          console.log('🔍 DEBUG: Resultado do insert:', { error });
        }


        if (timeRecordOperationError) {
          console.error('❌ Erro na operação time_records:', timeRecordOperationError);
          throw new Error(`Erro ao salvar registro de ponto: ${timeRecordOperationError.message}`);
        }


        console.log('✅ Operação time_records bem-sucedida.');


        console.log('🔍 DEBUG: Atualizando status das edit_requests para approved');
        const { error: updateRequestsError } = await supabase
          .from('edit_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerId,
          })
          .in('id', requestIds);


        if (updateRequestsError) {
          console.error('❌ Erro ao atualizar status das edit_requests:', updateRequestsError);
          // Consider rolling back time_records changes here if necessary
          throw new Error(`Erro ao finalizar solicitações: ${updateRequestsError.message}`);
        }


        console.log('✅ Status das edit_requests atualizado para approved.');


        setMessage(`✅ Solicitações de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} aprovadas com sucesso!`);


      } else { // --- Lógica para Rejeição ---
        console.log('❌ Rejeitando solicitações para:', group.employeeName, group.date);
        const { error } = await supabase
          .from('edit_requests')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewerId,
          })
          .in('id', requestIds);


        if (error) {
          console.error('Erro ao rejeitar solicitações:', error);
          throw new Error(`Erro ao rejeitar solicitações: ${error.message}`);
        }


        setMessage(`❌ Solicitações de ${group.employeeName} para ${new Date(group.date).toLocaleDateString('pt-BR')} rejeitadas.`);
      }


      // Invalidate queries to refetch data and update the UI
      queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
      if (onApprovalChange) {
        // Notify parent component if needed (e.g., to update counts)
        onApprovalChange();
      }


    } catch (error: any) {
      console.error('Erro geral no processamento:', error);
      setMessage(`⚠️ Erro ao processar solicitação: ${error.message}`);
    } finally {
      // Clear message after a few seconds
      setTimeout(() => setMessage(''), 5000);
    }
  }, [queryClient, onApprovalChange]);


  const getFieldLabel = useCallback((field: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut') => {
    const labels = {
      clockIn: 'Entrada',
      lunchStart: 'Início do Almoço',
      lunchEnd: 'Fim do Almoço',
      clockOut: 'Saída'
    };
    return labels[field];
  }, []);


  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4"> {/* Adjusted space */}
      {message && (
        <Alert className={`border ${message.startsWith('✅') ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
          {message.startsWith('✅') ? <CheckCircle className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
          <AlertDescription className={`${message.startsWith('✅') ? 'text-green-800' : 'text-red-800'} text-sm`}> {/* Reduced text size */}
            {message}
          </AlertDescription>
        </Alert>
      )}


      {/* Pending Requests - More Compact Card Layout */}
      <Card>
        <CardHeader className="pb-2"> {/* Reduced padding */}
          <CardTitle className="flex items-center gap-2 text-base"> {/* Reduced title size */}
            <Clock className="w-4 h-4" /> {/* Reduced icon size */}
            Solicitações Pendentes ({groupedPendingRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {groupedPendingRequests.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm"> {/* Reduced padding */}
              Nenhuma solicitação pendente
            </p>
          ) : (
            <div className="space-y-2"> {/* Reduced space */}
              {groupedPendingRequests.map((group) => (
                <div key={`${group.employeeId}-${group.date}`} className="border rounded-md p-2 bg-yellow-50 border-yellow-200 text-xs"> {/* Reduced padding and text size */}
                  <div className="flex justify-between items-center mb-1"> {/* Reduced margin */}
                    <div>
                      <h4 className="font-medium text-gray-900 flex items-center gap-1 text-sm"> {/* Reduced text size */}
                        <User className="w-3 h-3" /> {group.employeeName}
                      </h4>
                      <p className="text-xs text-gray-600 flex items-center gap-1"> {/* Reduced text size */}
                        <CalendarDays className="w-3 h-3" /> {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(group.timestamp).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>


                  <div className="mb-1"> {/* Reduced margin */}
                    <h5 className="font-medium mb-0.5 text-xs">Ajustes:</h5> {/* Reduced margin */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1"> {/* Reduced gap */}
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-xs border rounded p-1.5 bg-white space-y-0.5"> {/* Reduced padding */}
                          <div className="font-medium flex items-center gap-1"><Tag className="w-3 h-3" /> {getFieldLabel(request.field)}</div>
                          <div className="flex justify-between text-xs">
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          {request.location && request.location[mapFieldCamelCaseToDb(request.field)] && (
                              <div className="text-[11px] text-gray-600 flex items-start gap-1"> {/* Smaller text */}
                                <MapPin className="w-3 h-3 mt-0.5" />
                                <span className="flex-1">Localização: {request.location[mapFieldCamelCaseToDb(request.field)]?.locationName || 'N/A'}</span>
                              </div>
                          )}
                          {request.reason && (
                            <div className="text-[11px] text-gray-600 flex items-start gap-1"> {/* Smaller text */}
                              <Text className="w-3 h-3 mt-0.5" />
                              <span className="flex-1">Motivo: {request.reason}</span>
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
                      className="bg-green-600 hover:bg-green-700 text-xs h-6 px-2" // Reduced height
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleGroupApproval(group, false)}
                      className="text-xs h-6 px-2" // Reduced height
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      {/* History - More Compact Card Layout */}
      {processedRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-2"> {/* Reduced padding */}
            <CardTitle className="flex items-center justify-between text-base"> {/* Reduced title size */}
              <span>Histórico</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1"> {/* Reduced gap */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-6 px-1.5 text-xs" // Reduced height, padding, text size
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <span className="text-xs text-gray-600">
                    {currentPage}/{totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="h-6 px-1.5 text-xs" // Reduced height, padding, text size
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2"> {/* Reduced space */}
              {paginatedProcessedRequests.map((request) => (
                <div key={request.id} className="border rounded-md p-2 bg-gray-50 border-gray-200 text-xs"> {/* Reduced padding and text size */}
                  <div className="flex justify-between items-center mb-1"> {/* Reduced margin */}
                    <div>
                      <h4 className="font-medium text-gray-900 flex items-center gap-1 text-sm"> {/* Reduced text size */}
                        <User className="w-3 h-3" /> {request.employeeName}
                      </h4>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {new Date(request.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Badge
                      variant={request.status === 'approved' ? 'default' : 'destructive'}
                      className="text-xs flex items-center gap-1"
                    >
                      {request.status === 'approved' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                    </Badge>
                  </div>


                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1 font-medium text-gray-800">
                      <Tag className="w-3 h-3" /> Campo: {getFieldLabel(request.field)}
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                      <span className="text-green-600">Para: {request.newValue}</span>
                    </div>
                    {request.location && request.location[mapFieldCamelCaseToDb(request.field)] && (
                        <div className="text-[11px] text-gray-600 flex items-start gap-1"> {/* Smaller text */}
                          <MapPin className="w-3 h-3 mt-0.5" />
                          <span className="flex-1">Localização: {request.location[mapFieldCamelCaseToDb(request.field)]?.locationName || 'N/A'}</span>
                        </div>
                    )}
                    {request.reason && (
                        <div className="text-[11px] text-gray-600 flex items-start gap-1"> {/* Smaller text */}
                          <Text className="w-3 h-3 mt-0.5" />
                          <span className="flex-1">Motivo: {request.reason}</span>
                        </div>
                    )}
                  </div>
                  <p className="text-right text-[10px] text-gray-500 mt-1"> {/* Smaller text and margin */}
                    Solicitado em: {new Date(request.timestamp).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 pb-3"> {/* Reduced gap and padding */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-6 px-1.5 text-xs" // Reduced size
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-6 px-1.5 text-xs" // Reduced size
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};


export default OptimizedPendingApprovals;
