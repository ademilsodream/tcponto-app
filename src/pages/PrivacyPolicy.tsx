
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-600 mr-2" />
              <CardTitle className="text-3xl font-bold">Política de Privacidade</CardTitle>
            </div>
            <p className="text-gray-600">TCPonto - Sistema de Controle de Ponto</p>
            <p className="text-sm text-gray-500">Última atualização: Janeiro de 2025</p>
          </CardHeader>

          <CardContent className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
              <p className="mb-4">
                A TCPonto ("nós", "nosso" ou "empresa") está comprometida em proteger a privacidade e 
                segurança dos dados pessoais dos usuários do nosso aplicativo de controle de ponto. 
                Esta Política de Privacidade descreve como coletamos, usamos, processamos e protegemos 
                suas informações pessoais.
              </p>
              <p className="mb-4">
                Ao usar nosso aplicativo, você concorda com as práticas descritas nesta política. 
                Se você não concordar com qualquer parte desta política, não use nosso serviço.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Dados que Coletamos</h2>
              
              <h3 className="text-xl font-medium mb-3">2.1 Dados Pessoais</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Nome completo e informações de identificação</li>
                <li>Endereço de e-mail corporativo</li>
                <li>Telefone de contato</li>
                <li>Função e departamento na empresa</li>
                <li>Dados de identificação profissional</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">2.2 Dados de Ponto e Frequência</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Horários de entrada, saída e intervalos</li>
                <li>Registros de presença e ausência</li>
                <li>Horas trabalhadas e horas extras</li>
                <li>Dados de localização durante o registro de ponto</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">2.3 Dados de Localização</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Coordenadas GPS durante o registro de ponto</li>
                <li>Endereço aproximado dos registros</li>
                <li>Precisão e qualidade do sinal GPS</li>
              </ul>

              <h3 className="text-xl font-medium mb-3">2.4 Dados Técnicos</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Informações do dispositivo (modelo, sistema operacional)</li>
                <li>Endereço IP e dados de conectividade</li>
                <li>Logs de acesso e uso do aplicativo</li>
                <li>Dados de performance e diagnóstico</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Como Usamos seus Dados</h2>
              <ul className="list-disc pl-6 mb-4">
                <li>Controle de jornada de trabalho e frequência</li>
                <li>Cálculo de horas trabalhadas e remuneração</li>
                <li>Geração de relatórios trabalhistas</li>
                <li>Verificação de presença em locais autorizados</li>
                <li>Cumprimento de obrigações legais trabalhistas</li>
                <li>Melhoria dos serviços e funcionalidades</li>
                <li>Suporte técnico e resolução de problemas</li>
                <li>Comunicação sobre atualizações do sistema</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Base Legal para Processamento</h2>
              <p className="mb-4">
                Processamos seus dados pessoais com base nas seguintes bases legais conforme a LGPD:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li><strong>Execução de contrato:</strong> Para cumprir obrigações contratuais de trabalho</li>
                <li><strong>Cumprimento de obrigação legal:</strong> Para atender legislação trabalhista</li>
                <li><strong>Interesse legítimo:</strong> Para administração de RH e controle de ponto</li>
                <li><strong>Consentimento:</strong> Para funcionalidades específicas quando aplicável</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Compartilhamento de Dados</h2>
              <p className="mb-4">
                Seus dados podem ser compartilhados nas seguintes situações:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Com o departamento de Recursos Humanos da empresa</li>
                <li>Com autoridades competentes quando exigido por lei</li>
                <li>Com auditores e consultores sob acordos de confidencialidade</li>
                <li>Com provedores de serviços técnicos sob rigorosos contratos de proteção</li>
              </ul>
              <p className="mb-4">
                <strong>Não vendemos, alugamos ou comercializamos seus dados pessoais.</strong>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Segurança dos Dados</h2>
              <ul className="list-disc pl-6 mb-4">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controles de acesso baseados em funções</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups seguros e redundantes</li>
                <li>Auditoria regular de sistemas</li>
                <li>Treinamento de equipe em segurança</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Seus Direitos</h2>
              <p className="mb-4">Conforme a LGPD, você tem os seguintes direitos:</p>
              <ul className="list-disc pl-6 mb-4">
                <li><strong>Acesso:</strong> Solicitar informações sobre seus dados</li>
                <li><strong>Correção:</strong> Corrigir dados incompletos ou inexatos</li>
                <li><strong>Exclusão:</strong> Solicitar remoção de dados quando aplicável</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Revogação:</strong> Retirar consentimento quando aplicável</li>
                <li><strong>Informação:</strong> Saber sobre compartilhamento de dados</li>
              </ul>
              <p className="mb-4">
                Para exercer seus direitos, entre em contato através do e-mail: privacidade@tcponto.com
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Cookies e Tecnologias Similares</h2>
              <p className="mb-4">
                Utilizamos cookies e tecnologias similares para:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Manter sua sessão ativa no aplicativo</li>
                <li>Lembrar suas preferências de configuração</li>
                <li>Melhorar a performance do aplicativo</li>
                <li>Coletar estatísticas de uso anônimas</li>
              </ul>
              <p className="mb-4">
                Você pode gerenciar cookies através das configurações do seu dispositivo.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Retenção de Dados</h2>
              <p className="mb-4">
                Mantemos seus dados pelo tempo necessário para:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Cumprir obrigações contratuais de trabalho</li>
                <li>Atender exigências legais trabalhistas (5 anos após rescisão)</li>
                <li>Resolver disputas e questões legais</li>
                <li>Manter registros para auditoria</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Menores de Idade</h2>
              <p className="mb-4">
                Nosso serviço não é destinado a menores de 18 anos. Não coletamos intencionalmente 
                dados de menores. Se você for menor de idade e está usando este aplicativo como 
                funcionário, certifique-se de que tem autorização legal e supervisão adequada.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Transferência Internacional</h2>
              <p className="mb-4">
                Seus dados são processados e armazenados no Brasil. Caso haja transferência 
                internacional, garantiremos proteção adequada conforme exigido pela LGPD.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Atualizações da Política</h2>
              <p className="mb-4">
                Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças 
                significativas através do aplicativo ou e-mail. Recomendamos revisar regularmente 
                esta política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">13. Contato</h2>
              <p className="mb-4">
                Para questões sobre esta política ou proteção de dados:
              </p>
              <ul className="list-none pl-0 mb-4">
                <li><strong>E-mail:</strong> privacidade@tcponto.com</li>
                <li><strong>Telefone:</strong> (11) 99999-9999</li>
                <li><strong>Endereço:</strong> [Endereço da empresa]</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">14. Encarregado de Dados</h2>
              <p className="mb-4">
                Nosso Encarregado de Proteção de Dados (DPO) pode ser contatado através de:
              </p>
              <ul className="list-none pl-0 mb-4">
                <li><strong>E-mail:</strong> dpo@tcponto.com</li>
              </ul>
            </section>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Importante:</strong> Esta política está em conformidade com a Lei Geral de 
                Proteção de Dados (LGPD - Lei 13.709/2018) e regulamentações aplicáveis de proteção 
                de dados pessoais no Brasil.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
