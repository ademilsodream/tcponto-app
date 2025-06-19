import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, Clock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, profile, isLoading: authLoading, hasAccess } = useOptimizedAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Debug logging
    console.log('🔍 Login - Estado atual:', {
      authLoading,
      user: user ? { id: user.id, email: user.email } : null,
      profile: profile ? { name: profile.name, status: profile.status } : null,
      hasAccess
    });

    // Se usuário está autenticado e tem acesso, redirecionar
    if (!authLoading && user && profile && hasAccess) {
      console.log('✅ Usuário autenticado com acesso, redirecionando para /employee...');
      navigate('/employee', { replace: true });
    }
  }, [user, profile, authLoading, hasAccess, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }
    
    setIsLoading(true);
    console.log('🔐 Tentando fazer login...');

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });
      
      if (loginError) {
        console.error('❌ Erro de login:', loginError);
        setError('Email ou senha incorretos');
        setIsLoading(false);
        return;
      }

      // Após login, garantir que o perfil existe
      if (data?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
        if (!profileData) {
          // Cria perfil mínimo
          const { error: insertError } = await supabase.from('profiles').insert({
            id: data.user.id,
            name: '',
            email: data.user.email,
            role: 'user',
            hourly_rate: 0.00
          });
          if (insertError) {
            console.error('❌ Erro ao criar perfil:', insertError);
            setError('Erro ao criar perfil do usuário. Contate o suporte.');
            setIsLoading(false);
            return;
          }
          console.log('✅ Perfil criado automaticamente para o usuário.');
        }
      }

      console.log('✅ Login realizado com sucesso');
      // O redirecionamento será feito pelo useEffect quando o estado for atualizado
    } catch (error: any) {
      console.error('❌ Erro inesperado ao fazer login:', error);
      setError('Erro inesperado ao fazer login');
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // Mostrar loading enquanto verifica autenticação
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
          <p className="text-white text-sm opacity-75">V-2.0</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
