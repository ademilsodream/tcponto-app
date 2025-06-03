
# Manual do Sistema TCPonto

## Índice
1. [Visão Geral](#visão-geral)
2. [Perfis de Usuário](#perfis-de-usuário)
3. [Funcionalidades do Administrador](#funcionalidades-do-administrador)
4. [Funcionalidades do Funcionário](#funcionalidades-do-funcionário)
5. [Configurações do Sistema](#configurações-do-sistema)
6. [Relatórios](#relatórios)
7. [Segurança e Auditoria](#segurança-e-auditoria)
8. [Localização e GPS](#localização-e-gps)
9. [Banco de Horas](#banco-de-horas)
10. [Notificações](#notificações)
11. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O **TCPonto** é um sistema completo de controle de ponto eletrônico que permite o registro de horários com validação por GPS, gestão de funcionários, relatórios detalhados e auditoria completa. O sistema oferece diferentes interfaces para administradores e funcionários.

### Principais Características:
- ✅ Controle de ponto com validação GPS
- ✅ Gestão completa de funcionários
- ✅ Relatórios detalhados e exportação
- ✅ Sistema de banco de horas
- ✅ Auditoria completa de ações
- ✅ Notificações automáticas
- ✅ Interface responsiva (desktop e mobile)
- ✅ Solicitação de ajustes de horário
- ✅ Analytics avançados

---

## Perfis de Usuário

### 1. Administrador
- **Acesso total** ao sistema
- Gerencia funcionários
- Aprova/rejeita solicitações
- Visualiza todos os relatórios
- Configura o sistema
- Acessa logs de auditoria

### 2. Funcionário (User)
- Registra ponto
- Visualiza próprios horários
- Solicita ajustes
- Acessa relatórios pessoais
- Visualiza banco de horas

---

## Funcionalidades do Administrador

### 1. Dashboard Principal
**Localização:** Tela inicial após login como admin

**Funcionalidades:**
- 📊 **Estatísticas Gerais:**
  - Total de funcionários ativos
  - Registros de ponto hoje
  - Horas extras do mês
  - Alertas pendentes

- 📈 **Gráficos e Analytics:**
  - Frequência de registros
  - Distribuição de horas extras
  - Tendências mensais

- 🔔 **Alertas do Sistema:**
  - Registros incompletos
  - Horas extras excessivas
  - Funcionários ausentes

### 2. Gestão de Funcionários
**Localização:** Dashboard → Gerenciar Funcionários

**Como usar:**
1. **Adicionar Funcionário:**
   ```
   Botão "Adicionar Funcionário" → Preencher dados:
   - Nome completo
   - Email
   - Código do funcionário (opcional)
   - Valor hora normal
   - Valor hora extra
   - Departamento/Função
   ```

2. **Editar Funcionário:**
   ```
   Lista de funcionários → Ícone de editar → Modificar dados → Salvar
   ```

3. **Desativar/Reativar:**
   ```
   Lista de funcionários → Botão de status → Confirmar alteração
   ```

4. **Definir Jornada de Trabalho:**
   ```
   Editar funcionário → Aba "Jornada" → Definir horas diárias/semanais
   ```

### 3. Aprovação de Solicitações
**Localização:** Dashboard → Solicitações Pendentes

**Processo:**
1. **Visualizar Solicitações:**
   - Lista agrupada por funcionário/data
   - Detalhes da alteração solicitada
   - Motivo fornecido pelo funcionário

2. **Aprovar em Lote:**
   ```
   Selecionar grupo de alterações → Botão "Aprovar" → Confirmar
   ```

3. **Rejeitar:**
   ```
   Selecionar solicitação → Botão "Rejeitar" → Sistema notifica funcionário
   ```

### 4. Configurações Avançadas
**Localização:** Dashboard → Configurações

#### 4.1 Localizações Permitidas
```
Configurações → Localizações → Adicionar Nova:
- Nome da localização
- Endereço completo
- Coordenadas GPS
- Raio permitido (metros)
- Status (ativo/inativo)
```

#### 4.2 Banco de Horas
```
Configurações → Banco de Horas:
- Ativar/desativar sistema
- Limite máximo de horas acumuladas
- Validade das horas (meses)
- Jornada padrão
```

#### 4.3 Notificações
```
Configurações → Notificações:
- Registros incompletos
- Horas extras excessivas
- Relatórios automáticos
- Configurar emails
```

### 5. Relatórios Administrativos

#### 5.1 Relatório de Ponto Detalhado
**Localização:** Dashboard → Relatórios → Detalhamento de Ponto

**Como gerar:**
1. Selecionar período (data inicial e final)
2. Escolher funcionário específico ou "Todos"
3. Clicar "Gerar Relatório"

**Informações exibidas:**
- Horários de entrada/saída
- Intervalos de almoço
- Total de horas trabalhadas
- Horas extras
- Faltas e atrasos

#### 5.2 Relatório de Localização
**Localização:** Dashboard → Relatórios → Painel de Localização

**Funcionalidades:**
- Visualizar onde cada registro foi feito
- Validar conformidade com locais permitidos
- Detectar registros suspeitos
- Exportar dados de GPS

#### 5.3 Relatório de Folha de Pagamento
**Localização:** Dashboard → Relatórios → Folha de Pagamento

**Inclui:**
- Horas normais e extras por funcionário
- Cálculos de pagamento
- Resumo mensal/período
- Dados para processamento de folha

### 6. Auditoria e Logs
**Localização:** Dashboard → Configurações → Logs de Auditoria

**Informações registradas:**
- Todas as alterações no sistema
- Quem fez a alteração
- Quando foi feita
- Valores antes e depois
- IP de origem

---

## Funcionalidades do Funcionário

### 1. Registro de Ponto
**Localização:** Tela principal do funcionário

**Como usar:**
1. **Primeira vez no dia:**
   ```
   Tela inicial → Botão "Registrar" → Sistema valida GPS → Registra entrada
   ```

2. **Sequência completa:**
   ```
   Entrada → Saída para almoço → Volta do almoço → Saída final
   ```

3. **Validação automática:**
   - GPS deve estar dentro do raio permitido
   - Sistema mostra progresso visual
   - Confirmação imediata de registro

### 2. Visualização de Horários

#### 2.1 Resumo Mensal
**Localização:** Menu lateral → Resumo Mensal

**Informações:**
- Total de horas trabalhadas no mês
- Horas extras acumuladas
- Dias trabalhados vs. esperados
- Banco de horas atual

#### 2.2 Relatório Detalhado
**Localização:** Menu lateral → Relatório Detalhado

**Funcionalidades:**
- Visualizar horários dia a dia
- Exportar PDF dos registros
- Filtrar por período
- Ver status de aprovação

### 3. Solicitação de Ajustes
**Localização:** Durante registro de ponto ou no histórico

**Processo:**
1. **Identificar necessidade:**
   - Esqueceu de registrar ponto
   - Horário incorreto registrado
   - Problema técnico

2. **Fazer solicitação:**
   ```
   Registro específico → Botão "Solicitar Alteração" → 
   Preencher novo horário → Justificar motivo → Enviar
   ```

3. **Acompanhar status:**
   - Pendente (aguardando aprovação)
   - Aprovado (aplicado automaticamente)
   - Rejeitado (funcionário é notificado)

### 4. Registros Incompletos
**Localização:** Menu lateral → Registros Incompletos

**Funcionalidade:**
- Lista dias com registros faltando
- Permite solicitar inclusão
- Mostra quais horários estão pendentes

### 5. Ajuste de Dias Anteriores
**Localização:** Menu lateral → Ajustar Dias Anteriores

**Uso:**
- Corrigir registros dos últimos dias
- Incluir horários esquecidos
- Justificar alterações necessárias

---

## Configurações do Sistema

### 1. Configurações Globais

#### 1.1 Jornada de Trabalho
```
Configuração: 8 horas diárias padrão
Personalizável por funcionário
Tolerância: 15 minutos (configurável)
```

#### 1.2 Cálculo de Horas Extras
```
Regra: Após 8 horas diárias
Valor: Configurável por funcionário
Multiplicador padrão: 1.5x valor normal
```

#### 1.3 Validação GPS
```
Raio padrão: 100 metros
Configurável por localização
Timeout: 10 segundos para obter GPS
Precisão mínima requerida
```

### 2. Localizações Permitidas

#### 2.1 Cadastro de Locais
**Campos obrigatórios:**
- Nome identificador
- Endereço completo
- Latitude/Longitude
- Raio de tolerância
- Status ativo/inativo

#### 2.2 Gestão de Locais
- **Ativar/Desativar:** Temporariamente
- **Editar:** Modificar raio ou endereço
- **Histórico:** Ver registros por local

### 3. Banco de Horas

#### 3.1 Configurações
```
Status: Ativado/Desativado
Limite máximo: 40 horas (padrão)
Validade: 6 meses (padrão)
Compensação automática: Configurável
```

#### 3.2 Funcionamento
- **Acúmulo:** Horas extras → Banco de horas
- **Desconto:** Faltas → Redução do banco
- **Expiração:** Automática após validade
- **Relatórios:** Saldo por funcionário

---

## Relatórios

### 1. Tipos de Relatórios

#### 1.1 Relatório de Frequência
- **Objetivo:** Controle de presença
- **Dados:** Faltas, atrasos, saídas antecipadas
- **Período:** Mensal/Customizado
- **Exportação:** PDF, Excel

#### 1.2 Relatório de Horas Extras
- **Objetivo:** Controle de sobrejornada
- **Dados:** Horas extras por funcionário/período
- **Alertas:** Excesso de horas extras
- **Cálculos:** Valores financeiros

#### 1.3 Relatório de Localização
- **Objetivo:** Validação geográfica
- **Dados:** GPS de cada registro
- **Verificação:** Conformidade com locais permitidos
- **Segurança:** Detecção de irregularidades

### 2. Exportação de Dados

#### 2.1 Formatos Disponíveis
- **PDF:** Relatórios formatados
- **Excel:** Dados para análise
- **CSV:** Integração com outros sistemas
- **JSON:** API/Integrações técnicas

#### 2.2 Agendamento Automático
```
Configuração: Relatórios automáticos
Frequência: Diário/Semanal/Mensal
Destinatários: Emails configurados
Tipos: Personalizáveis
```

---

## Segurança e Auditoria

### 1. Sistema de Auditoria

#### 1.1 Eventos Registrados
- **Autenticação:** Login/Logout
- **Registros:** Criação/Edição de pontos
- **Aprovações:** Decisões administrativas
- **Configurações:** Mudanças no sistema
- **Usuários:** Criação/Edição/Desativação

#### 1.2 Informações de Auditoria
```
Timestamp: Data/hora exata
Usuário: Quem executou a ação
IP Address: Origem da ação
Dados anteriores: Estado antes da mudança
Dados novos: Estado após a mudança
Justificativa: Motivo da alteração
```

### 2. Controles de Segurança

#### 2.1 Autenticação
- **Login seguro:** Email + senha
- **Sessões:** Controle de expiração
- **Força da senha:** Regras configuráveis
- **Bloqueio:** Após tentativas falhas

#### 2.2 Autorização
- **Perfis:** Admin vs. User
- **Permissões:** Granulares por função
- **Isolamento:** Dados por usuário
- **Validação:** Em tempo real

#### 2.3 Integridade dos Dados
- **Triggers:** Validação automática
- **Checksums:** Verificação de integridade
- **Backup:** Automático e regular
- **Restauração:** Procedimentos definidos

### 3. Monitoramento

#### 3.1 Alertas de Segurança
- **Tentativas de fraude:** GPS inválido
- **Acessos suspeitos:** Fora do horário
- **Mudanças críticas:** Dados de pagamento
- **Falhas de sistema:** Erros técnicos

#### 3.2 Relatórios de Segurança
- **Logs de acesso:** Quem acessou quando
- **Mudanças de dados:** Histórico completo
- **Tentativas de violação:** Detecção
- **Conformidade:** Relatórios regulatórios

---

## Localização e GPS

### 1. Configuração GPS

#### 1.1 Precisão Requerida
```
Precisão mínima: 10 metros
Timeout máximo: 10 segundos
Tentativas: 3 máximo
Fallback: Solicitação manual se falha
```

#### 1.2 Validação de Localização
- **Raio permitido:** Configurável por local
- **Múltiplos locais:** Funcionário pode ter vários
- **Exceções:** Aprovação manual para casos especiais
- **Histórico:** Todas as localizações são salvas

### 2. Gestão de Locais de Trabalho

#### 2.1 Cadastro
```
Processo:
1. Obter coordenadas GPS do local
2. Definir raio de tolerância
3. Nomear e descrever o local
4. Ativar para uso
5. Associar funcionários (se necessário)
```

#### 2.2 Monitoramento
- **Registros por local:** Quem registrou onde
- **Frequência de uso:** Estatísticas por local
- **Problemas GPS:** Falhas de validação
- **Ajustes necessários:** Raio muito pequeno/grande

### 3. Casos Especiais

#### 3.1 Trabalho Externo
- **Configuração:** Locais temporários
- **Aprovação:** Prévia do administrador
- **Validação:** Posterior com justificativa
- **Controle:** Rastreamento especial

#### 3.2 Falhas de GPS
- **Registro manual:** Com justificativa
- **Aprovação:** Automática ou manual
- **Alertas:** Para administrador
- **Investigação:** Se padrão suspeito

---

## Banco de Horas

### 1. Funcionamento do Sistema

#### 1.1 Acúmulo de Horas
```
Regra: Horas trabalhadas > Jornada diária
Exemplo: 
- Jornada: 8h
- Trabalhado: 9h30
- Banco: +1h30
```

#### 1.2 Compensação
```
Regra: Horas trabalhadas < Jornada diária
Exemplo:
- Jornada: 8h
- Trabalhado: 6h30
- Banco: -1h30 (se tiver saldo)
```

#### 1.3 Limites e Validade
- **Limite máximo:** 40 horas (configurável)
- **Validade:** 6 meses (configurável)
- **Expiração:** Automática das horas antigas
- **Notificação:** Antes da expiração

### 2. Gestão Administrativa

#### 2.1 Monitoramento
```
Dashborad → Banco de Horas:
- Saldo por funcionário
- Tendências de acúmulo
- Expiração próxima
- Uso de compensação
```

#### 2.2 Ajustes Manuais
- **Créditos:** Adicionar horas especiais
- **Débitos:** Descontar por faltas
- **Correções:** Ajustar erros de cálculo
- **Justificativas:** Obrigatórias para mudanças

### 3. Relatórios de Banco de Horas

#### 3.1 Relatório Individual
- **Saldo atual:** Horas disponíveis
- **Histórico:** Transações do período
- **Expiração:** Horas que vencerão
- **Projeção:** Tendência futura

#### 3.2 Relatório Geral
- **Resumo:** Todos os funcionários
- **Estatísticas:** Médias e totais
- **Alertas:** Situações que requerem atenção
- **Exportação:** Para folha de pagamento

---

## Notificações

### 1. Tipos de Notificações

#### 1.1 Para Funcionários
- **Aprovação:** Solicitações aprovadas/rejeitadas
- **Lembrete:** Registros incompletos
- **Banco de horas:** Saldo baixo/expiração
- **Sistema:** Manutenções programadas

#### 1.2 Para Administradores
- **Solicitações:** Novas pendentes
- **Alertas:** Horas extras excessivas
- **Faltas:** Funcionários ausentes
- **Sistema:** Problemas técnicos

### 2. Configuração de Notificações

#### 2.1 Canais
- **In-app:** Notificações no sistema
- **Email:** Automático configurável
- **Dashboard:** Alertas visuais
- **Relatórios:** Inclusão automática

#### 2.2 Frequência
```
Imediato: Eventos críticos
Diário: Resumos e lembretes
Semanal: Relatórios periódicos
Mensal: Consolidações
```

### 3. Gestão de Preferências

#### 3.1 Por Usuário
- **Tipos:** Quais notificações receber
- **Horários:** Quando podem ser enviadas
- **Canais:** Email, sistema, etc.
- **Frequência:** Personalizada

#### 3.2 Globais
- **Administradores:** Configurações padrão
- **Templates:** Modelos de mensagens
- **Filtros:** Evitar spam de notificações
- **Logs:** Histórico de envios

---

## Troubleshooting

### 1. Problemas Comuns de GPS

#### 1.1 "GPS não encontrado"
**Causas possíveis:**
- GPS desabilitado no dispositivo
- Localização em área fechada
- Problemas de conectividade

**Soluções:**
1. Verificar permissões de localização
2. Ir para área externa
3. Aguardar alguns segundos
4. Usar solicitação manual se persistir

#### 1.2 "Localização não autorizada"
**Causas possíveis:**
- Fora do raio permitido
- Coordenadas incorretas cadastradas
- GPS impreciso

**Soluções:**
1. Verificar se está no local correto
2. Aguardar GPS estabilizar
3. Contatar administrador para verificar configurações
4. Solicitar ajuste manual

### 2. Problemas de Login

#### 2.1 "Email ou senha incorretos"
**Soluções:**
1. Verificar se email está correto
2. Tentar resetar senha
3. Verificar se conta está ativa
4. Contatar administrador

#### 2.2 "Sessão expirada"
**Soluções:**
1. Fazer login novamente
2. Verificar conexão com internet
3. Limpar cache do navegador

### 3. Problemas de Registros

#### 3.1 "Horário não registrado"
**Diagnóstico:**
1. Verificar logs de auditoria
2. Conferir conexão no momento
3. Validar GPS estava funcionando

**Soluções:**
1. Solicitar inclusão manual
2. Verificar relatórios para confirmar
3. Ajustar configurações se necessário

#### 3.2 "Cálculos incorretos"
**Verificações:**
1. Conferir horários registrados
2. Validar configurações de jornada
3. Verificar regras de hora extra

**Soluções:**
1. Recalcular através do sistema
2. Ajustar configurações se necessário
3. Fazer correção manual se confirmado erro

### 4. Performance do Sistema

#### 4.1 "Sistema lento"
**Verificações:**
1. Conexão com internet
2. Número de registros carregados
3. Filtros aplicados nos relatórios

**Soluções:**
1. Usar filtros mais específicos
2. Limitar período dos relatórios
3. Verificar se há manutenção

#### 4.2 "Erro ao carregar dados"
**Soluções:**
1. Atualizar página
2. Verificar conexão
3. Tentar novamente após alguns minutos
4. Contatar suporte se persistir

### 5. Suporte e Contato

#### 5.1 Níveis de Suporte
- **Nível 1:** Problemas básicos de uso
- **Nível 2:** Configurações e ajustes
- **Nível 3:** Problemas técnicos complexos

#### 5.2 Informações para Suporte
Ao solicitar ajuda, forneça:
- Data/hora do problema
- Mensagem de erro exata
- Passos que levaram ao problema
- Tipo de dispositivo/navegador
- Usuário afetado

---

## Resumo de Funcionalidades por Perfil

### Administrador
✅ Dashboard completo com analytics  
✅ Gestão de funcionários (CRUD completo)  
✅ Configuração de localizações permitidas  
✅ Aprovação/rejeição de solicitações  
✅ Todos os tipos de relatórios  
✅ Configurações do sistema  
✅ Logs de auditoria  
✅ Gestão de banco de horas  
✅ Configuração de notificações  
✅ Analytics avançados  

### Funcionário
✅ Registro de ponto com GPS  
✅ Visualização de horários próprios  
✅ Solicitação de ajustes  
✅ Relatórios pessoais  
✅ Consulta de banco de horas  
✅ Histórico de registros  
✅ Notificações pessoais  

---

Este manual cobre todas as funcionalidades do sistema TCPonto. Para dúvidas específicas ou problemas técnicos, consulte a seção de Troubleshooting ou entre em contato com o suporte técnico.
