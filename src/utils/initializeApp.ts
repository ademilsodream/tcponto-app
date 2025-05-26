
import { supabase } from '@/integrations/supabase/client';

export const initializeApp = async () => {
  try {
    console.log('Inicializando aplicação...');

    // Verificar se já existem usuários com uma query mais simples
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (profilesError) {
      console.error('Erro ao verificar perfis:', profilesError);
      // Não relançar erro para não quebrar o sistema
      return;
    }

    // Se já existem usuários, não fazer nada
    if (profiles && profiles.length > 0) {
      console.log('Usuários já existem no sistema');
      return;
    }

    console.log('Nenhum usuário encontrado, criando usuários de demonstração...');

    // Criar usuário administrador padrão
    console.log('Criando usuário administrador...');
    try {
      const { error: adminError } = await supabase.auth.signUp({
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
      } else {
        console.log('Usuário administrador criado!');
      }
    } catch (error) {
      console.error('Erro na criação do admin:', error);
    }

    // Aguardar um pouco antes de criar o próximo usuário
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Criar usuário funcionário de demonstração
    console.log('Criando usuário funcionário...');
    try {
      const { error: userError } = await supabase.auth.signUp({
        email: 'joao@tcponto.com',
        password: '123456',
        options: {
          data: {
            name: 'João Silva',
            role: 'user'
          }
        }
      });

      if (userError && !userError.message.includes('already registered')) {
        console.error('Erro ao criar usuário funcionário:', userError);
      } else {
        console.log('Usuário funcionário criado!');
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
