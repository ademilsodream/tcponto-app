
import { supabase } from '@/integrations/supabase/client';

const MAX_INIT_TIME = 8000; // 8 segundos máximo
const CONNECTION_TIMEOUT = 5000; // 5 segundos para conexão

export const initializeApp = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    console.log('🚀 Iniciando app com timeout de segurança...');
    
    // Timeout de segurança - NUNCA deixar carregar infinito
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Timeout de segurança ativado - prosseguindo sem verificação');
      resolve(true);
    }, MAX_INIT_TIME);

    const initWithTimeout = async () => {
      try {
        console.log('🔄 Verificando conexão básica...');

        // Timeout específico para a query
        const connectionPromise = supabase
          .from('profiles')
          .select('id')
          .limit(1);

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        
        console.log('✅ Conexão verificada com sucesso');
        clearTimeout(safetyTimeout);
        resolve(true);
        
      } catch (error) {
        console.warn('⚠️ Erro na verificação, mas prosseguindo:', error);
        // IMPORTANTE: Mesmo com erro, continuar o app
        clearTimeout(safetyTimeout);
        resolve(true);
      }
    };

    initWithTimeout();
  });
};
