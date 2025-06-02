
import { useMemo } from 'react';

export type InterfaceType = 'admin' | 'employee' | 'auto';

export const useInterfaceType = (): InterfaceType => {
  return useMemo(() => {
    const hostname = window.location.hostname;
    
    // Detectar se é subdomínio admin
    if (hostname.startsWith('admin.')) {
      return 'admin';
    }
    
    // Detectar se é subdomínio app/funcionário
    if (hostname.startsWith('app.') || hostname.startsWith('employee.')) {
      return 'employee';
    }
    
    // Para desenvolvimento local ou domínio principal, usar auto-detecção
    return 'auto';
  }, []);
};
