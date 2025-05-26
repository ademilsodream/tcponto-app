
import { supabase } from '@/integrations/supabase/client';

export const initializeApp = async () => {
  try {
    console.log('Inicializando aplicação...');

    // Verificar se já existem usuários
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profilesError) {
      console.error('Erro ao verificar perfis:', profilesError);
      throw profilesError;
    }

    // Se já existem usuários, não fazer nada
    if (profiles && profiles.length > 0) {
      console.log('Usuários já existem no sistema, total:', profiles.length);
      return;
    }

    console.log('Nenhum usuário encontrado, criando usuários de demonstração...');

    // Criar usuário administrador padrão
    console.log('Criando usuário administrador...');
    try {
      const { data: adminData, error: adminError } = await supabase.auth.signUp({
        email: 'admin@tcponto.com',
        password: '123456',
        options: {
          data: {
            name: 'Administrador',
            role: 'admin'
          }
        }
      });

      if (adminError && !adminError.message.includes('already registered')) {
        console.error('Erro ao criar usuário admin:', adminError);
      } else if (adminData.user) {
        console.log('Usuário administrador criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro na criação do admin:', error);
    }

    // Aguardar um pouco antes de criar o próximo usuário
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Criar usuário funcionário de demonstração
    console.log('Criando usuário funcionário...');
    try {
      const { data: userAuthData, error: userAuthError } = await supabase.auth.signUp({
        email: 'joao@tcponto.com',
        password: '123456',
        options: {
          data: {
            name: 'João Silva',
            role: 'user'
          }
        }
      });

      if (userAuthError && !userAuthError.message.includes('already registered')) {
        console.error('Erro ao criar usuário funcionário:', userAuthError);
      } else if (userAuthData.user) {
        console.log('Usuário funcionário criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro na criação do funcionário:', error);
    }

    console.log('Inicialização concluída!');

  } catch (error) {
    console.error('Erro durante inicialização:', error);
    // Não relançar o erro para não quebrar o login
  }
};
