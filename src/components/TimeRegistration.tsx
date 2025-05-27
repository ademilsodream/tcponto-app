import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TimeRegistrationProgress from './TimeRegistrationProgress';
import { useToast } from '@/hooks/use-toast';

interface TimeRecord {
  id: string;
  date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  status: string;
  location: string | null;
}

interface TimeRegistrationProps {
  selectedDate: string;
}

const TimeRegistration: React.FC<TimeRegistrationProps> = ({ selectedDate }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeRecord, setTimeRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      loadTimeRecord();
    }
  }, [selectedDate, user]);

  const loadTimeRecord = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading time record:', error);
        return;
      }

      setTimeRecord(data);
    } catch (error) {
      console.error('Error loading time record:', error);
    }
  };

  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não é suportada por este navegador.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    });
  };

  const registerTime = async (type: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    if (!user) return;

    setLoading(true);
    try {
      let currentLocation = null;
      try {
        const loc = await getCurrentLocation();
        currentLocation = `${loc.latitude},${loc.longitude}`;
      } catch (locationError) {
        console.warn('Não foi possível obter a localização:', locationError);
      }

      const currentTime = new Date().toLocaleTimeString('pt-BR', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      if (timeRecord) {
        const { error } = await supabase
          .from('time_records')
          .update({ 
            [type]: currentTime,
            location: currentLocation || timeRecord.location
          })
          .eq('id', timeRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: selectedDate,
            [type]: currentTime,
            location: currentLocation,
            status: 'active'
          });

        if (error) throw error;
      }

      await loadTimeRecord();
      
      const typeLabels = {
        clock_in: 'Entrada',
        lunch_start: 'Início do Almoço',
        lunch_end: 'Fim do Almoço',
        clock_out: 'Saída'
      };

      toast({
        title: "Registro realizado!",
        description: `${typeLabels[type]} registrada às ${currentTime}`,
      });

    } catch (error) {
      console.error('Error registering time:', error);
      toast({
        title: "Erro",
        description: "Erro ao registrar o ponto. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNextAction = () => {
    if (!timeRecord) return { type: 'clock_in', label: 'Registrar Entrada', icon: Clock };
    if (!timeRecord.clock_in) return { type: 'clock_in', label: 'Registrar Entrada', icon: Clock };
    if (!timeRecord.lunch_start) return { type: 'lunch_start', label: 'Registrar Início Almoço', icon: Clock };
    if (!timeRecord.lunch_end) return { type: 'lunch_end', label: 'Registrar Fim Almoço', icon: Clock };
    if (!timeRecord.clock_out) return { type: 'clock_out', label: 'Registrar Saída', icon: Clock };
    return null;
  };

  const nextAction = getNextAction();
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Relógio */}
      <Card className="bg-gradient-to-r from-primary-50 to-accent-50">
        <CardHeader className="text-center">
          <CardTitle className="text-primary-900">
            {format(new Date(selectedDate + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </CardTitle>
          <div className="text-4xl font-bold text-primary-700 font-mono">
            {currentTime.toLocaleTimeString('pt-BR', { hour12: false })}
          </div>
        </CardHeader>
      </Card>

      {/* Progresso do Dia */}
      <TimeRegistrationProgress timeRecord={timeRecord} />

      {/* Botão de Ação Principal */}
      {nextAction && isToday && (
        <Card>
          <CardContent className="p-6">
            <Button
              onClick={() => registerTime(nextAction.type as any)}
              disabled={loading}
              className="w-full h-16 text-lg"
              size="lg"
            >
              <nextAction.icon className="w-6 h-6 mr-3" />
              {loading ? 'Registrando...' : nextAction.label}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edição para dias passados */}
      {!isToday && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              Ajustar registros de {format(new Date(selectedDate + 'T00:00:00'), "dd/MM/yyyy")}
            </p>
            <Button variant="outline" className="w-full">
              <Edit className="w-4 h-4 mr-2" />
              Solicitar Edição
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeRegistration;
