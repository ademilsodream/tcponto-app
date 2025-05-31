
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Euro } from 'lucide-react';
import { Currency } from '@/contexts/CurrencyContext';

interface CurrencySelectorProps {
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({ currency, onCurrencyChange }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Moeda:</span>
      <Select value={currency} onValueChange={onCurrencyChange}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white border shadow-lg z-50">
          <SelectItem value="EUR" className="flex items-center gap-2">
            <Euro className="w-4 h-4" />
            Euro (€)
          </SelectItem>
          <SelectItem value="BRL" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Real (R$)
          </SelectItem>
          <SelectItem value="USD" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Dólar ($)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default CurrencySelector;
