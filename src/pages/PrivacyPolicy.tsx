
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Eye, Clock, MapPin, Database, Users, FileText } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <CardTitle className="text-3xl font-bold text-gray-900">
                Política de Privacidade
              </CardTitle>
            </div>
            <p className="text-gray-600 text-lg">
              TCPonto - Sistema de Controle de Ponto Eletrônico
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="outline" className="px-3 py-1">
                Última atualização: Janeiro 2025
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                Versão 1.0
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Informações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              1. Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Esta Política de Privacidade descreve como o aplicativo <strong>TCPonto</strong> coleta, 
              usa, armazena e protege suas informações pessoais. Ao usar nosso aplicativo, você 
              concorda com as práticas descritas nesta política.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
              <p className="text-blue-800 font-medium">
                O TCPonto é um sistema de controle de ponto eletrônico desenvolvido para empresas 
                registrarem a jornada de trabalho de seus funcionários de forma digital e segura.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dados Coletados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              2. Dados Coletados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados Pessoais
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Nome completo</li>
                  <li>• Endereço de email</li>
                  <li>• Código do funcionário</li>
                  <li>• Função/Cargo</li>
                  <li>• Departamento</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Dados de Ponto
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Horários de entrada e saída</li>
                  <li>• Intervalos de almoço</li>
                  <li>• Data e hora dos registros</li>
                  <li>• Status dos registros</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Dados de Localização
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Coordenadas GPS (quando autorizado)</li>
                  <li>• Endereço aproximado</li>
                  <li>• Precisão do GPS</li>
                  <li>• Timestamp das localizações</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Dados Técnicos
                </h3>
                <ul className="space-y-2 text-gray-700">
                  <li>• Endereço IP</li>
                  <li>• Tipo de dispositivo</li>
                  <li>• Sistema operacional</li>
                  <li>• Logs de auditoria</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Finalidades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              3. Finalidades do Uso dos Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Finalidades Principais:</h4>
                <ul className="space-y-1 text-green-700">
                  <li>• Controle de ponto eletrônico conforme legislação trabalhista</li>
                  <li>• Gestão de recursos humanos e folha de pagamento</li>
                  <li>• Cumprimento de obrigações legais trabalhistas</li>
                  <li>• Validação de presença através de localização</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Finalidades Secundárias:</h4>
                <ul className="space-y-1 text-blue-700">
                  <li>• Melhoria do sistema e experiência do usuário</li>
                  <li>• Prevenção de fraudes e uso indevido</li>
                  <li>• Suporte técnico e resolução de problemas</li>
                  <li>• Relatórios gerenciais (dados anonimizados)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Base Legal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              4. Base Legal (LGPD)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              O tratamento dos seus dados pessoais é baseado nas seguintes hipóteses legais 
              da Lei Geral de Proteção de Dados (LGPD):
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge variant="outline">Art. 7º, II</Badge>
                <div>
                  <p className="font-medium">Cumprimento de obrigação legal</p>
                  <p className="text-sm text-gray-600">Legislação trabalhista e previdenciária</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge variant="outline">Art. 7º, V</Badge>
                <div>
                  <p className="font-medium">Execução de contrato</p>
                  <p className="text-sm text-gray-600">Contrato de trabalho e políticas da empresa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Badge variant="outline">Art. 7º, IX</Badge>
                <div>
                  <p className="font-medium">Legítimo interesse</p>
                  <p className="text-sm text-gray-600">Segurança patrimonial e prevenção de fraudes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              5. Segurança dos Dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Implementamos medidas técnicas e organizacionais para proteger seus dados:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Medidas Técnicas:</h4>
                <ul className="space-y-1 text-blue-700 text-sm">
                  <li>• Criptografia de dados (HTTPS/TLS)</li>
                  <li>• Autenticação segura</li>
                  <li>• Backup automático</li>
                  <li>• Monitoramento 24/7</li>
                </ul>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Medidas Organizacionais:</h4>
                <ul className="space-y-1 text-green-700 text-sm">
                  <li>• Treinamento da equipe</li>
                  <li>• Controle de acesso restrito</li>
                  <li>• Políticas de segurança</li>
                  <li>• Auditoria regular</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seus Direitos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              6. Seus Direitos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Conforme a LGPD, você tem os seguintes direitos sobre seus dados pessoais:
            </p>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Eye className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="font-medium">Direito de Acesso</p>
                  <p className="text-sm text-gray-600">Confirmar e acessar seus dados pessoais</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-green-600 mt-1" />
                <div>
                  <p className="font-medium">Direito de Correção</p>
                  <p className="text-sm text-gray-600">Corrigir dados incompletos ou inexatos</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <Database className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <p className="font-medium">Direito de Portabilidade</p>
                  <p className="text-sm text-gray-600">Receber dados em formato estruturado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cookies */}
        <Card>
          <CardHeader>
            <CardTitle>7. Cookies e Tecnologias Similares</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Utilizamos cookies apenas para funcionalidades essenciais:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>Sessão de usuário:</strong> Manter você logado no aplicativo</li>
              <li>• <strong>Preferências:</strong> Lembrar suas configurações</li>
              <li>• <strong>Segurança:</strong> Tokens de autenticação</li>
            </ul>
            <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
              <p className="text-yellow-800">
                <strong>Importante:</strong> Não utilizamos cookies para rastreamento ou publicidade.
                Todos os cookies são essenciais para o funcionamento do aplicativo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Retenção */}
        <Card>
          <CardHeader>
            <CardTitle>8. Retenção de Dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Período de Retenção:</h4>
                <ul className="space-y-1 text-blue-700">
                  <li>• <strong>Dados ativos:</strong> Durante vigência do contrato de trabalho</li>
                  <li>• <strong>Dados históricos:</strong> 5 anos após término (conforme CLT)</li>
                  <li>• <strong>Logs de segurança:</strong> 6 meses</li>
                  <li>• <strong>Dados de localização:</strong> 2 anos</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crianças */}
        <Card>
          <CardHeader>
            <CardTitle>9. Proteção de Menores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
              <p className="text-red-800 font-medium mb-2">
                Importante: Restrição de Idade
              </p>
              <p className="text-red-700">
                Este aplicativo é destinado exclusivamente para uso profissional por funcionários 
                maiores de 18 anos. Não coletamos intencionalmente dados de menores de 13 anos. 
                Se tomarmos conhecimento de que coletamos dados de uma criança menor de 13 anos, 
                tomaremos medidas para excluir essas informações.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader>
            <CardTitle>10. Contato e Exercício de Direitos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="space-y-2">
                <p><strong>Encarregado de Dados (DPO):</strong></p>
                <p>Email: dpo@tcponto.com.br</p>
                <p>Telefone: (11) 1234-5678</p>
                <p><strong>Prazo de resposta:</strong> até 15 dias úteis</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alterações */}
        <Card>
          <CardHeader>
            <CardTitle>11. Alterações desta Política</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              Esta Política de Privacidade pode ser atualizada periodicamente. Notificaremos 
              sobre mudanças significativas através do aplicativo ou por email. A data da 
              última atualização sempre será indicada no topo desta página.
            </p>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Footer */}
        <div className="text-center text-gray-600 text-sm pb-8">
          <p>© 2025 TCPonto. Todos os direitos reservados.</p>
          <p>Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD) - Lei nº 13.709/2018</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
