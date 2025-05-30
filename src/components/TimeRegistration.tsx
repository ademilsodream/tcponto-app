import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, MapPin, AlertTriangle, LogIn, Coffee, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentLocation, isLocationAllowed } from '@/utils/locationValidation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeRegistrationProgress from '@/components/TimeRegistrationProgress';

interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  total_hours: number;
  locations?: any;
}

interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
}

const TimeRegistration = () => {
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationValidated, setLocationValidated] = useState(false);
  const [locationError, setLocationError] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editField, setEditField] = useState<'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user } = useAuth();
  const { toast } = useToast();

  // Atualizar relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      loadTodayRecord();
      loadAllowedLocations();
      validateCurrentLocation();
    }
  }, [user]);

  const loadAllowedLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setAllowedLocations(data || []);
    } catch (error) {
      console.error('Erro ao carregar localizações permitidas:', error);
    }
  };

  const validateCurrentLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      const validation = isLocationAllowed(location, allowedLocations);
      
      if (validation.allowed) {
        setLocationValidated(true);
        setLocationError('');
        toast({
          title: "Localização válida",
          description: `Você está próximo a ${validation.closestLocation?.name}`,
        });
      } else {
        setLocationValidated(false);
        const message = validation.closestLocation 
          ? `Você está a ${Math.round(validation.distance || 0)}m de ${validation.closestLocation.name}. Range permitido: ${validation.closestLocation.range_meters}m`
          : 'Nenhuma localização permitida encontrada próxima';
        setLocationError(message);
        toast({
          title: "Localização não permitida",
          description: message,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Erro ao validar localização:', error);
      setLocationError(error.message || 'Erro ao obter localização');
      toast({
        title: "Erro de localização",
        description: error.message || 'Não foi possível obter sua localização',
        variant: "destructive"
      });
    }
  };

  const loadTodayRecord = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setTimeRecord(data);
    } catch (error) {
      console.error('Erro ao carregar registro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar registro do dia",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTimeAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) return;

    if (!locationValidated) {
      toast({
        title: "Localização não permitida",
        description: "Você precisa estar em uma localização autorizada para registrar o ponto",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      let updateData: any = {
        [action]: currentTime,
        updated_at: new Date().toISOString()
      };

      if (currentLocation) {
        const locationData = {
          [action]: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            timestamp: now.toISOString(),
            address: allowedLocations.find(loc => {
              const validation = isLocationAllowed(currentLocation, [loc]);
              return validation.allowed;
            })?.address || 'Localização não identificada'
          }
        };

        if (timeRecord?.locations) {
          updateData.locations = { ...timeRecord.locations, ...locationData };
        } else {
          updateData.locations = locationData;
        }
      }

      if (timeRecord) {
        const { error } = await supabase
          .from('time_records')
          .update(updateData)
          .eq('id', timeRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            ...updateData
          });

        if (error) throw error;
      }

      await loadTodayRecord();
      
      const actionNames = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      toast({
        title: "Sucesso",
        description: `${actionNames[action]} registrada às ${currentTime}`,
      });

    } catch (error) {
      console.error('Erro ao registrar:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar horário",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (field: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    setEditField(field);
    setEditValue(timeRecord?.[field] || '');
    setEditReason('');
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!user || !editField || !editValue || !editReason) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      let locationData = null;
      if (currentLocation) {
        locationData = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          timestamp: new Date().toISOString(),
          address: allowedLocations.find(loc => {
            const validation = isLocationAllowed(currentLocation, [loc]);
            return validation.allowed;
          })?.address || 'Localização no momento da solicitação'
        };
      }

      const { error } = await supabase
        .from('edit_requests')
        .insert({
          employee_id: user.id,
          employee_name: user.email || 'Usuário',
          date: new Date().toISOString().split('T')[0],
          field: editField,
          old_value: timeRecord?.[editField] || null,
          new_value: editValue,
          reason: editReason,
          location: locationData,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Solicitação de alteração enviada para aprovação",
      });

      setIsEditDialogOpen(false);
      setEditField(null);
      setEditValue('');
      setEditReason('');

    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação de alteração",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  const steps = [
    { key: 'clock_in', label: 'Entrada', icon: LogIn, color: 'bg-green-500' },
    { key: 'lunch_start', label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'lunch_end', label: 'Fim Almoço', icon: Coffee, color: 'bg-orange-500' },
    { key: 'clock_out', label: 'Saída', icon: LogOut, color: 'bg-red-500' },
  ];

  const getValue = (key: string) => {
    return timeRecord?.[key as keyof TimeRecord];
  };

  const completedCount = steps.filter(step => getValue(step.key)).length;

  // Determinar próxima ação
  const getNextAction = () => {
    if (!timeRecord?.clock_in) return 'clock_in';
    if (!timeRecord?.lunch_start) return 'lunch_start';
    if (!timeRecord?.lunch_end) return 'lunch_end';
    if (!timeRecord?.clock_out) return 'clock_out';
    return null;
  };

  const nextAction = getNextAction();
  
  const actionLabels = {
    clock_in: 'Registrar Entrada',
    lunch_start: 'Registrar Saída',
    lunch_end: 'Registrar Entrada',
    clock_out: 'Registrar Saída'
  };

  const fieldNames = {
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Data e Hora Atual */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="text-center py-8">
          <div className="text-blue-700 text-lg font-medium mb-2">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="text-blue-900 text-5xl font-bold tracking-wider">
            {format(currentTime, 'HH:mm:ss')}
          </div>
        </CardContent>
      </Card>

      {/* Progresso do Dia */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-700">Progresso do Dia</h3>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-600">
                {completedCount}/4 registros
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = !!getValue(step.key);
              const isNext = !isCompleted && completedCount === index;

              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-200 ${
                      isCompleted 
                        ? `${step.color} text-white shadow-md` 
                        : isNext
                          ? 'bg-gray-200 border-2 border-blue-400 text-gray-600'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-sm text-center leading-tight ${
                    isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                  {isCompleted && (
                    <span className="text-sm text-gray-600 mt-1">
                      {getValue(step.key)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / 4) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão de Registro */}
      {nextAction && (
        <Card>
          <CardContent className="p-6">
            <Button
              onClick={() => handleTimeAction(nextAction)}
              disabled={submitting || !locationValidated}
              className="w-full h-16 text-xl font-semibold bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <Clock className="w-6 h-6 mr-3" />
              {actionLabels[nextAction]}
            </Button>
            
            {!locationValidated && (
              <div className="mt-3 text-center">
                <div className="flex items-center justify-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Localização não autorizada</span>
                </div>
                {locationError && (
                  <p className="text-xs text-gray-600 mt-1">{locationError}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botões de Edição */}
      {timeRecord && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitar Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {(['clock_in', 'lunch_start', 'lunch_end', 'clock_out'] as const).map((field) => (
                <Button
                  key={field}
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(field)}
                  disabled={!timeRecord[field]}
                >
                  Editar {fieldNames[field]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Solicitar Alteração - {editField ? fieldNames[editField] : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-value">Novo Horário</Label>
              <Input
                id="edit-value"
                type="time"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Motivo da Alteração *</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Descreva o motivo da solicitação de alteração..."
                required
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleEditSubmit}
                disabled={submitting || !editValue || !editReason}
              >
                {submitting ? 'Enviando...' : 'Enviar Solicitação'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TimeRegistration;
