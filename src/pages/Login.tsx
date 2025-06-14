
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, Clock, Eye, EyeOff, AlertTriangle, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false); // ✨ Novo estado para acesso negado

  const { user, profile, isLoading: authLoading, hasAccess, logout } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Login: Verificando se usuário já está logado...');
    if (!authLoading && user && profile) {
      // ✨ Verificar se tem acesso antes de redirecionar
      if (hasAccess) {
        console.log('Login: Usuário logado com acesso, redirecionando...');
        navigate('/', { replace: true });
      } else {
        console.log('Login: Usuário logado mas sem acesso');
        setAccessDenied(true);
        // Forçar logout automático para usuários sem acesso
        setTimeout(() => {
          logout();
          setAccessDenied(false);
        }, 5000);
      }
    }
  }, [user, profile, authLoading, hasAccess, navigate, logout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAccessDenied(false);
    console.log('Login: Tentando fazer login...');
    
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login: Falha no login:', error);
        setError(error.message || 'Erro ao fazer login');
        setIsLoading(false);
      } else if (data.user) {
        console.log('Login: Login realizado com sucesso, aguardando verificação de acesso...');
        // ✨ Não redirecionar imediatamente - aguardar carregamento do perfil
        // O useEffect acima vai cuidar do redirecionamento baseado nas permissões
      }
    } catch (error: any) {
      console.error('Login: Erro inesperado:', error);
      setError('Erro inesperado ao fazer login');
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // ✨ Se acesso foi negado, mostrar tela específica
  if (accessDenied && user) {
    return (
      <div className="min-h-screen w-full bg-[#021B40] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-red-600">
                <UserX className="w-6 h-6" />
                Acesso Negado
              </CardTitle>
              <CardDescription>
                Sua conta não tem permissão para acessar este sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {profile?.status !== 'active' 
                    ? 'Sua conta está inativa. Entre em contato com o administrador.'
                    : 'Você não tem permissão para registrar ponto. Entre em contato com o administrador.'
                  }
                </AlertDescription>
              </Alert>
              
              <div className="text-center text-sm text-gray-600">
                <p>Redirecionando para login em alguns segundos...</p>
              </div>

              <Button
                onClick={() => {
                  logout();
                  setAccessDenied(false);
                }}
                variant="outline"
                className="w-full"
              >
                Voltar ao Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#021B40] flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#021B40] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/lovable-uploads/669270b6-ec43-4161-8f51-34a39fc1b06f.png" 
              alt="TCPonto Logo" 
              className="w-20 h-20 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TCPonto</h1>
          <p className="text-white">Sistema de Controle de Ponto</p>
        </div>

        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-primary-900">
              <LogIn className="w-5 h-5" />
              Entrar no Sistema
            </CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  className="h-12 text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="h-12 text-base pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 h-full"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-500" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-500" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-[#021B40] hover:bg-[#021B40]/90 text-white h-12 text-base"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-white text-sm opacity-75">V-1.10</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
