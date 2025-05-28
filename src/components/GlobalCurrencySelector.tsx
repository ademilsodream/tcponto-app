
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Euro, Users } from 'lucide-react';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';

const GlobalCurrencySelector: React.FC = () => {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Moeda:</span>
      <Select value={currency} onValueChange={setCurrency}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white border shadow-lg z-50">
          <SelectItem value="EUR" className="flex items-center gap-2">
           
            Euro (€)
          </SelectItem>
          <SelectItem value="BRL" className="flex items-center gap-2">
           
            Real (R$)
          </SelectItem>
          <SelectItem value="USD" className="flex items-center gap-2">
           
            Dólar ($)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default GlobalCurrencySelector;
