
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
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'default_currency')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar moeda do sistema:', error);
        return;
      }

      if (data?.setting_value) {
        setCurrencyState(data.setting_value as Currency);
      }
    } catch (error) {
      console.error('Erro ao carregar moeda do sistema:', error);
    }
  };

  useEffect(() => {
    loadSystemCurrency();
  }, []);

  const setCurrency = async (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    
    try {
      // Verificar se já existe a configuração
      const { data: existingSetting, error: selectError } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'default_currency')
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
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

        if (error) throw error;
      } else {
        // Inserir nova configuração
        const { error } = await supabase
          .from('system_settings')
          .insert({
            setting_key: 'default_currency',
            setting_value: newCurrency,
            description: 'Moeda padrão do sistema'
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao salvar moeda no sistema:', error);
      // Reverter para o valor anterior em caso de erro
      loadSystemCurrency();
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
