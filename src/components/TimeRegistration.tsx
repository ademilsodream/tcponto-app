import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentLocation, isLocationAllowed } from '@/utils/locationValidation';
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
  const { user } = useAuth();
  const { toast } = useToast();

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

    // Verificar localização antes de permitir registro
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

      // Incluir localização no registro
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

      // Incluir localização na solicitação de edição
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

  const fieldNames = {
    clock_in: 'Entrada',
    lunch_start: 'Início do Almoço',
    lunch_end: 'Fim do Almoço',
    clock_out: 'Saída'
  };

  return (
    <div className="space-y-6">
      <TimeRegistrationProgress record={timeRecord || { clockIn: undefined, lunchStart: undefined, lunchEnd: undefined, clockOut: undefined }} />

      {/* Validação de Localização */}
      <Card className={locationValidated ? 'border-green-200' : 'border-red-200'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className={`w-5 h-5 ${locationValidated ? 'text-green-600' : 'text-red-600'}`} />
            Status de Localização
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locationValidated ? (
            <div className="flex items-center gap-2 text-green-700">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Localização autorizada para registro de ponto</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-4 h-4" />
                <span>Localização não autorizada</span>
              </div>
              {locationError && (
                <p className="text-sm text-gray-600">{locationError}</p>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={validateCurrentLocation}
                disabled={submitting}
              >
                Verificar Localização Novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Registro */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => handleTimeAction('clock_in')}
          disabled={submitting || !!timeRecord?.clock_in || !locationValidated}
          className="h-20 text-lg"
          variant={timeRecord?.clock_in ? "secondary" : "default"}
        >
          <Clock className="w-6 h-6 mr-2" />
          {timeRecord?.clock_in ? `Entrada: ${timeRecord.clock_in}` : 'Registrar Entrada'}
        </Button>

        <Button
          onClick={() => handleTimeAction('lunch_start')}
          disabled={submitting || !timeRecord?.clock_in || !!timeRecord?.lunch_start || !locationValidated}
          className="h-20 text-lg"
          variant={timeRecord?.lunch_start ? "secondary" : "default"}
        >
          <Clock className="w-6 h-6 mr-2" />
          {timeRecord?.lunch_start ? `Almoço: ${timeRecord.lunch_start}` : 'Início Almoço'}
        </Button>

        <Button
          onClick={() => handleTimeAction('lunch_end')}
          disabled={submitting || !timeRecord?.lunch_start || !!timeRecord?.lunch_end || !locationValidated}
          className="h-20 text-lg"
          variant={timeRecord?.lunch_end ? "secondary" : "default"}
        >
          <Clock className="w-6 h-6 mr-2" />
          {timeRecord?.lunch_end ? `Retorno: ${timeRecord.lunch_end}` : 'Fim Almoço'}
        </Button>

        <Button
          onClick={() => handleTimeAction('clock_out')}
          disabled={submitting || !timeRecord?.clock_in || !!timeRecord?.clock_out || !locationValidated}
          className="h-20 text-lg"
          variant={timeRecord?.clock_out ? "secondary" : "default"}
        >
          <Clock className="w-6 h-6 mr-2" />
          {timeRecord?.clock_out ? `Saída: ${timeRecord.clock_out}` : 'Registrar Saída'}
        </Button>
      </div>

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
