
import { supabase } from '@/integrations/supabase/client';

export const initializeApp = async () => {
  try {
    // Verificar se já existem usuários
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (profilesError) {
      console.error('Erro ao verificar perfis:', profilesError);
      return;
    }

    // Se já existem usuários, não fazer nada
    if (profiles && profiles.length > 0) {
      console.log('Usuários já existem no sistema');
      return;
    }

    // Criar usuário administrador padrão
    console.log('Criando usuário administrador padrão...');
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'admin@tcponto.com',
      password: '123456',
      options: {
        data: {
          name: 'Administrador',
          role: 'admin'
        }
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário admin:', authError);
      return;
    }

    if (authData.user) {
      // Criar perfil do administrador
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          name: 'Administrador',
          email: 'admin@tcponto.com',
          role: 'admin',
          hourly_rate: 50.00
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Erro ao criar perfil admin:', profileError);
        return;
      }

      console.log('Usuário administrador criado com sucesso!');
    }

    // Criar usuário funcionário de demonstração
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

    if (userAuthError) {
      console.error('Erro ao criar usuário funcionário:', userAuthError);
      return;
    }

    if (userAuthData.user) {
      // Criar perfil do funcionário
      const { error: userProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: userAuthData.user.id,
          name: 'João Silva',
          email: 'joao@tcponto.com',
          role: 'user',
          hourly_rate: 30.00
        }, {
          onConflict: 'id'
        });

      if (userProfileError) {
        console.error('Erro ao criar perfil funcionário:', userProfileError);
        return;
      }

      console.log('Usuário funcionário criado com sucesso!');
    }

  } catch (error) {
    console.error('Erro durante inicialização:', error);
  }
};
