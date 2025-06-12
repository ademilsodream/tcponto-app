
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Integration = () => {
  const [showToken, setShowToken] = React.useState(false);
  const { toast } = useToast();
  
  // URL base do sistema
  const baseUrl = window.location.origin;
  const apiUrl = `${baseUrl}/api/tcponto`;
  
  // Token de integração (em produção, isso seria gerado dinamicamente)
  const integrationToken = "tcponto_2024_integration_token_" + Math.random().toString(36).substring(2, 15);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integração do Sistema</h1>
        <p className="text-gray-600">Informações para integração com outros sistemas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados de Integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="url">URL da API</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                value={apiUrl}
                readOnly
                className="bg-gray-50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(apiUrl, "URL da API")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="token">Token de Integração</Label>
            <div className="flex gap-2">
              <Input
                id="token"
                type={showToken ? "text" : "password"}
                value={integrationToken}
                readOnly
                className="bg-gray-50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(integrationToken, "Token")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Como usar:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use a URL acima como endpoint para requisições</li>
              <li>• Inclua o token no header: Authorization: Bearer {integrationToken.substring(0, 20)}...</li>
              <li>• Suporta métodos GET, POST, PUT, DELETE</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Integration;
