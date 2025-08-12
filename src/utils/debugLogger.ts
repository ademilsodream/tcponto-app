
import { Capacitor } from '@capacitor/core';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private sessionId = Math.random().toString(36).substring(7);

  log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      sessionId: this.sessionId
    };

    this.logs.push(entry);
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log no console também
    const logMethod = level === 'ERROR' ? 'error' : 
                     level === 'WARN' ? 'warn' : 
                     level === 'INFO' ? 'info' : 'debug';
    
    console[logMethod](`[${level}] ${message}`, data || '');
  }

  getLogs(level?: LogLevel): LogEntry[] {
    return level ? this.logs.filter(log => log.level === level) : this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

const logger = new DebugLogger();

export const debugLog = (level: LogLevel, message: string, data?: any) => {
  logger.log(level, message, data);
};

export const getDebugLogs = (level?: LogLevel) => logger.getLogs(level);
export const clearDebugLogs = () => logger.clearLogs();
export const exportDebugLogs = () => logger.exportLogs();

// Utilitários para detecção de plataforma
export const isMobile = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch (error) {
    // Fallback para detecção via user agent
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
};

export const getPlatform = (): string => {
  try {
    return Capacitor.getPlatform();
  } catch (error) {
    return 'web';
  }
};

export const checkConnectivity = async (): Promise<boolean> => {
  try {
    // Verificar conectividade básica
    if (!navigator.onLine) {
      return false;
    }
    
    // Fazer um teste simples de conectividade
    const response = await fetch('data:,', { method: 'HEAD' });
    return true;
  } catch (error) {
    debugLog('ERROR', 'Erro ao verificar conectividade', { error });
    return false;
  }
};
