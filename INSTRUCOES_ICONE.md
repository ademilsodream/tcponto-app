# Instruções para Substituir o Ícone do App

## 📱 APK Gerada com Sucesso!

A APK foi gerada com sucesso: **`TCPonto-GPS-Melhorado.apk`** (8.06 MB)

## 🎨 Como Substituir o Ícone

### 1. Preparar a Imagem
- Use a imagem que você forneceu (relógio + seta verde em fundo azul escuro)
- Salve como PNG com dimensões: **512x512 pixels**
- Nome do arquivo: `icon.png`

### 2. Substituir o Ícone
```bash
# Copiar a imagem para o diretório public
cp sua-imagem.png public/icon.png

# Sincronizar com Capacitor
npx cap sync

# Reconstruir a APK
npm run build
cd android && ./gradlew assembleRelease
cd .. && cp android/app/build/outputs/apk/release/app-release-unsigned.apk TCPonto-GPS-Melhorado-Com-Icone.apk
```

### 3. Locais onde o ícone é usado:
- `public/icon.png` - Ícone principal
- `android/app/src/main/res/mipmap-*` - Ícones Android (gerados automaticamente)
- `android/app/src/main/res/drawable-*` - Recursos Android

## 🚀 Melhorias Implementadas na APK

### Sistema de GPS Unificado:
- ✅ **Timeout otimizado**: 45s para APK (era muito agressivo)
- ✅ **Calibração persistente**: Salva por local por 3 dias
- ✅ **Detecção de mudança**: Detecta quando muda de local (>200m)
- ✅ **Range adaptativo**: Ajusta automaticamente baseado na precisão
- ✅ **Feedback visual**: Status claro (verde/azul/amarelo/vermelho)
- ✅ **Cache inteligente**: 30 segundos para evitar requisições desnecessárias

### Arquivos do Sistema Unificado:
- `src/utils/unifiedLocationSystem.ts` - Sistema principal
- `src/hooks/useUnifiedLocation.ts` - Hook unificado
- `src/components/UnifiedGPSStatus.tsx` - Status melhorado
- `src/components/UnifiedTimeRegistration.tsx` - Registro unificado

## 📋 Como Instalar

1. **Transferir APK** para o dispositivo Android
2. **Habilitar instalação** de fontes desconhecidas nas configurações
3. **Instalar APK** clicando no arquivo
4. **Conceder permissões** de localização quando solicitado

## 🔧 Configurações Recomendadas

### Para Melhor Performance:
- **GPS**: Ativo e com alta precisão
- **Localização**: Permissões sempre ativas
- **Bateria**: Modo de economia desativado para o app
- **Rede**: Conexão estável (WiFi ou dados móveis)

### Troubleshooting:
- Se GPS não funcionar: Vá para local aberto
- Se timeout: Aguarde 10-15 segundos
- Se precisão baixa: Use a calibração
- Se mudança não detectar: Sistema detecta >200m

## 📊 Informações da APK

- **Tamanho**: 8.06 MB
- **Versão**: Com sistema GPS unificado
- **Compatibilidade**: Android 5.0+ (API 21+)
- **Permissões**: Localização, Internet, Notificações
- **Plugins**: Geolocation, Push Notifications, Device

## 🎯 Próximos Passos

1. **Testar APK** em dispositivos reais
2. **Substituir ícone** com a imagem fornecida
3. **Gerar nova APK** com ícone personalizado
4. **Distribuir** para funcionários
5. **Monitorar** feedback e métricas

---

**APK pronta para uso!** 🎉
O sistema de GPS unificado deve resolver significativamente os problemas relatados pelos funcionários. 