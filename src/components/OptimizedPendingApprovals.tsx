import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ✨ DEFINIR TIPO Json LOCALMENTE
type Json = 
  | string 
  | number 
  | boolean 
  | null 
  | { [key: string]: Json } 
  | Json[];

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
  location?: EditRequestLocation | null; // Coluna 'location' na tabela 'edit_requests'
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

// ✨ FUNÇÃO HELPER para conversão segura
const safeConvertToEditRequestLocation = (jsonData: Json | null): EditRequestLocation | null => {
  // Retorna null se não há dados
  if (!jsonData) {
    return null;
  }
  
  // Retorna null se não é um objeto válido
  if (typeof jsonData !== 'object' || Array.isArray(jsonData)) {
    return null;
  }
  
  try {
    // Conversão via unknown para evitar erros TypeScript
    const obj = jsonData as unknown as { [key: string]: any };
    const result: EditRequestLocation = {};
    
    const validFields = ['clock_in', 'lunch_start', 'lunch_end', 'clock_out'];
    
    for (const field of validFields) {
      const fieldData = obj[field];
      
      // Verificar se o campo existe e é um objeto válido
      if (fieldData && 
          typeof fieldData === 'object' && 
          !Array.isArray(fieldData) &&
          fieldData !== null) {
        
        // Conversão mais segura via unknown
        result[field] = fieldData as unknown as LocationDetailsForEdit;
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error('Erro ao converter Json para EditRequestLocation:', error);
    return null;
  }
};

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
        .select('*') // Busca todas as colunas, incluindo 'location'
        .order('created_at', { ascending: false });

      if (error) throw error;

      // ✨ FUNÇÃO para mapear campo do banco (pode vir como snake_case) para camelCase
      const mapFieldFromDb = (dbField: string): 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut' => {
        // Se já estiver em camelCase, retorna diretamente
        const camelCaseFields = ['clockIn', 'lunchStart', 'lunchEnd', 'clockOut'];
        if (camelCaseFields.includes(dbField)) {
          return dbField as 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut';
        }
        
        // Se estiver em snake_case, converte para camelCase
        const fieldMap: { [key: string]: 'clockIn' | 'lunchStart' | 'lunchEnd' | 'clockOut' } = {
          'clock_in': 'clockIn',
          'lunch_start': 'lunchStart', 
          'lunch_end': 'lunchEnd',
          'clock_out': 'clockOut'
        };
        
        return fieldMap[dbField] || 'clockIn';
      };

      const formattedRequests = data?.map(request => {
        // ✨ DEBUG: Log para verificar dados do banco
        console.log('🔍 DEBUG - Dados do banco:', {
          field_original: request.field,
          field_mapeado: mapFieldFromDb(request.field),
          employee_name: request.employee_name,
          location: request.location
        });

        return {
          id: request.id,
          employeeId: request.employee_id,
          employeeName: request.employee_name,
          date: request.date,
          // ✨ CORRIGIDO: Usar função de mapeamento para garantir camelCase
          field: mapFieldFromDb(request.field),
          oldValue: request.old_value || '',
          newValue: request.new_value,
          reason: request.reason,
          timestamp: request.created_at,
          status: request.status as 'pending' | 'approved' | 'rejected',
          // ✨ CORRIGIDO: Usar função de conversão segura em vez de casting direto
          location: safeConvertToEditRequestLocation(request.location),
        };
      }) || [];

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
        // ✨ CORRIGIDO: Buscar a coluna 'locations' da tabela 'time_records'
        const { data: timeRecord, error: fetchError } = await supabase
          .from('time_records')
          .select('id, locations') // ✨ Usar 'locations' (plural)
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

        // Lógica para mesclar localizações
        // ✨ CORRIGIDO: Inicia com a localização existente da coluna 'locations'
        let mergedLocations: any = timeRecord?.locations || {}; // ✨ Usar 'locations' (plural)

        for (const request of group.requests) {
          const dbFieldName = fieldMap[request.field] as keyof EditRequestLocation; // Nome do campo no DB (snake_case)
          updateData[dbFieldName] = request.newValue; // Adiciona o novo valor do horário

          // Se a solicitação de edição tiver dados de localização para este campo, mesclar
          // A solicitação de edição tem a coluna 'location' (singular) com a estrutura JSON interna
          if (request.location && request.location[dbFieldName]) {
             mergedLocations[dbFieldName] = request.location[dbFieldName];
          }
        }

        // ✨ CORRIGIDO: Adicionar o objeto de localização mesclada à coluna 'locations'
        updateData.locations = mergedLocations; // ✨ Usar 'locations' (plural)

        if (timeRecord) {
          // Atualizar registro existente
          const { error: updateRecordError } = await supabase
            .from('time_records')
            .update(updateData) // ✨ updateData agora inclui locations mesclada
            .eq('id', timeRecord.id);

          if (updateRecordError) throw updateRecordError;
        } else {
          // Criar novo registro
          const { error: insertError } = await supabase
            .from('time_records')
            .insert({
              user_id: group.employeeId,
              date: group.date,
              ...updateData, // ✨ updateData agora inclui locations mesclada
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

  // ✨ FUNÇÃO para obter localização específica do campo
  const getFieldLocation = (request: EditRequest): string => {
    if (!request.location) return 'N/A';
    
    const fieldMap = {
      clockIn: 'clock_in',
      lunchStart: 'lunch_start', 
      lunchEnd: 'lunch_end',
      clockOut: 'clock_out'
    };
    
    const dbFieldName = fieldMap[request.field];
    const locationData = request.location[dbFieldName];
    
    return locationData?.locationName || 'N/A';
  };

  // ✨ FUNÇÃO para calcular diferença de horas
  const calculateTimeDifference = (oldTime: string, newTime: string): number => {
    if (!oldTime || !newTime) return 0;
    
    try {
      const [oldHour, oldMin] = oldTime.split(':').map(Number);
      const [newHour, newMin] = newTime.split(':').map(Number);
      
      const oldMinutes = oldHour * 60 + oldMin;
      const newMinutes = newHour * 60 + newMin;
      
      return Math.abs(newMinutes - oldMinutes) / 60; // Retorna em horas
    } catch {
      return 0;
    }
  };

  // ✨ FUNÇÃO para calcular total de horas trabalhadas dos novos horários
  const calculateWorkingHours = (group: GroupedRequest): number => {
    // Organizar os horários por tipo
    const times: { [key: string]: string } = {};
    
    group.requests.forEach(request => {
      if (request.newValue) {
        times[request.field] = request.newValue;
      }
    });

    try {
      const clockIn = times.clockIn;
      const lunchStart = times.lunchStart;
      const lunchEnd = times.lunchEnd;
      const clockOut = times.clockOut;

      let totalHours = 0;

      // Calcular horas da manhã (entrada até início do almoço)
      if (clockIn && lunchStart) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [lunchStartHour, lunchStartMin] = lunchStart.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMin;
        
        if (lunchStartMinutes > inMinutes) {
          totalHours += (lunchStartMinutes - inMinutes) / 60;
        }
      }

      // Calcular horas da tarde (fim do almoço até saída)
      if (lunchEnd && clockOut) {
        const [lunchEndHour, lunchEndMin] = lunchEnd.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > lunchEndMinutes) {
          totalHours += (outMinutes - lunchEndMinutes) / 60;
        }
      }

      // Se não tem horário de almoço, calcular direto entrada até saída
      if (clockIn && clockOut && (!lunchStart || !lunchEnd)) {
        const [inHour, inMin] = clockIn.split(':').map(Number);
        const [outHour, outMin] = clockOut.split(':').map(Number);
        
        const inMinutes = inHour * 60 + inMin;
        const outMinutes = outHour * 60 + outMin;
        
        if (outMinutes > inMinutes) {
          totalHours = (outMinutes - inMinutes) / 60;
        }
      }

      return totalHours;
    } catch {
      return 0;
    }
  };

  // ✨ FUNÇÃO para calcular total de horas ajustadas de um grupo (mantida para diferenças individuais)
  const calculateGroupTotalHours = (group: GroupedRequest): number => {
    return group.requests.reduce((total, request) => {
      return total + calculateTimeDifference(request.oldValue, request.newValue);
    }, 0);
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
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{group.employeeName}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(group.date).toLocaleDateString('pt-BR')} - {group.requests.length} ajuste(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-2">
                        {new Date(group.timestamp).toLocaleDateString('pt-BR')}
                      </Badge>
                      {/* ✨ NOVO: Total de horas trabalhadas dos novos horários */}
                      <div className="bg-blue-100 px-3 py-1 rounded-full">
                        <p className="text-xs text-blue-800 font-semibold">
                          ⏱️ {calculateWorkingHours(group).toFixed(2)}h trabalhadas
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h5 className="font-medium mb-2">Ajustes:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.requests.map((request) => (
                        <div key={request.id} className="text-sm border rounded p-2 bg-white">
                          {/* ✨ CORRIGIDO: Usar getFieldLabel corretamente */}
                          <div className="font-medium flex justify-between items-center">
                            <span>{getFieldLabel(request.field)}</span>
                            {/* ✨ NOVO: Mostrar o novo horário em destaque */}
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded font-semibold">
                              {request.newValue || 'Vazio'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-red-600">De: {request.oldValue || 'Vazio'}</span>
                            <span className="text-green-600">Para: {request.newValue}</span>
                          </div>
                          {/* ✨ CORRIGIDO: Exibir localização específica para cada campo */}
                          <div className="text-xs text-gray-600 mt-1">
                            📍 {getFieldLocation(request)}
                          </div>
                          {request.reason && (
                            <div className="text-xs text-gray-600 mt-1">
                              💬 {request.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* ✨ NOVO: Resumo das horas trabalhadas */}
                    {calculateWorkingHours(group) > 0 && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-800">
                            📊 Total de horas trabalhadas com os novos horários:
                          </span>
                          <span className="text-lg font-bold text-blue-900">
                            {calculateWorkingHours(group).toFixed(2)}h
                          </span>
                        </div>
                      </div>
                    )}
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