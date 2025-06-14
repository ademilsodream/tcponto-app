
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, Clock, Eye, EyeOff, UserX, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accessDeniedInfo, setAccessDeniedInfo] = useState<{
    reason: string;
    details: string;
  } | null>(null);

  const { user, profile, isLoading: authLoading, hasAccess } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Login: Verificando estado do usuário...', { 
      user: !!user, 
      profile: !!profile, 
      hasAccess, 
      authLoading 
    });

    if (!authLoading && user && profile && hasAccess) {
      console.log('Login: Usuário com acesso completo, redirecionando...');
      navigate('/', { replace: true });
    }
  }, [user, profile, authLoading, hasAccess, navigate]);

  const validateUserAccess = async (userId: string) => {
    try {
      console.log('🔍 Validando permissões do usuário:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Erro ao carregar perfil para validação:', error);
        throw new Error('Erro ao verificar permissões do usuário');
      }

      if (!profileData) {
        throw new Error('Perfil do usuário não encontrado');
      }

      console.log('📋 Perfil carregado para validação:', {
        name: profileData.name,
        status: profileData.status,
        can_register_time: profileData.can_register_time
      });

      // ✨ VALIDAÇÃO CRÍTICA: Verificar se usuário tem acesso
      const isActive = profileData.status === 'active';
      const canRegister = profileData.can_register_time === true;

      if (!isActive) {
        console.warn('🚫 Acesso negado: Conta inativa');
        setAccessDeniedInfo({
          reason: 'Conta Inativa',
          details: 'Sua conta está com status inativo. Entre em contato com o administrador para reativar sua conta.'
        });
        return false;
      }

      if (!canRegister) {
        console.warn('🚫 Acesso negado: Sem permissão para registrar ponto');
        setAccessDeniedInfo({
          reason: 'Sem Permissão de Registro',
          details: 'Você não tem permissão para registrar ponto no sistema. Entre em contato com o administrador para solicitar acesso.'
        });
        return false;
      }

      console.log('✅ Usuário tem todas as permissões necessárias');
      return true;

    } catch (error) {
      console.error('❌ Erro na validação de acesso:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAccessDeniedInfo(null);
    console.log('Login: Tentando fazer login...');
    
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    
    try {
      // ✨ PASSO 1: Fazer login no Supabase
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        console.error('Login: Falha na autenticação:', loginError);
        let errorMessage = 'Erro ao fazer login';
        
        if (loginError.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (loginError.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada';
        } else {
          errorMessage = loginError.message;
        }
        
        setError(errorMessage);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError('Erro inesperado durante o login');
        setIsLoading(false);
        return;
      }

      console.log('✅ Login realizado com sucesso, validando permissões...');

      // ✨ PASSO 2: Validar permissões ANTES de permitir acesso
      try {
        const hasValidAccess = await validateUserAccess(data.user.id);
        
        if (!hasValidAccess) {
          console.warn('🚫 Usuário sem permissões adequadas - fazendo logout');
          
          // ✨ LOGOUT IMEDIATO se não tiver permissão
          await supabase.auth.signOut();
          setIsLoading(false);
          return; // accessDeniedInfo já foi definido em validateUserAccess
        }

        console.log('🎉 Login completo com todas as validações aprovadas');
        // O useEffect vai detectar a mudança de estado e redirecionar

      } catch (validationError) {
        console.error('❌ Erro na validação de permissões:', validationError);
        
        // Fazer logout em caso de erro
        await supabase.auth.signOut();
        setError('Erro ao verificar permissões. Tente novamente.');
        setIsLoading(false);
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

  const handleTryAgain = () => {
    setAccessDeniedInfo(null);
    setError('');
  };

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

  // ✨ Tela de acesso negado
  if (accessDeniedInfo) {
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
          </div>

          <Card className="shadow-2xl border-0">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <UserX className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h2>
                <p className="text-gray-600">Sua conta não tem permissão para acessar este sistema</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium mb-1">{accessDeniedInfo.reason}</p>
                    <p>{accessDeniedInfo.details}</p>
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 mb-4">
                <p>Entre em contato com o administrador do sistema para resolver esta situação.</p>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleTryAgain}
                  className="bg-[#021B40] hover:bg-[#021B40]/90 text-white px-6 py-2 rounded-lg text-sm"
                >
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
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
                    Verificando permissões...
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
