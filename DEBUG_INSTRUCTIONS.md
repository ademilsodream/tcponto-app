# 🔧 Instruções de Debug - TCPonto

## 📱 Como Ativar o Debug no App

Para capturar logs de erro e diagnosticar problemas de autenticação:

### 1. Ativar o Painel de Debug

1. **Instale a nova APK**: `TCPonto-v3.2-fixed.apk`
2. **Abra o app** no dispositivo Android
3. **Abra o console do navegador** (se estiver usando web) ou **ative o debug**:
   - Vá para Configurações do Android > Opções do desenvolvedor
   - Ative "Depuração USB"
   - Conecte o dispositivo ao computador
   - Use `adb logcat` para ver logs

### 2. Ativar Debug via LocalStorage

1. **Abra o app** no dispositivo
2. **Abra o console do navegador** (se possível)
3. **Execute o comando**:
   ```javascript
   localStorage.setItem('tcponto_show_debug', 'true')
   ```
4. **Recarregue o app** - o painel de debug aparecerá no canto inferior direito

### 3. Capturar Logs de Erro

O painel de debug mostrará:
- ✅ **Logs de INFO**: Operações normais
- ⚠️ **Logs de WARN**: Avisos
- ❌ **Logs de ERROR**: Erros críticos
- 🔍 **Logs de DEBUG**: Informações detalhadas

### 4. Exportar Logs

1. **Toque no ícone de download** no painel de debug
2. **Os logs serão salvos** como arquivo `.log`
3. **Compartilhe o arquivo** para análise

## 🐛 Problemas Comuns e Soluções

### Problema: App não faz login
**Possíveis causas:**
- Sem conectividade com o servidor
- Credenciais incorretas
- Problema de autenticação no Supabase

**Solução:**
1. Verifique a conectividade da internet
2. Confirme as credenciais
3. Verifique os logs de erro no painel de debug

### Problema: App crash na inicialização
**Possíveis causas:**
- Erro de JavaScript
- Problema de configuração do Capacitor
- Erro de autenticação

**Solução:**
1. Ative o painel de debug
2. Verifique os logs de erro
3. Reinstale o app se necessário

### Problema: Erro de autenticação
**Possíveis causas:**
- Token expirado
- Problema de sessão
- Erro de rede

**Solução:**
1. Faça logout e login novamente
2. Verifique a conectividade
3. Limpe o cache do app

## 📋 Comandos Úteis

### Verificar Logs via ADB
```bash
adb logcat | grep -i tcponto
```

### Limpar Cache do App
```bash
adb shell pm clear com.tcponto.app
```

### Reinstalar App
```bash
adb uninstall com.tcponto.app
adb install TCPonto-v3.2-fixed.apk
```

## 🔍 Informações de Debug

### Versão do App
- **APK**: TCPonto-v3.2-fixed.apk
- **Build**: 12/08/2024
- **Debug**: Ativado

### Configurações de Rede
- **Supabase URL**: https://cyapqtyrefkdemhxryvs.supabase.co
- **Timeout**: 30 segundos
- **Retry**: 3 tentativas

### Recursos de Debug
- ✅ Sistema de logs detalhado
- ✅ Painel de debug visual
- ✅ Exportação de logs
- ✅ Verificação de conectividade
- ✅ Cliente Supabase otimizado para mobile

---
**Para suporte técnico, compartilhe os logs de erro capturados.**
