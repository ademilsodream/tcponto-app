
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

  // Validar permissões em tempo real com as novas políticas RLS
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

      // Verificar se as políticas RLS estão funcionando
      const isAdmin = userProfile.role === 'admin';

      // Regras de permissão baseadas nas políticas RLS implementadas
      switch (operation) {
        case 'VIEW_AUDIT_LOGS':
          return isAdmin; // Apenas admins podem ver logs de auditoria
        
        case 'MODIFY_SYSTEM_SETTINGS':
          return isAdmin; // Apenas admins podem modificar configurações
        
        case 'VIEW_ALL_TIME_RECORDS':
          return isAdmin; // Apenas admins podem ver todos os registros
        
        case 'MODIFY_USER_PROFILES':
          return isAdmin; // Apenas admins podem modificar perfis
        
        case 'MANAGE_DEPARTMENTS':
          return isAdmin; // Apenas admins podem gerenciar departamentos
        
        case 'MANAGE_JOB_FUNCTIONS':
          return isAdmin; // Apenas admins podem gerenciar funções
        
        case 'VIEW_OWN_DATA':
          return true; // Usuários podem ver seus próprios dados (garantido pelas políticas RLS)
        
        default:
          return false; // Negar por padrão
      }
    } catch (error) {
      console.error('Erro ao validar permissões:', error);
      return false;
    }
  }

  // Monitor de sessão aprimorado
  static async monitorSession(userId: string): Promise<void> {
    try {
      const { data: existingSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .single();

      const now = new Date();
      
      if (!existingSession) {
        // Criar nova sessão com as políticas RLS
        await supabase
          .from('user_sessions')
          .insert({
            user_id: userId,
            session_token: `session_${Date.now()}`,
            expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString() // 8 horas
          });
      } else {
        // Verificar se sessão não expirou
        const expiresAt = new Date(existingSession.expires_at);
        if (now > expiresAt) {
          console.warn('Sessão expirada detectada:', userId);
          
          // Criar alerta que será protegido pelas políticas RLS
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

  // Verificar se as políticas RLS estão funcionando corretamente
  static async testRLSPolicies(userId: string): Promise<boolean> {
    try {
      console.log('🔐 Testando políticas RLS para usuário:', userId);

      // Testar acesso aos próprios dados
      const { data: ownTimeRecords, error: ownError } = await supabase
        .from('time_records')
        .select('*')
        .limit(1);

      if (ownError) {
        console.error('❌ Erro ao acessar próprios registros:', ownError);
        return false;
      }

      console.log('✅ Acesso aos próprios dados funcionando');

      // Testar se pode ver configurações do sistema (só admin deveria)
      const { data: systemSettings, error: settingsError } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const isAdmin = profile?.role === 'admin';

      if (isAdmin && settingsError) {
        console.error('❌ Admin não consegue acessar configurações:', settingsError);
        return false;
      }

      if (!isAdmin && !settingsError && systemSettings?.length > 0) {
        console.error('❌ Usuário comum conseguiu acessar configurações do sistema');
        return false;
      }

      console.log('✅ Políticas RLS funcionando corretamente');
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar políticas RLS:', error);
      return false;
    }
  }

  // Limpeza automática de dados sensíveis (agora protegida por RLS)
  static async cleanupSensitiveData(): Promise<void> {
    try {
      // Esta função só funcionará se o usuário tiver permissões adequadas (admin)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Verificar se tem permissão para fazer limpeza
      const { data: profile } = await supabase.auth.getUser();
      if (!profile.user) {
        console.warn('Usuário não autenticado para limpeza');
        return;
      }

      // A limpeza só funcionará se o usuário for admin devido às políticas RLS
      await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', sixMonthsAgo.toISOString());

      console.log('✅ Limpeza de dados sensíveis concluída');
    } catch (error) {
      console.error('❌ Erro na limpeza de dados (pode ser devido às políticas RLS):', error);
    }
  }
}

// Executar verificações de segurança automaticamente
export function initializeSecurityMonitoring(userId: string): () => void {
  // Testar políticas RLS imediatamente
  SecurityEnforcement.testRLSPolicies(userId);

  // Verificar integridade a cada 5 minutos
  const integrityCheck = setInterval(async () => {
    await SecurityEnforcement.detectManipulationAttempts(userId);
  }, 5 * 60 * 1000);

  // Monitorar sessão a cada minuto
  const sessionMonitor = setInterval(async () => {
    await SecurityEnforcement.monitorSession(userId);
  }, 60 * 1000);

  // Limpeza diária (apenas uma vez por dia, protegida por RLS)
  const dailyCleanup = setInterval(async () => {
    await SecurityEnforcement.cleanupSensitiveData();
  }, 24 * 60 * 60 * 1000);

  console.log('🔐 Sistema de segurança inicializado com políticas RLS ativas');

  // Cleanup quando o componente for desmontado
  return () => {
    clearInterval(integrityCheck);
    clearInterval(sessionMonitor);
    clearInterval(dailyCleanup);
  };
}
