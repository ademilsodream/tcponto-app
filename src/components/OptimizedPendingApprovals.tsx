import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types'; // Importar Json type

// Interface para o objeto JSON de localização que será salvo DENTRO da chave do campo (ex: "clock_in": {...})
interface LocationDetailsForEdit {
  address: string | null;
  distance: number | null; // Pode ser nulo para edições manuais
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // Timestamp da solicitação de edição
  locationName: string;
}

// Interface para a estrutura esperada na coluna location do edit_requests
// Ex: { "clock_in": { ...LocationDetailsForEdit... } }
interface EditRequestLocation {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Para permitir acesso dinâmico
}

// Interface para a estrutura esperada na coluna locations do time_records (plural)
interface TimeRecordLocationsData {
  clock_in?: LocationDetailsForEdit;
  lunch_start?: LocationDetailsForEdit;
  lunch_end?: LocationDetailsForEdit;
  clock_out?: LocationDetailsForEdit;
  [key: string]: LocationDetailsForEdit | undefined; // Para permitir acesso dinâmico
}


interface EditRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out';
  old_value: string | null;
  new_value: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
  // Adicionado a coluna location da tabela edit_requests
  location: Json | null;
}

interface TimeRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  total_hours: number | null;
  normal_hours?: number | null;
  overtime_hours?: number | null;
  normal_pay?: number | null;
  overtime_pay?: number | null;
  total_pay?: number | null;
  // A coluna locations na tabela time_records (plural)
  locations: Json | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  is_pending_approval?: boolean;
  approved_by?: string;
  approved_at?: string;
}


const PAGE_SIZE = 10;

