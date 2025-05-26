import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LogIn, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { initializeApp } from '@/utils/initializeApp';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Inicializar app em background sem bloquear o login
    const initialize = async () => {
      try {
        setIsInitializing(true);
        await initializeApp();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('User is authenticated, redirecting to dashboard');
      navigate('/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    console.log('Form submitted with:', { email, password: '***' });

    if (!email || !password) {
      setError('Por favor, preencha todos os campos');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    try {
      const success = await login(email, password);
      console.log('Login success:', success);
      
      if (success) {
        console.log('Login successful, redirecting...');
        toast({
          title: "Sucesso",
          description: "Login realizado com sucesso!"
        });
        // A navegação será feita pelo useEffect quando isAuthenticated mudar
      } else {
        setError('E-mail ou senha inválidos. Verifique suas credenciais e tente novamente.');
      }
    } catch (err) {
      console.error('Login form error:', err);
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/lovable-uploads/4b2c75fc-26d4-4be4-9e7e-3a415e06b623.png" 
              alt="TCPonto Logo" 
              className="w-20 h-20 rounded-full shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TCPonto</h1>
          <p className="text-primary-100">Sistema de Controle de Ponto</p>
        </div>

        <Card className="shadow-2xl border-0 animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-primary-900">
              <LogIn className="w-5 h-5" />
              Entrar no Sistema
            </CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar o sistema
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
                  required
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary-500"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-primary-800 hover:bg-primary-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Clock className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <LogIn className="w-4 h-4 mr-2" />
                )}
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t text-center text-sm text-gray-600">
              <p className="mb-2"><strong>Contas de demonstração:</strong></p>
              <div className="space-y-1">
                <p><strong>Funcionário:</strong> joao@tcponto.com</p>
                <p><strong>Admin:</strong> admin@tcponto.com</p>
                <p className="text-primary-600"><strong>Senha:</strong> 123456</p>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800 text-xs">
                  {isInitializing ? (
                    <><Clock className="w-3 h-3 animate-spin inline mr-1" />Inicializando sistema...</>
                  ) : (
                    <><strong>✓ Sistema pronto!</strong> Use as credenciais acima para testar.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
