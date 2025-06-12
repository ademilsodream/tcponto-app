import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ApiConfig() {
  const [token, setToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = "http://localhost:3001/api/tcponto";

  const generateToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:3001/api/generate-token", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Falha ao gerar token");
      }

      const data = await response.json();
      setToken(data.token);
      toast.success("Token gerado com sucesso!");
    } catch (error) {
      toast.error("Erro ao gerar token");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Configurações da API</CardTitle>
        <CardDescription>
          Gerencie as configurações de integração com o sistema de obras
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL da API</Label>
          <div className="flex gap-2">
            <Input value={apiUrl} readOnly />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(apiUrl)}
            >
              Copiar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Token de Acesso</Label>
          <div className="flex gap-2">
            <Input
              value={token}
              readOnly
              placeholder="Clique em 'Gerar Token' para criar um novo token"
            />
            <Button
              variant="outline"
              onClick={() => copyToClipboard(token)}
              disabled={!token}
            >
              Copiar
            </Button>
          </div>
        </div>

        <Button
          onClick={generateToken}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? "Gerando..." : "Gerar Novo Token"}
        </Button>

        <div className="text-sm text-muted-foreground">
          <p className="font-medium">Como usar:</p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li>Copie a URL da API</li>
            <li>Gere um token de acesso</li>
            <li>Use o token no header Authorization: Bearer {token}</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
} 