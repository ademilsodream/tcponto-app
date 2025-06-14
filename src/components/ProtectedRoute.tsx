
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useOptimizedAuth } from '@/contexts/OptimizedAuthContext';
import { Clock, UserX, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, profile, isLoading, hasAccess } = useOptimizedAuth();

  // ✨ Loading state - aguardando verificação completa
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-primary-600">Verificando autenticação e permissões...</p>
        </div>
      </div>
    );
  }

  // ✨ Se não há usuário logado, redirecionar para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ✨ Se usuário logado mas sem perfil carregado ainda, aguardar
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-primary-600">Carregando perfil do usuário...</p>
        </div>
      </div>
    );
  }

  // ✨ BLOQUEIO TOTAL: Se não tem acesso, mostrar tela de acesso negado e não permitir entrada no app
  if (!hasAccess) {
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

          <div className="bg-white rounded-lg shadow-2xl p-6">
            <div className="text-center mb-6">
              <UserX className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-red-600 mb-2">Acesso Negado</h2>
              <p className="text-gray-600">Sua conta não tem permissão para acessar este sistema</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  {profile?.status !== 'active' ? (
                    <div>
                      <p className="font-medium mb-1">Conta Inativa</p>
                      <p>Sua conta está com status inativo. Entre em contato com o administrador para reativar sua conta.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium mb-1">Sem Permissão de Registro</p>
                      <p>Você não tem permissão para registrar ponto no sistema. Entre em contato com o administrador para solicitar acesso.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 mb-4">
              <p>Entre em contato com o administrador do sistema para resolver esta situação.</p>
            </div>

            <div className="text-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-[#021B40] hover:bg-[#021B40]/90 text-white px-6 py-2 rounded-lg text-sm"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✨ Se passou por todas as verificações, permitir acesso ao app
  return <>{children}</>;
};

export default ProtectedRoute;
