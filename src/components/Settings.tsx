
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, MapPin, Clock, Timer, DollarSign, Building2, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import HourBankSettings from './HourBankSettings';
import CurrencySelector from './CurrencySelector';
import DepartmentJobManagement from './DepartmentJobManagement';
import AutoObrasManagement from './AutoObrasManagement';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';

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
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    range_meters: 100
  });
  const [tolerance, setTolerance] = useState(15);
  const [savingTolerance, setSavingTolerance] = useState(false);
  const { toast } = useToast();
  const { currency, setCurrency, loadSystemCurrency } = useCurrency();

  React.useEffect(() => {
    loadLocations();
    loadSystemSettings();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      console.log('🔍 Carregando localizações permitidas...');
      
      const { data, error } = await supabase
        .from('allowed_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar localizações:', error);
        throw error;
      }
      
      console.log('✅ Localizações carregadas:', data?.length || 0);
      setLocations(data || []);
    } catch (error) {
      console.error('💥 Erro crítico ao carregar localizações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar localizações permitidas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'tolerance_minutes');

      if (error) throw error;

      data?.forEach(setting => {
        if (setting.setting_key === 'tolerance_minutes') {
          setTolerance(parseInt(setting.setting_value) || 15);
        }
      });
    } catch (error) {
      console.error('Erro ao carregar configurações do sistema:', error);
    }
  };

  const validateLocationData = (location: typeof newLocation): string | null => {
    console.log('🔍 Validando dados da localização:', location);

    // Validar nome e endereço
    if (!location.name?.trim()) {
      return "Nome da localização é obrigatório";
    }
    
    if (!location.address?.trim()) {
      return "Endereço é obrigatório";
    }

    // Validar latitude
    if (isNaN(location.latitude) || location.latitude < -90 || location.latitude > 90) {
      return "Latitude deve estar entre -90 e 90";
    }

    // Validar longitude
    if (isNaN(location.longitude) || location.longitude < -180 || location.longitude > 180) {
      return "Longitude deve estar entre -180 e 180";
    }

    // Validar se não são coordenadas padrão (0,0) a menos que seja intencional
    if (location.latitude === 0 && location.longitude === 0) {
      return "Coordenadas 0,0 não são válidas. Verifique as coordenadas corretas";
    }

    // Validar range
    if (isNaN(location.range_meters) || location.range_meters <= 0) {
      return "Raio deve ser maior que 0 metros";
    }

    if (location.range_meters > 1000) {
      return "Raio muito grande. Máximo permitido: 1000 metros";
    }

    console.log('✅ Dados da localização válidos');
    return null;
  };

  const handleAddLocation = async () => {
    console.log('🚀 Iniciando cadastro de nova localização...');
    console.log('📋 Dados do formulário:', newLocation);

    // Validar dados
    const validationError = validateLocationData(newLocation);
    if (validationError) {
      console.warn('⚠️ Erro de validação:', validationError);
      toast({
        title: "Erro de Validação",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    try {
      setAddingLocation(true);
      console.log('💾 Inserindo localização no banco de dados...');

      const locationToInsert = {
        name: newLocation.name.trim(),
        address: newLocation.address.trim(),
        latitude: Number(newLocation.latitude),
        longitude: Number(newLocation.longitude),
        range_meters: Number(newLocation.range_meters),
        is_active: true
      };

      console.log('📦 Dados a serem inseridos:', locationToInsert);

      const { data, error } = await supabase
        .from('allowed_locations')
        .insert([locationToInsert])
        .select();

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        console.error('📄 Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('✅ Localização inserida com sucesso:', data);

      toast({
        title: "Sucesso",
        description: "Localização adicionada com sucesso"
      });

      // Limpar formulário
      setNewLocation({
        name: '',
        address: '',
        latitude: 0,
        longitude: 0,
        range_meters: 100
      });

      // Recarregar lista
      await loadLocations();

    } catch (error: any) {
      console.error('💥 Erro crítico ao adicionar localização:', error);
      
      let errorMessage = "Erro ao adicionar localização";
      
      if (error.message?.includes('permission denied')) {
        errorMessage = "Permissão negada. Verifique se você tem acesso administrativo";
      } else if (error.message?.includes('duplicate')) {
        errorMessage = "Já existe uma localização com estes dados";
      } else if (error.message) {
        errorMessage = `Erro: ${error.message}`;
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setAddingLocation(false);
    }
  };

  const toggleLocationStatus = async (id: string, currentStatus: boolean) => {
    try {
      console.log(`🔄 Alterando status da localização ${id} de ${currentStatus} para ${!currentStatus}`);

      const { error } = await supabase
        .from('allowed_locations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) {
        console.error('❌ Erro ao atualizar status:', error);
        throw error;
      }

      console.log('✅ Status atualizado com sucesso');

      toast({
        title: "Sucesso",
        description: `Localização ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`
      });

      loadLocations();
    } catch (error) {
      console.error('💥 Erro crítico ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da localização",
        variant: "destructive"
      });
    }
  };

  const handleCurrencyChange = async (newCurrency: Currency) => {
    try {
      await setCurrency(newCurrency);
      toast({
        title: "Sucesso",
        description: "Moeda padrão atualizada com sucesso"
      });
      // Recarregar a moeda do sistema para sincronizar
      await loadSystemCurrency();
    } catch (error) {
      console.error('Erro ao atualizar moeda:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar moeda padrão",
        variant: "destructive"
      });
    }
  };

  const handleToleranceSave = async () => {
    try {
      setSavingTolerance(true);
      
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'tolerance_minutes',
          setting_value: tolerance.toString(),
          description: 'Tolerância em minutos para cálculos de ponto'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tolerância atualizada com sucesso"
      });
    } catch (error) {
      console.error('Erro ao atualizar tolerância:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar tolerância",
        variant: "destructive"
      });
    } finally {
      setSavingTolerance(false);
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
          <TabsTrigger value="tolerance" className="flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Tolerância
          </TabsTrigger>
          <TabsTrigger value="currency" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Moeda
          </TabsTrigger>
          <TabsTrigger value="departments-jobs" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Departamentos & Funções
          </TabsTrigger>
          <TabsTrigger value="auto-obras" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Auto de Obras
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
                    <Label htmlFor="name">Nome da Localização *</Label>
                    <Input
                      id="name"
                      value={newLocation.name}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Escritório Principal"
                      disabled={addingLocation}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço *</Label>
                    <Input
                      id="address"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Endereço completo"
                      disabled={addingLocation}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude *</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={newLocation.latitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      placeholder="-23.550520"
                      disabled={addingLocation}
                    />
                    <div className="text-xs text-muted-foreground">
                      Entre -90 e 90
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude *</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={newLocation.longitude}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      placeholder="-46.633309"
                      disabled={addingLocation}
                    />
                    <div className="text-xs text-muted-foreground">
                      Entre -180 e 180
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="range">Raio Permitido (metros) *</Label>
                    <Input
                      id="range"
                      type="number"
                      min="1"
                      max="1000"
                      value={newLocation.range_meters}
                      onChange={(e) => setNewLocation(prev => ({ ...prev, range_meters: parseInt(e.target.value) || 100 }))}
                      placeholder="100"
                      disabled={addingLocation}
                    />
                    <div className="text-xs text-muted-foreground">
                      Entre 1 e 1000 metros
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleAddLocation} 
                  disabled={addingLocation}
                  className="w-full"
                >
                  {addingLocation ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    'Adicionar Localização'
                  )}
                </Button>
              </div>

              {/* Lista de localizações existentes */}
              <div className="space-y-4">
                <h3 className="font-medium">Localizações Cadastradas</h3>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Carregando...</span>
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
                            <div className="flex items-center gap-2 mt-2">
                              <div className={`w-2 h-2 rounded-full ${location.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-xs text-muted-foreground">
                                {location.is_active ? 'Ativa' : 'Inativa'}
                              </span>
                            </div>
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

        <TabsContent value="tolerance">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Tolerância</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tolerance">Tolerância (minutos)</Label>
                <Input
                  id="tolerance"
                  type="number"
                  min="0"
                  max="60"
                  value={tolerance}
                  onChange={(e) => setTolerance(parseInt(e.target.value) || 15)}
                  className="max-w-xs"
                />
                <div className="text-xs text-muted-foreground">
                  Tolerância em minutos para cálculos de ponto eletrônico
                </div>
              </div>
              
              <Button onClick={handleToleranceSave} disabled={savingTolerance}>
                {savingTolerance ? 'Salvando...' : 'Salvar Tolerância'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Moeda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Moeda Padrão do Sistema</Label>
                <CurrencySelector
                  currency={currency}
                  onCurrencyChange={handleCurrencyChange}
                />
                <div className="text-xs text-muted-foreground">
                  Esta será a moeda padrão utilizada em todos os cálculos do sistema
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments-jobs">
          <DepartmentJobManagement />
        </TabsContent>

        <TabsContent value="auto-obras">
          <AutoObrasManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
