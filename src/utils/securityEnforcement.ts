
import { supabase } from '@/integrations/supabase/client';

// Sistema de imposição de segurança em tempo real
export class SecurityEnforcement {
  
  // Verificar integridade de dados críticos
  static async verifyDataIntegrity(tableName: string, recordId: string): Promise<boolean> {
    try {
      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!auditLogs || auditLogs.length === 0) {
        console.warn(`Nenhum log de auditoria encontrado para ${tableName}:${recordId}`);
        return true; // Permite por ser novo registro
      }

      // Verificar consistência dos logs
      for (let i = 0; i < auditLogs.length - 1; i++) {
        const currentLog = auditLogs[i];
        const previousLog = auditLogs[i + 1];

        if (currentLog.operation === 'UPDATE' && previousLog.new_values) {
          // Verificar se o old_values do atual coincide com new_values do anterior
          const currentOld = currentLog.old_values;
          const previousNew = previousLog.new_values;

          if (JSON.stringify(currentOld) !== JSON.stringify(previousNew)) {
            console.error('Inconsistência detectada nos logs de auditoria:', {
              current: currentLog.id,
              previous: previousLog.id,
              table: tableName,
              record: recordId
            });
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Erro ao verificar integridade:', error);
      return false;
    }
  }

  // Detectar tentativas de manipulação
  static async detectManipulationAttempts(userId: string): Promise<void> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: recentLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false });

      if (!recentLogs || recentLogs.length === 0) return;

      // Detectar atividade suspeita
      const suspiciousPatterns = {
        rapidModifications: recentLogs.length > 50, // Mais de 50 operações em 1 hora
        massDeletion: recentLogs.filter(log => log.operation === 'DELETE').length > 10,
        salaryManipulation: recentLogs.some(log => 
          log.table_name === 'profiles' && 
          log.changed_fields?.includes('hourly_rate') ||
          log.changed_fields?.includes('overtime_rate')
        ),
        timeRecordManipulation: recentLogs.filter(log => 
          log.table_name === 'time_records'
        ).length > 20
      };

      const suspiciousActivity = Object.entries(suspiciousPatterns)
        .filter(([_, detected]) => detected)
        .map(([pattern, _]) => pattern);

      if (suspiciousActivity.length > 0) {
        // Criar alerta de segurança
        await supabase
          .from('system_alerts')
          .insert({
            alert_type: 'security_warning',
            employee_id: userId,
            title: 'Atividade Suspeita Detectada',
            message: `Padrões suspeitos detectados: ${suspiciousActivity.join(', ')}`,
            severity: 'high',
            metadata: {
              patterns: suspiciousActivity,
              log_count: recentLogs.length,
              timestamp: new Date().toISOString()
            }
          });

        console.warn('Atividade suspeita detectada:', {
          userId,
          patterns: suspiciousActivity,
          logCount: recentLogs.length
        });
      }
    } catch (error) {
      console.error('Erro ao detectar manipulação:', error);
    }
  }

  // Validar permissões em tempo real
  static async validatePermissions(userId: string, operation: string, resourceType: string): Promise<boolean> {
    try {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single();

      if (!userProfile) {
        console.error('Perfil de usuário não encontrado:', userId);
        return false;
      }

      if (userProfile.status !== 'active') {
        console.error('Usuário inativo tentando operação:', userId);
        return false;
      }

      // Regras de permissão
      const permissions = {
        admin: ['READ', 'WRITE', 'DELETE', 'MODIFY_USERS', 'VIEW_REPORTS'],
        user: ['READ', 'WRITE_OWN']
      };

      const userPermissions = permissions[userProfile.role as keyof typeof permissions] || [];

      // Validar operação específica
      switch (operation) {
        case 'MODIFY_PROFILE':
          return userPermissions.includes('MODIFY_USERS') || 
                 (userPermissions.includes('WRITE_OWN') && resourceType === 'own_profile');
        
        case 'VIEW_AUDIT_LOGS':
          return userPermissions.includes('VIEW_REPORTS');
        
        case 'DELETE_RECORDS':
          return userPermissions.includes('DELETE');
        
        case 'MODIFY_SALARY':
          return userPermissions.includes('MODIFY_USERS');
        
        default:
          return userPermissions.includes('READ');
      }
    } catch (error) {
      console.error('Erro ao validar permissões:', error);
      return false;
    }
  }

  // Monitor de sessão
  static async monitorSession(userId: string): Promise<void> {
    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('session_token', 'current')
        .single();

      const now = new Date();
      
      if (!existingSession) {
        // Criar nova sessão
        await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            session_token: 'current',
            expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString() // 8 horas
          });
      } else {
        // Verificar se sessão não expirou
        const expiresAt = new Date(existingSession.expires_at);
        if (now > expiresAt) {
          console.warn('Sessão expirada detectada:', userId);
          
          // Criar alerta
          await supabase
            .from('system_alerts')
            .insert({
              alert_type: 'session_expired',
              employee_id: userId,
              title: 'Sessão Expirada',
              message: 'Usuário tentou acessar com sessão expirada',
              severity: 'medium',
              metadata: {
                expired_at: expiresAt.toISOString(),
                current_time: now.toISOString()
              }
            });
        }
      }
    } catch (error) {
      console.error('Erro ao monitorar sessão:', error);
    }
  }

  // Limpeza automática de dados sensíveis
  static async cleanupSensitiveData(): Promise<void> {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Limpar logs de auditoria antigos (manter apenas últimos 6 meses)
      await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', sixMonthsAgo.toISOString());

      // Limpar sessões expiradas
      await supabase.rpc('cleanup_expired_sessions');

      console.log('Limpeza de dados sensíveis concluída');
    } catch (error) {
      console.error('Erro na limpeza de dados:', error);
    }
  }
}

// Executar verificações de segurança automaticamente
export function initializeSecurityMonitoring(userId: string): () => void {
  // Verificar integridade a cada 5 minutos
  const integrityCheck = setInterval(async () => {
    await SecurityEnforcement.detectManipulationAttempts(userId);
  }, 5 * 60 * 1000);

  // Monitorar sessão a cada minuto
  const sessionMonitor = setInterval(async () => {
    await SecurityEnforcement.monitorSession(userId);
  }, 60 * 1000);

  // Limpeza diária (apenas uma vez por dia)
  const dailyCleanup = setInterval(async () => {
    await SecurityEnforcement.cleanupSensitiveData();
  }, 24 * 60 * 60 * 1000);

  // Cleanup quando o componente for desmontado
  return () => {
    clearInterval(integrityCheck);
    clearInterval(sessionMonitor);
    clearInterval(dailyCleanup);
  };
}
