import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle } from 'lucide-react'; // Removido MapPin, XCircle, AlertCircle
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import TimeRegistrationProgress from './TimeRegistrationProgress';


interface TimeRecord {
  id: string;
  date: string;
  clock_in?: string;
  lunch_start?: string;
  lunch_end?: string;
  clock_out?: string;
  locations?: any; // Mantido para salvar a localização, mas não será exibido
}


interface LocationData {
  lat: number;
  lng: number;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
}


interface TimeRegistrationProps {
  selectedDate?: string;
}


const TimeRegistration: React.FC<TimeRegistrationProps> = ({ selectedDate }) => {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false); // Mantido para a lógica interna
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null); // Mantido para a lógica interna
  const intervalRef = useRef<NodeJS.Timeout>();


  // Use selectedDate se fornecido, senão use a data atual
  const displayDate = selectedDate ? new Date(selectedDate) : new Date();


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);


    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    if (user) {
      loadTodayRecord();
      getCurrentLocation(); // Ainda obtém a localização para salvar, mesmo sem exibir
    }
  }, [user, selectedDate]);


  const getCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      if (!navigator.geolocation) {
        console.warn('Geolocalização não é suportada por este navegador');
        setCurrentLocation(null);
        return;
      }


      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });


      const { latitude, longitude } = position.coords;
      //console.log('Coordenadas obtidas:', latitude, longitude); // Log removido para ser mais conciso


      // Buscar detalhes do endereço usando Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=pt-BR`,
          {
            headers: {
              'User-Agent': 'TimeTracker/1.0'
            }
          }
        );


        if (response.ok) {
          const data = await response.json();
          //console.log('Resposta do Nominatim:', data); // Log removido


          const address = data.address || {};
          const locationData: LocationData = {
            lat: latitude,
            lng: longitude,
            street: address.road || address.pedestrian || 'Não informado',
            houseNumber: address.house_number || 'S/N',
            neighborhood: address.neighbourhood || address.suburb || address.quarter || 'Não informado',
            city: address.city || address.town || address.village || address.municipality || 'Não informado',
            state: address.state || address.region || 'Não informado',
            postalCode: address.postcode || 'Não informado',
            country: address.country || 'Não informado',
            fullAddress: data.display_name || `${latitude}, ${longitude}`
          };


          //console.log('Dados de localização processados:', locationData); // Log removido
          setCurrentLocation(locationData);
        } else {
          throw new Error('Erro na resposta do Nominatim');
        }
      } catch (geocodeError) {
        console.warn('Erro ao obter detalhes do endereço:', geocodeError);
        // Fallback para coordenadas simples
        const fallbackLocation: LocationData = {
          lat: latitude,
          lng: longitude,
          street: 'Não informado',
          houseNumber: 'S/N',
          neighborhood: 'Não informado',
          city: 'Não informado',
          state: 'Não informado',
          postalCode: 'Não informado',
          country: 'Não informado',
          fullAddress: `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        };
        setCurrentLocation(fallbackLocation);
      }
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      setCurrentLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };


  const loadTodayRecord = async () => {
    if (!user) return;


    try {
      const today = selectedDate || format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();


      if (error && error.code !== 'PGRST116') {
        throw error;
      }


      setTodayRecord(data);
    } catch (error) {
      console.error('Error loading today record:', error);
      toast.error('Erro ao carregar registro do dia');
    }
  };


  const updateTimeRecord = async (field: string, value: string, locationField: string) => {
    // A localização ainda é necessária para a lógica de salvar, mesmo que não seja exibida
    if (!user || !currentLocation) {
      toast.error('Localização necessária para registrar ponto');
      // Tenta obter a localização novamente se falhou
      getCurrentLocation();
      return;
    }


    setLoading(true);
    try {
      const today = selectedDate || format(new Date(), 'yyyy-MM-dd');
      
      if (todayRecord) {
        // Atualizar registro existente
        const existingLocations = todayRecord.locations || {};
        const updatedLocations = {
          ...existingLocations,
          [locationField]: currentLocation
        };


        const { error } = await supabase
          .from('time_records')
          .update({
            [field]: value,
            locations: JSON.parse(JSON.stringify(updatedLocations)), // Converter para JSON válido
            updated_at: new Date().toISOString()
          })
          .eq('id', todayRecord.id);


        if (error) throw error;
      } else {
        // Criar novo registro
        const newLocations = {
          [locationField]: currentLocation
        };


        const { error } = await supabase
          .from('time_records')
          .insert({
            user_id: user.id,
            date: today,
            [field]: value,
            locations: JSON.parse(JSON.stringify(newLocations)) // Converter para JSON válido
          });


        if (error) throw error;
      }


      await loadTodayRecord();
      toast.success('Ponto registrado com sucesso!');
    } catch (error) {
      console.error('Error updating time record:', error);
      toast.error('Erro ao registrar ponto');
    } finally {
      setLoading(false);
    }
  };


  const handleClockIn = () => {
    const now = format(new Date(), 'HH:mm:ss');
    updateTimeRecord('clock_in', now, 'clockIn');
  };


  const handleLunchStart = () => {
    const now = format(new Date(), 'HH:mm:ss');
    updateTimeRecord('lunch_start', now, 'lunchStart');
  };


  const handleLunchEnd = () => {
    const now = format(new Date(), 'HH:mm:ss');
    updateTimeRecord('lunch_end', now, 'lunchEnd');
  };


  const handleClockOut = () => {
    const now = format(new Date(), 'HH:mm:ss');
    updateTimeRecord('clock_out', now, 'clockOut');
  };


  const getStatusBadge = () => {
    if (!todayRecord) {
      return <Badge variant="secondary">Não iniciado</Badge>;
    }


    if (todayRecord.clock_out) {
      return <Badge className="bg-blue-600">Finalizado</Badge>;
    }


    if (todayRecord.lunch_start && !todayRecord.lunch_end) {
      return <Badge className="bg-yellow-600">Em horário de almoço</Badge>;
    }


    if (todayRecord.clock_in) {
      return <Badge className="bg-green-600">Trabalhando</Badge>;
    }


    return <Badge variant="secondary">Não iniciado</Badge>;
  };


  // Lógica para determinar qual botão exibir
  const renderActionButton = () => {
    // Se o registro ainda não começou, mostre o botão de Entrada
    if (!todayRecord?.clock_in) {
      return (
        <Button
          onClick={handleClockIn}
          disabled={loading || !currentLocation} // Desabilita se estiver carregando ou sem localização
          className="h-16 w-full" // w-full para ocupar a largura total
          variant="primary" // Alterado para primary para ser azul
        >
          <Clock className="w-5 h-5 mr-2" />
          Registrar Entrada
        </Button>
      );
    }


    // Se a Entrada foi registrada, mas o almoço não começou, mostre o botão de Saída Almoço
    if (todayRecord.clock_in && !todayRecord.lunch_start) {
      return (
        <Button
          onClick={handleLunchStart}
          disabled={loading || !currentLocation} // Desabilita se estiver carregando ou sem localização
          variant="primary" // Alterado para primary para ser azul
          className="h-16 w-full"
        >
          <Clock className="w-5 h-5 mr-2" />
          Registrar Saída Almoço
        </Button>
      );
    }


    // Se o almoço começou, mas não terminou, mostre o botão de Volta Almoço
    if (todayRecord.lunch_start && !todayRecord.lunch_end) {
      return (
        <Button
          onClick={handleLunchEnd}
          disabled={loading || !currentLocation} // Desabilita se estiver carregando ou sem localização
          variant="primary" // Alterado para primary para ser azul
          className="h-16 w-full"
        >
          <Clock className="w-5 h-5 mr-2" />
          Registrar Volta Almoço
        </Button>
      );
    }


    // Se o almoço terminou, mas a saída não foi registrada, mostre o botão de Saída
    if (todayRecord.lunch_end && !todayRecord.clock_out) {
      return (
        <Button
          onClick={handleClockOut}
          disabled={loading || !currentLocation} // Desabilita se estiver carregando ou sem localização
          variant="primary" // Alterado para primary para ser azul (era destructive)
          className="h-16 w-full"
        >
          <Clock className="w-5 h-5 mr-2" />
          Registrar Saída
        </Button>
      );
    }


    // Se todos os registros foram concluídos
    if (todayRecord.clock_out) {
        return (
            <div className="text-center text-green-600 font-semibold py-4">
                <CheckCircle className="w-8 h-8 mx-auto mb-2" /> {/* Ícone maior */}
                Todos os registros do dia foram concluídos!
            </div>
        );
    }


    // Caso padrão (não deve acontecer se a lógica estiver correta)
    return null;
  };


  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Registro de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold">
              {format(currentTime, 'HH:mm:ss')}
            </div>
            <div className="text-lg text-gray-600">
              {format(displayDate, 'dd/MM/yyyy')}
            </div>
            <div className="mt-2">
              {getStatusBadge()}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Componente de Progresso */}
      {todayRecord && (
        <TimeRegistrationProgress 
          record={{
            clockIn: todayRecord.clock_in,
            lunchStart: todayRecord.lunch_start,
            lunchEnd: todayRecord.lunch_end,
            clockOut: todayRecord.clock_out
          }} 
        />
      )}


      {/* Botões de Registro - Exibidos sequencialmente */}
      <div className="flex justify-center"> {/* Centraliza o botão */}
        {renderActionButton()}
      </div>


    </div>
  );
};


export default TimeRegistration;
