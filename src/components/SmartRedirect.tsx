
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInterfaceType } from '@/hooks/useInterfaceType';
import { Clock } from 'lucide-react';

const SmartRedirect: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const interfaceType = useInterfaceType();

  useEffect(() => {
    if (loading || !user) return;

    // Se estamos em uma interface específica, verificar se o usuário tem acesso
    if (interfaceType === 'admin' && user.role !== 'admin') {
      // Admin tentando acessar área administrativa sem permissão
      window.location.href = `${window.location.protocol}//${window.location.hostname.replace('admin.', '')}`;
      return;
    }

    if (interfaceType === 'employee' && user.role === 'admin') {
      // Admin sendo redirecionado para área administrativa
      window.location.href = `${window.location.protocol}//admin.${window.location.hostname.replace(/^(app\.|employee\.)/, '')}`;
      return;
    }

    // Auto-detecção baseada no papel do usuário
    if (interfaceType === 'auto') {
      const baseHostname = window.location.hostname;
      
      if (user.role === 'admin') {
        // Admin deve ir para subdomínio admin
        if (!baseHostname.startsWith('admin.')) {
          window.location.href = `${window.location.protocol}//admin.${baseHostname}`;
          return;
        }
      } else {
        // Funcionário deve ir para subdomínio app
        if (!baseHostname.startsWith('app.') && !baseHostname.includes('localhost')) {
          window.location.href = `${window.location.protocol}//app.${baseHostname}`;
          return;
        }
      }
    }

    // Se chegou até aqui, está na interface correta
    navigate('/', { replace: true });
  }, [user, loading, interfaceType, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
          <p className="text-primary-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default SmartRedirect;
