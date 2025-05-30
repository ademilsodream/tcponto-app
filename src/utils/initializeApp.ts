
import { supabase } from '@/integrations/supabase/client';

export const initializeApp = async () => {
  try {
    console.log('Verificando conexão com o banco...');

    // Fazer uma consulta simples para verificar se a conexão está funcionando
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Erro ao conectar com o banco:', error);
      return;
    }

    console.log('Conexão com o banco estabelecida com sucesso');
    
  } catch (error) {
    console.error('Erro durante verificação de conexão:', error);
  }
};
