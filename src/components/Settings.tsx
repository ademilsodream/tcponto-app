
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import HourBankSettings from './HourBankSettings';

interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
}

const Settings = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    range_meters: 100
  });
  const { toast } = useToast();

  React.useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Erro ao carregar localizações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar localizações permitidas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.address) {
      toast({
        title: "Erro",
        description: "Nome e endereço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('allowed_locations')
        .insert([newLocation]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Localização adicionada com sucesso"
      });

      setNewLocation({
        name: '',
        address: '',
        latitude: 0,
        longitude: 0,
        range_meters: 100
      });

      loadLocations();
    } catch (error) {
      console.error('Erro ao adicionar localização:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar localização",
        variant: "destructive"
      });
    }
  };

  const toggleLocationStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('allowed_locations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Localização ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`
      });

      loadLocations();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da localização",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings2 className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
      </div>

      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Localizações
          </TabsTrigger>
          <TabsTrigger value="hour-bank" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Banco de Horas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Localizações Permitidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formulário para adicionar nova localização */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-medium">Adicionar Nova Localização</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Localização</Label>
                    <Input
                      id="name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Escritório Principal"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={newLocation.latitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      placeholder="-23.550520"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={newLocation.longitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      placeholder="-46.633309"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="range">Raio Permitido (metros)</Label>
                    <Input
                      id="range"
                      type="number"
                      value={newLocation.range_meters}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, range_meters: parseInt(e.target.value) || 100 }))}
                      placeholder="100"
                    />
                  </div>
                </div>

                <Button onClick={handleAddLocation} className="w-full">
                  Adicionar Localização
                </Button>
              </div>

              {/* Lista de localizações existentes */}
              <div className="space-y-4">
                <h3 className="font-medium">Localizações Cadastradas</h3>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2">Carregando...</span>
                  </div>
                ) : locations.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma localização cadastrada
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {locations.map((location) => (
                      <div key={location.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="font-medium">{location.name}</h4>
                            <p className="text-sm text-muted-foreground">{location.address}</p>
                            <p className="text-xs text-muted-foreground">
                              Coordenadas: {location.latitude}, {location.longitude} • 
                              Raio: {location.range_meters}m
                            </p>
                          </div>
                          <Button
                            variant={location.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleLocationStatus(location.id, location.is_active)}
                          >
                            {location.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hour-bank">
          <HourBankSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
