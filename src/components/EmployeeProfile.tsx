import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, User, Edit, Save, X, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmployeeProfileProps {
  onBack?: () => void;
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  birth_date: string | null;
  gender: string | null;
  employee_code: string | null;
  nif: string | null;
  niss: string | null;
  admission_date: string | null;
  hourly_rate: number;
  overtime_rate: number | null;
  role: string;
  status: string | null;
  department_id: string | null;
  job_function_id: string | null;
  shift_id: string | null;
  avatar_url?: string | null;
}

const EmployeeProfile: React.FC<EmployeeProfileProps> = ({ onBack }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProfileData>>({});
  const { user, profile: authProfile, refreshProfile } = useOptimizedAuth();
  const { toast } = useToast();

  // Carregar dados completos do perfil
  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          phone,
          address,
          city,
          postal_code,
          birth_date,
          gender,
          employee_code,
          nif,
          niss,
          admission_date,
          hourly_rate,
          overtime_rate,
          role,
          status,
          department_id,
          job_function_id,
          shift_id,
          avatar_url
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setEditForm({
        name: data.name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        postal_code: data.postal_code,
        birth_date: data.birth_date,
        gender: data.gender,
      });
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados do perfil.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editForm.name,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          postal_code: editForm.postal_code,
          birth_date: editForm.birth_date,
          gender: editForm.gender,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Perfil atualizado com sucesso!',
      });

      setIsEditing(false);
      await loadProfile();
      await refreshProfile(); // Atualizar contexto de autenticação
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: profile?.name,
      phone: profile?.phone,
      address: profile?.address,
      city: profile?.city,
      postal_code: profile?.postal_code,
      birth_date: profile?.birth_date,
      gender: profile?.gender,
    });
    setIsEditing(false);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setIsUploadingPhoto(true);

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Atualizar perfil com nova URL da foto
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: 'Sucesso',
        description: 'Foto de perfil atualizada!',
      });

      await loadProfile();
      await refreshProfile();
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload da foto.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
        <div className="text-center">
          <p className="text-gray-600">Perfil não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <User className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Meu Perfil</h1>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Foto de Perfil */}
        <Card className="w-full bg-white/90 rounded-xl shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Foto de perfil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={isUploadingPhoto}
                    />
                  </label>
                )}
              </div>
              {isUploadingPhoto && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Fazendo upload...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dados Pessoais */}
        <Card className="w-full bg-white/90 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={editForm.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="h-12 text-base"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">{profile.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={editForm.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="h-12 text-base"
                    placeholder="Telefone"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">{profile.phone || 'Não informado'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                {isEditing ? (
                  <Input
                    id="birth_date"
                    type="date"
                    value={editForm.birth_date || ''}
                    onChange={(e) => handleInputChange('birth_date', e.target.value)}
                    className="h-12 text-base"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">
                      {profile.birth_date ? format(new Date(profile.birth_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gênero</Label>
                {isEditing ? (
                  <Select value={editForm.gender || ''} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="O">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">
                      {profile.gender === 'M' ? 'Masculino' : profile.gender === 'F' ? 'Feminino' : profile.gender === 'O' ? 'Outro' : 'Não informado'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Endereço</Label>
                {isEditing ? (
                  <Input
                    id="address"
                    value={editForm.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="h-12 text-base"
                    placeholder="Endereço completo"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">{profile.address || 'Não informado'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                {isEditing ? (
                  <Input
                    id="city"
                    value={editForm.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="h-12 text-base"
                    placeholder="Cidade"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">{profile.city || 'Não informado'}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postal_code">Código Postal</Label>
                {isEditing ? (
                  <Input
                    id="postal_code"
                    value={editForm.postal_code || ''}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    className="h-12 text-base"
                    placeholder="Código postal"
                  />
                ) : (
                  <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                    <span className="text-gray-900">{profile.postal_code || 'Não informado'}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados Profissionais */}
        <Card className="w-full bg-white/90 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Dados Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Código do Funcionário</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.employee_code || 'Não informado'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>NIF</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.nif || 'Não informado'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>NISS</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.niss || 'Não informado'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Admissão</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">
                    {profile.admission_date ? format(new Date(profile.admission_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Função</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.role}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Taxa Horária</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">€{profile.hourly_rate.toFixed(2)}/h</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Taxa de Horas Extras</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">
                    {profile.overtime_rate ? `€${profile.overtime_rate.toFixed(2)}/h` : 'Não informado'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <div className="h-12 px-3 py-2 bg-gray-50 rounded-md flex items-center">
                  <span className="text-gray-900">{profile.status || 'Não informado'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        {isEditing && (
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 h-12 text-base font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex-1 h-12 text-base"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeProfile;
