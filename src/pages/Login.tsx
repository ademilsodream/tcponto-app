import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
// ✨ Importando ícones para mostrar/ocultar senha
import { LogIn, Clock, Eye, EyeOff } from 'lucide-react';
// 🔧 CORREÇÃO: Importar do contexto correto
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { useNavigate } from 'react-router-dom';


const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // ✨ Novo estado para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  // 🔧 CORREÇÃO: Usar o hook correto e destructuring correto
  // Tente uma dessas opções dependendo do que está disponível:
  const { signIn: login, user, isLoading: authLoading } = useOptimizedAuth();
  // OU: const { authenticate: login, user, isLoading: authLoading } = useOptimizedAuth();
  // OU: const { loginUser: login, user, isLoading: authLoading } = useOptimizedAuth();
  const navigate = useNavigate();


  useEffect(() => {
    console.log('Login: Verificando se usuário já está logado...');
    if (!authLoading && user) {
      console.log('Login: Usuário já logado, redirecionando...');
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log('Login: Tentando fazer login...');
    
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setIsLoading(true);
    const result = await login(email, password);
    
    if (!result.success) {
      console.error('Login: Falha no login:', result.error);
      setError(result.error || 'Erro ao fazer login');
      setIsLoading(false);
    } else {
      console.log('Login: Login realizado com sucesso, redirecionando...');
      navigate('/', { replace: true });
    }
  };


  // ✨ Função para alternar a visibilidade da senha
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };


  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
          <p className="text-white">Verificando autenticação...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center p-4">
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
          <p className="text-primary-100">Sistema de Controle de Ponto</p>
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
                {/* ✨ Container relativo para posicionar o botão */}
                <div className="relative">
                  <Input
                    id="password"
                    // ✨ Altera o tipo do input com base no estado showPassword
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="h-12 text-base pr-10" // ✨ Adiciona padding à direita para o botão
                  />
                  {/* ✨ Botão para alternar a visibilidade da senha */}
                  <Button
                    type="button" // Importante para não submeter o formulário
                    variant="ghost"
                    size="sm"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 h-full"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                  >
                    {/* ✨ Altera o ícone com base no estado showPassword */}
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
                className="w-full bg-primary-800 hover:bg-primary-700 h-12 text-base"
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

        {/* ✨ Versão do App */}
        <div className="text-center mt-6">
          <p className="text-white text-sm opacity-75">V-1.10</p>
        </div>
      </div>
    </div>
  );
};


export default Login;