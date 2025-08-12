// Sistema de debug para capturar logs de erro no ambiente mobile
export class DebugLogger {
  private static instance: DebugLogger;
  private logs: string[] = [];
  private maxLogs = 100;

  private constructor() {
    // Capturar erros globais
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.log('ERROR', `Global error: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error?.stack
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.log('ERROR', `Unhandled promise rejection: ${event.reason}`, {
          reason: event.reason
        });
      });
    }
  }

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    this.logs.push(JSON.stringify(logEntry));
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log no console também
    console.log(`[${level}] ${message}`, data || '');
    
    // Salvar no localStorage para debug
    try {
      localStorage.setItem('tcponto_debug_logs', JSON.stringify(this.logs));
    } catch (error) {
      console.error('Failed to save debug logs:', error);
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('tcponto_debug_logs');
    } catch (error) {
      console.error('Failed to clear debug logs:', error);
    }
  }

  exportLogs(): string {
    return this.logs.join('\n');
  }
}

// Função helper para log rápido
export const debugLog = (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: any) => {
  DebugLogger.getInstance().log(level, message, data);
};

// Função para verificar se estamos no ambiente mobile
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  
  // Verificar se é Capacitor
  if (typeof window.Capacitor !== 'undefined') return true;
  
  // Verificar user agent
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

// Função para verificar conectividade
export const checkConnectivity = async () => {
  try {
    const response = await fetch('https://cyapqtyrefkdemhxryvs.supabase.co/rest/v1/', {
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    debugLog('ERROR', 'Connectivity check failed', { error });
    return false;
  }
};
