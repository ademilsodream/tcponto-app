
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  hourly_rate: number;
  created_at?: string;
  updated_at?: string;
}

const SupabaseUserManagement: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    hourlyRate: ''
  });
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar usuários:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar usuários",
          variant: "destructive",
        });
      } else {
        // Converter os dados do banco para o tipo Profile correto
        const typedUsers: Profile[] = (data || []).map(user => ({
          ...user,
          role: user.role as 'admin' | 'user' // Conversão de tipo explícita
        }));
        setUsers(typedUsers);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      hourlyRate: ''
    });
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || (!editingUser && !formData.password)) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const hourlyRate = parseFloat(formData.hourlyRate) || 50.00;

    try {
      if (editingUser) {
        // Editar usuário existente
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            hourly_rate: hourlyRate
          })
          .eq('id', editingUser.id);

        if (error) {
          console.error('Erro ao atualizar usuário:', error);
          toast({
            title: "Erro",
            description: "Erro ao atualizar usuário",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso",
        });
      } else {
        // Criar novo usuário
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
            },
          },
        });

        if (authError) {
          console.error('Erro ao criar usuário:', authError);
          toast({
            title: "Erro",
            description: "Erro ao criar usuário: " + authError.message,
            variant: "destructive",
          });
          return;
        }

        if (authData.user) {
          // Atualizar o perfil com informações adicionais
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              name: formData.name,
              role: formData.role,
              hourly_rate: hourlyRate
            })
            .eq('id', authData.user.id);

          if (profileError) {
            console.error('Erro ao atualizar perfil:', profileError);
            toast({
              title: "Aviso",
              description: "Usuário criado, mas houve erro ao atualizar perfil",
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Sucesso",
          description: "Usuário criado com sucesso",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar usuário",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      hourlyRate: user.hourly_rate.toString()
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Erro ao excluir usuário:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir usuário",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
      
      loadUsers();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir usuário",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando usuários...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-primary-900">Gerenciamento de Usuários</h2>
          <p className="text-gray-600">Criar e gerenciar usuários do sistema</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário' : 'Criar Novo Usuário'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              {!editingUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">Cargo/Nível</Label>
                <Select value={formData.role} onValueChange={(value: 'admin' | 'user') => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Funcionário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Valor por Hora</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingUser ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Lista de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Valor/Hora</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                    </span>
                  </TableCell>
                  <TableCell>{formatCurrency(user.hourly_rate)}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseUserManagement;
