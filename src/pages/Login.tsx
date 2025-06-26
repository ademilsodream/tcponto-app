
import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { Eye, EyeOff, Clock } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, profile, isLoading: authLoading, hasAccess } = useOptimizedAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  console.log('🔐 Login component - Estado atual:', {
    user: !!user,
    profile: !!profile,
    authLoading,
    hasAccess,
    userEmail: user?.email
  });

  // ✨ Redirecionamento automático melhorado
  useEffect(() => {
    console.log('🔄 Login useEffect - Verificando redirecionamento:', {
      authLoading,
      user: !!user,
      profile: !!profile,
      hasAccess
    });

    // Se não está carregando e tem usuário com perfil e acesso, redirecionar
    if (!authLoading && user && profile && hasAccess) {
      console.log('✅ Login: Redirecionando usuário logado para /employee');
      navigate('/employee', { replace: true });
    } else if (!authLoading && user && profile && !hasAccess) {
      console.log('🔒 Login: Usuário sem acesso - mantendo na tela de login');
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar o sistema de ponto.",
        variant: "destructive"
      });
    }
  }, [authLoading, user, profile, hasAccess, navigate, toast]);

  // ✨ Se está carregando autenticação, mostrar loading
  if (authLoading) {
    console.log('⏳ Login: Carregando autenticação...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-primary-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // ✨ Se usuário já está logado e tem acesso, redirecionar (fallback)
  if (user && profile && hasAccess) {
    console.log('🔄 Login: Redirecionamento via Navigate component');
    return <Navigate to="/employee" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('🔐 Tentativa de login para:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Erro no login:', error);
        toast({
          title: "Erro no login",
          description: error.message === 'Invalid login credentials' 
            ? "Email ou senha incorretos" 
            : error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        console.log('✅ Login realizado com sucesso:', data.user.email);
        // O redirecionamento será feito pelo useEffect quando o AuthContext atualizar
      }
    } catch (error) {
      console.error('❌ Erro inesperado no login:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao fazer login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
              alt="TCPonto Logo" 
              className="w-16 h-16 rounded-full" 
            />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">TCPonto</CardTitle>
          <CardDescription>
            Sistema de Controle de Ponto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {/* 🧪 BOTÃO DE DEBUG TEMPORÁRIO */}
          {user && profile && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-700 mb-2">
                Debug: Usuário logado como {user.email}
              </p>
              <Button
                onClick={() => {
                  console.log('🧪 Forçando navegação para /employee');
                  navigate('/employee', { replace: true });
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                🧪 Ir para Dashboard (Debug)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