const OptimizedPendingApproval = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth(); // Assume useAuth provides the current user

  const [currentPage, setCurrentPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const fieldNames: Record<EditRequest['field'], string> = useMemo(() => ({
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  }), []);

  const { data: requests, isLoading, error, refetch } = useQuery<EditRequest[]>({
    queryKey: ['editRequests', filterStatus],
    queryFn: async () => {
      console.log(`Fetching requests with status: ${filterStatus}`);
      const { data, error } = await supabase
        .from('edit_requests')
        .select('*')
        .eq('status', filterStatus)
        .order('requested_at', { ascending: false });

      if (error) {
        console.error("Fetch error:", error);
        throw error;
      }

      // LOG 1: Dados buscados do Supabase
      console.log('LOG 1: Fetched edit_requests:', data);

      return data || [];
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  const groupedRequests = useMemo(() => {
    if (!requests) return {};
    const groups: { [key: string]: EditRequest[] } = {};
    requests.forEach(req => {
      const key = `${req.employee_id}-${req.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(req);
    });
    console.log('LOG 2: Grouped pending requests:', groups); // LOG 2: Grupos de solicitações
    return groups;
  }, [requests]);

  const paginatedGroups = useMemo(() => {
    const groupKeys = Object.keys(groupedRequests);
    const start = currentPage * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return groupKeys.slice(start, end).reduce((obj, key) => {
      obj[key] = groupedRequests[key];
      return obj;
    }, {} as { [key: string]: EditRequest[] });
  }, [groupedRequests, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(Object.keys(groupedRequests).length / PAGE_SIZE);
  }, [groupedRequests]);

  const handlePageChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentPage(prev => {
      if (direction === 'prev') return Math.max(0, prev - 1);
      if (direction === 'next') return Math.min(totalPages - 1, prev + 1);
      return prev;
    });
  }, [totalPages]);

  const handleApproveGroup = useCallback(async (groupKey: string) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    const requestsToProcess = groupedRequests[groupKey];
    if (!requestsToProcess || requestsToProcess.length === 0) return;

    console.log(`Processing approval for group: ${groupKey}`);

    const updates = requestsToProcess.map(req => ({
      id: req.id,
      status: 'approved',
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    }));

    // Start transaction or use a function if possible for atomicity
    const { error: updateRequestsError } = await supabase
      .from('edit_requests')
      .upsert(updates); // Use upsert to update by ID

    if (updateRequestsError) {
      console.error("Error updating edit_requests status:", updateRequestsError);
      toast({
        title: "Erro",
        description: `Erro ao atualizar status das solicitações: ${updateRequestsError.message}`,
        variant: "destructive"
      });
      return;
    }

    // --- Lógica para atualizar time_records e mesclar localizações ---
    const firstRequest = requestsToProcess[0]; // Use any request from the group for user_id and date
    const userId = firstRequest.employee_id;
    const date = firstRequest.date;

    try {
      // 1. Buscar o registro time_records existente para mesclar
      console.log(`LOG 3: Fetching time_record for user ${userId} on date ${date}`);
      const { data: existingTimeRecord, error: fetchRecordError } = await supabase
        .from('time_records')
        .select('id, clock_in, lunch_start, lunch_end, clock_out, locations') // Selecionar a coluna locations
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      console.log('LOG 4: Fetched time_record for merging:', existingTimeRecord); // LOG 4: Registro time_records buscado

      if (fetchRecordError && fetchRecordError.code !== 'PGRST116') { // PGRST116 means not found
        throw fetchRecordError;
      }

      let mergedLocations: TimeRecordLocationsData = existingTimeRecord?.locations ? { ...existingTimeRecord.locations as TimeRecordLocationsData } : {};
      let updateData: any = {}; // Data to update time_records

      console.log('LOG 5: Initial mergedLocations:', mergedLocations); // LOG 5: Objeto de localizações inicial

      // 2. Iterar sobre as solicitações aprovadas e mesclar os novos valores e localizações
      for (const request of requestsToProcess) {
          // Adicionar o novo valor do campo
          updateData[request.field] = request.new_value;

          // Mesclar a localização, se existir na solicitação
          if (request.location) {
              try {
                  const requestLocation = request.location as EditRequestLocation;
                  const dbFieldName = request.field; // O nome do campo no DB (clock_in, etc.)

                  console.log(`LOG 6a: Processing location for field: ${dbFieldName}`); // LOG 6a
                  console.log('LOG 6b: Request location JSON:', requestLocation); // LOG 6b

                  // Acessar a localização específica para este campo dentro do JSON da solicitação
                  const specificLocationDetails = requestLocation[dbFieldName];

                  console.log(`LOG 6c: Specific location details for ${dbFieldName}:`, specificLocationDetails); // LOG 6c

                  if (specificLocationDetails) {
                      // Mesclar a localização específica para este campo
                      mergedLocations[dbFieldName] = specificLocationDetails;
                      console.log(`LOG 6d: Merged location for ${dbFieldName}. Current mergedLocations:`, mergedLocations); // LOG 6d
                  } else {
                       console.log(`LOG 6e: No specific location details found in request.location for field: ${dbFieldName}`); // LOG 6e
                  }

              } catch (locationParseError) {
                  console.error(`Error processing location for request ID ${request.id}:`, locationParseError);
                  // Decide how to handle this - maybe log and continue, or fail the whole group?
                  // For now, we'll just log and skip this location.
              }
          } else {
              console.log(`LOG 6f: Request ID ${request.id} has no location data.`); // LOG 6f
          }
      }

      // 3. Incluir as localizações mescladas nos dados de atualização
      updateData.locations = mergedLocations as Json; // Salvar o objeto mesclado

      console.log('LOG 7: Final updateData for time_records:', updateData); // LOG 7: Dados finais para atualização

      // 4. Realizar o upsert no time_records com os novos valores e localizações mescladas
      const { error: updateRecordError } = await supabase
        .from('time_records')
        .upsert({
          user_id: userId,
          date: date,
          ...updateData // Inclui os campos de tempo e a coluna locations
        }, { onConflict: 'date, user_id' });

      if (updateRecordError) {
        console.error("Error upserting time_records:", updateRecordError);
        throw updateRecordError;
      }

      console.log(`LOG SUCESSO: Group ${groupKey} approved and time_records updated successfully.`); // LOG SUCESSO

      toast({
        title: "Sucesso",
        description: `Solicitações para ${requestsToProcess[0].employee_name} em ${requestsToProcess[0].date} aprovadas.`,
      });

      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'approved'] });
      // Optionally invalidate time_records query for this user/date if needed elsewhere
      queryClient.invalidateQueries({ queryKey: ['today-record', userId, date] });


    } catch (error: any) {
      console.error("LOG ERRO: Error during time_records update process:", error); // LOG ERRO
      toast({
        title: "Erro",
        description: `Erro ao processar aprovação para ${requestsToProcess[0].employee_name} em ${requestsToProcess[0].date}: ${error.message}`,
        variant: "destructive"
      });
      // Consider reverting edit_requests status if time_records update fails
      // This would require another upsert call here to set status back to 'pending'
    }


  }, [groupedRequests, user, toast, queryClient]);


  const handleRejectGroup = useCallback(async (groupKey: string) => {
    if (!user) {
      toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
      return;
    }

    const requestsToProcess = groupedRequests[groupKey];
    if (!requestsToProcess || requestsToProcess.length === 0) return;

    console.log(`Processing rejection for group: ${groupKey}`);

    const updates = requestsToProcess.map(req => ({
      id: req.id,
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    }));

    const { error } = await supabase
      .from('edit_requests')
      .upsert(updates); // Use upsert to update by ID

    if (error) {
      console.error("Error updating edit_requests status on rejection:", error);
      toast({
        title: "Erro",
        description: `Erro ao rejeitar solicitações: ${error.message}`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Sucesso",
        description: `Solicitações para ${requestsToProcess[0].employee_name} em ${requestsToProcess[0].date} rejeitadas.`,
      });
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['editRequests', 'rejected'] });
    }

  }, [groupedRequests, user, toast, queryClient]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando solicitações...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Erro ao carregar solicitações: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const hasGroups = Object.keys(paginatedGroups).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-8">
      <Card className="max-w-4xl mx-auto bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-blue-600">
            Solicitações de Alteração de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-center space-x-4">
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={filterStatus === 'approved' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('approved')}
            >
              Aprovadas
            </Button>
            <Button
              variant={filterStatus === 'rejected' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('rejected')}
            >
              Rejeitadas
            </Button>
          </div>

          {!hasGroups && (
            <div className="text-center text-gray-500 py-8">
              Nenhuma solicitação {filterStatus === 'pending' ? 'pendente' : filterStatus === 'approved' ? 'aprovada' : 'rejeitada'} encontrada.
            </div>
          )}

          {hasGroups && (
            <div className="space-y-6">
              {Object.entries(paginatedGroups).map(([groupKey, requestsInGroup]) => (
                <Card key={groupKey} className="border-l-4 border-blue-500">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {requestsInGroup[0].employee_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Data: {format(new Date(requestsInGroup[0].date + 'T12:00:00Z'), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge
                        className={`px-3 py-1 text-xs font-medium ${
                          filterStatus === 'pending' ? 'bg-yellow-500 text-white' :
                          filterStatus === 'approved' ? 'bg-green-500 text-white' :
                          'bg-red-500 text-white'
                        }`}
                      >
                        {filterStatus === 'pending' ? 'Pendente' : filterStatus === 'approved' ? 'Aprovada' : 'Rejeitada'}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-4">
                      {requestsInGroup.map(req => (
                        <div key={req.id} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            Campo: <span className="font-normal">{fieldNames[req.field]}</span>
                          </p>
                          <p className="text-sm text-gray-700 mb-1">
                            Valor Antigo: <span className="font-normal">{req.old_value || 'Não registrado'}</span>
                          </p>
                          <p className="text-sm text-gray-700 mb-1">
                            Novo Valor: <span className="font-normal text-blue-600">{req.new_value}</span>
                          </p>
                           <p className="text-sm text-gray-700 italic mb-1">
                            Motivo: <span className="font-normal">{req.reason}</span>
                          </p>
                           {/* Opcional: Exibir detalhes da localização da solicitação se existir */}
                           {req.location && (
                               <div className="text-xs text-gray-500 mt-2">
                                   Localização na solicitação ({fieldNames[req.field]}):
                                   <pre className="whitespace-pre-wrap break-words text-gray-700 bg-gray-100 p-1 rounded mt-1">
                                        {JSON.stringify((req.location as EditRequestLocation)?.[req.field], null, 2)}
                                   </pre>
                               </div>
                           )}
                        </div>
                      ))}
                    </div>

                    {filterStatus === 'pending' && (
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectGroup(groupKey)}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveGroup(groupKey)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                      </div>
                    )}

                     {filterStatus !== 'pending' && requestsInGroup[0].processed_by && (
                         <div className="text-right text-sm text-gray-500 mt-2">
                             Processado por: {requestsInGroup[0].processed_by} em {requestsInGroup[0].processed_at ? format(new Date(requestsInGroup[0].processed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                         </div>
                     )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {hasGroups && totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('prev')}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="text-sm text-gray-700">
                Página {currentPage + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('next')}
                disabled={currentPage >= totalPages - 1}
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default OptimizedPendingApproval;
