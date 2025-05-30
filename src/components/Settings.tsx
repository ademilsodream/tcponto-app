
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, Plus, Edit, Trash2, Settings as SettingsIcon, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import GlobalCurrencySelector from '@/components/GlobalCurrencySelector';

interface AllowedLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  range_meters: number;
  is_active: boolean;
}

interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description: string;
}

const Settings = () => {
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<AllowedLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    range_meters: '100'
  });
  const [delayTolerance, setDelayTolerance] = useState('15');
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar localizações
      const { data: locationsData, error: locationsError } = await supabase
        .from('allowed_locations')
        .select('*')
        .order('name');

      if (locationsError) {
        throw locationsError;
      }

      // Carregar configurações
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*');

      if (settingsError) {
        throw settingsError;
      }

      setLocations(locationsData || []);
      setSettings(settingsData || []);
      
      // Definir tolerância de atraso
      const delayToleranceSetting = settingsData?.find(s => s.setting_key === 'delay_tolerance_minutes');
      if (delayToleranceSetting) {
        setDelayTolerance(delayToleranceSetting.setting_value);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetLocationForm = () => {
    setLocationForm({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      range_meters: '100'
    });
    setEditingLocation(null);
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!locationForm.name || !locationForm.address || !locationForm.latitude || !locationForm.longitude) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      const locationData = {
        name: locationForm.name,
        address: locationForm.address,
        latitude: parseFloat(locationForm.latitude),
        longitude: parseFloat(locationForm.longitude),
        range_meters: parseInt(locationForm.range_meters) || 100,
        is_active: true
      };

      if (editingLocation) {
        const { error } = await supabase
          .from('allowed_locations')
          .update(locationData)
          .eq('id', editingLocation.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Localização atualizada com sucesso!"
        });
      } else {
        const { error } = await supabase
          .from('allowed_locations')
          .insert(locationData);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Localização adicionada com sucesso!"
        });
      }

      await loadData();
      setIsLocationDialogOpen(false);
      resetLocationForm();
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar localização",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLocation = (location: AllowedLocation) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      address: location.address,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      range_meters: location.range_meters.toString()
    });
    setIsLocationDialogOpen(true);
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta localização?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('allowed_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Sucesso",
        description: "Localização excluída com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao excluir localização:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir localização",
        variant: "destructive"
      });
    }
  };

  const handleSaveDelayTolerance = async () => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'delay_tolerance_minutes',
          setting_value: delayTolerance,
          description: 'Tolerância de atraso em minutos'
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Tolerância de atraso atualizada com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao salvar tolerância:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar tolerância de atraso",
        variant: "destructive"
      });
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationForm({
            ...locationForm,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          });
          toast({
            title: "Sucesso",
            description: "Localização atual obtida!"
          });
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          toast({
            title: "Erro",
            description: "Erro ao obter localização atual",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Erro",
        description: "Geolocalização não é suportada neste navegador",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6" />
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
      </div>

      <Tabs defaultValue="locations" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations">Endereços Permitidos</TabsTrigger>
          <TabsTrigger value="general">Configurações Gerais</TabsTrigger>
          <TabsTrigger value="currency">Moeda</TabsTrigger>
        </TabsList>

        <TabsContent value="locations" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Endereços Permitidos</h2>
              <p className="text-gray-600">Gerencie os locais onde o registro de ponto é permitido</p>
            </div>

            <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetLocationForm(); setIsLocationDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Endereço
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingLocation ? 'Editar Endereço' : 'Novo Endereço'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleLocationSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                      placeholder="Ex: Sede Principal"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço *</Label>
                    <Input
                      id="address"
                      value={locationForm.address}
                      onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                      placeholder="Ex: Rua das Flores, 123"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="latitude">Latitude *</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={locationForm.latitude}
                        onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
                        placeholder="Ex: -23.550520"
                        required
                        disabled={submitting}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="longitude">Longitude *</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={locationForm.longitude}
                        onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
                        placeholder="Ex: -46.633309"
                        required
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getCurrentLocation}
                      disabled={submitting}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Usar Localização Atual
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="range">Range em Metros *</Label>
                    <Input
                      id="range"
                      type="number"
                      min="1"
                      value={locationForm.range_meters}
                      onChange={(e) => setLocationForm({ ...locationForm, range_meters: e.target.value })}
                      placeholder="Ex: 100"
                      required
                      disabled={submitting}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsLocationDialogOpen(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? 'Salvando...' : (editingLocation ? 'Salvar' : 'Criar')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lista de Endereços ({locations.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {locations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum endereço configurado</p>
                  <p className="text-sm">Clique em "Novo Endereço" para adicionar o primeiro</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endereço</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Range (m)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {locations.map((location) => (
                        <tr key={location.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {location.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {location.address}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {location.range_meters}m
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              location.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {location.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditLocation(location)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteLocation(location.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tolerância de Atrasos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delay-tolerance">Tolerância em Minutos</Label>
                <div className="flex gap-2">
                  <Input
                    id="delay-tolerance"
                    type="number"
                    min="0"
                    max="60"
                    value={delayTolerance}
                    onChange={(e) => setDelayTolerance(e.target.value)}
                    placeholder="15"
                    className="max-w-xs"
                  />
                  <Button onClick={handleSaveDelayTolerance}>
                    Salvar
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Define quantos minutos de tolerância o sistema terá para pequenos atrasos
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Configuração de Moeda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Selecione a moeda padrão do sistema para exibição de valores
                </p>
                <GlobalCurrencySelector />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
