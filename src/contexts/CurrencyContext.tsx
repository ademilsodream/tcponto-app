
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Currency = 'BRL' | 'EUR' | 'USD';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (value: number) => string;
  getCurrencySymbol: () => string;
  loadSystemCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>('EUR');

  const loadSystemCurrency = async () => {
    try {
      console.log('🔄 Carregando moeda do sistema...');
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'default_currency')
        .maybeSingle();

      if (error) {
        console.error('❌ Erro ao carregar moeda do sistema:', error);
        // Em caso de erro, manter EUR como padrão
        return;
      }

      if (data?.setting_value && ['BRL', 'EUR', 'USD'].includes(data.setting_value)) {
        console.log('✅ Moeda carregada:', data.setting_value);
        setCurrencyState(data.setting_value as Currency);
      } else {
        console.log('💡 Usando moeda padrão: EUR');
      }
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar moeda do sistema:', error);
      // Em caso de erro, manter EUR como padrão
    }
  };

  useEffect(() => {
    // Carregar moeda apenas se o usuário estiver autenticado
    const checkAuthAndLoadCurrency = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadSystemCurrency();
        }
      } catch (error) {
        console.error('❌ Erro ao verificar sessão para carregar moeda:', error);
      }
    };

    checkAuthAndLoadCurrency();
  }, []);

  const setCurrency = async (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    
    try {
      // Verificar se já existe a configuração
      const { data: existingSetting, error: selectError } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'default_currency')
        .maybeSingle();

      if (selectError) {
        console.error('❌ Erro ao verificar configuração existente:', selectError);
        return;
      }

      if (existingSetting) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('system_settings')
          .update({
            setting_value: newCurrency,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', 'default_currency');

        if (error) {
          console.error('❌ Erro ao atualizar moeda:', error);
          throw error;
        }
      } else {
        // Inserir nova configuração
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'default_currency',
            setting_value: newCurrency,
            description: 'Moeda padrão do sistema'
          });

        if (error) {
          console.error('❌ Erro ao inserir moeda:', error);
          throw error;
        }
      }

      console.log('✅ Moeda salva:', newCurrency);
    } catch (error) {
      console.error('❌ Erro ao salvar moeda no sistema:', error);
      // Reverter para o valor anterior em caso de erro
      await loadSystemCurrency();
    }
  };

  const getCurrencySymbol = () => {
    switch (currency) {
      case 'BRL': return 'R$';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return '€';
    }
  };

  const formatCurrency = (value: number) => {
    const symbol = getCurrencySymbol();
    
    // Formatação específica por moeda
    switch (currency) {
      case 'BRL':
        return `${symbol} ${value.toFixed(2).replace('.', ',')}`;
      case 'EUR':
        return `${value.toFixed(2)} ${symbol}`;
      case 'USD':
        return `${symbol} ${value.toFixed(2)}`;
      default:
        return `${value.toFixed(2)} €`;
    }
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      setCurrency,
      formatCurrency,
      getCurrencySymbol,
      loadSystemCurrency
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
