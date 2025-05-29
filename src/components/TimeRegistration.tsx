
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  locations?: any;
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
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
      getCurrentLocation();
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
      console.log('Coordenadas obtidas:', latitude, longitude);

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
          console.log('Resposta do Nominatim:', data);

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

          console.log('Dados de localização processados:', locationData);
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
    if (!user || !currentLocation) {
      toast.error('Localização necessária para registrar ponto');
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

  const isButtonDisabled = (action: string) => {
    if (loading || !currentLocation) return true;

    switch (action) {
      case 'clock_in':
        return todayRecord?.clock_in !== undefined;
      case 'lunch_start':
        return !todayRecord?.clock_in || todayRecord?.lunch_start !== undefined;
      case 'lunch_end':
        return !todayRecord?.lunch_start || todayRecord?.lunch_end !== undefined;
      case 'clock_out':
        return !todayRecord?.clock_in || todayRecord?.clock_out !== undefined;
      default:
        return false;
    }
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

      {/* Status da Localização */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">Localização</span>
            {locationLoading ? (
              <Badge variant="secondary">Carregando...</Badge>
            ) : currentLocation ? (
              <Badge className="bg-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Obtida
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="w-3 h-3 mr-1" />
                Não disponível
              </Badge>
            )}
          </div>
          
          {currentLocation ? (
            <div className="text-sm text-gray-600 space-y-1">
              <div className="font-medium">{currentLocation.fullAddress}</div>
              <div>📍 {currentLocation.street}, {currentLocation.houseNumber}</div>
              <div>🏘️ {currentLocation.neighborhood}</div>
              <div>🏙️ {currentLocation.city}/{currentLocation.state}</div>
              <div>📮 {currentLocation.postalCode} - 🌍 {currentLocation.country}</div>
              <div className="text-xs text-gray-500">
                📌 {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Localização necessária para registrar ponto
              <Button 
                variant="outline" 
                size="sm" 
                onClick={getCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? 'Obtendo...' : 'Tentar novamente'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de Registro */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={handleClockIn}
          disabled={isButtonDisabled('clock_in')}
          className="h-16"
        >
          <Clock className="w-5 h-5 mr-2" />
          Entrada
        </Button>

        <Button
          onClick={handleLunchStart}
          disabled={isButtonDisabled('lunch_start')}
          variant="outline"
          className="h-16"
        >
          <Clock className="w-5 h-5 mr-2" />
          Saída Almoço
        </Button>

        <Button
          onClick={handleLunchEnd}
          disabled={isButtonDisabled('lunch_end')}
          variant="outline"
          className="h-16"
        >
          <Clock className="w-5 h-5 mr-2" />
          Volta Almoço
        </Button>

        <Button
          onClick={handleClockOut}
          disabled={isButtonDisabled('clock_out')}
          variant="destructive"
          className="h-16"
        >
          <Clock className="w-5 h-5 mr-2" />
          Saída
        </Button>
      </div>

      {/* Resumo do Dia */}
      {todayRecord && (
        <Card className="bg-blue-50">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Resumo do Dia</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Entrada:</span>
                <div className="font-mono">{todayRecord.clock_in || '-'}</div>
              </div>
              <div>
                <span className="text-gray-600">Saída Almoço:</span>
                <div className="font-mono">{todayRecord.lunch_start || '-'}</div>
              </div>
              <div>
                <span className="text-gray-600">Volta Almoço:</span>
                <div className="font-mono">{todayRecord.lunch_end || '-'}</div>
              </div>
              <div>
                <span className="text-gray-600">Saída:</span>
                <div className="font-mono">{todayRecord.clock_out || '-'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeRegistration;
