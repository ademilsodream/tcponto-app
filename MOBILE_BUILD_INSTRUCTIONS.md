
# Instruções para Gerar APK - TCPonto

## Pré-requisitos
- Node.js instalado
- Android Studio instalado
- Java JDK 11 ou superior
- Git

## Passos para Gerar o APK

### 1. Preparar o Projeto
```bash
# Clone o projeto do GitHub (após exportar)
git clone [SEU_REPOSITORIO]
cd [NOME_DO_PROJETO]

# Instalar dependências
npm install
```

### 2. Adicionar Plataforma Android
```bash
# Adicionar plataforma Android
npx cap add android

# Atualizar dependências nativas
npx cap update android
```

### 3. Build de Produção
```bash
# Gerar build otimizado
npm run build

# Sincronizar com plataforma nativa
npx cap sync android
```

### 4. Abrir no Android Studio
```bash
# Abrir projeto no Android Studio
npx cap open android
```

### 5. Gerar APK no Android Studio
1. No Android Studio, vá em: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Aguarde a compilação terminar
3. O APK será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Para APK de Produção (Google Play)
1. Vá em: **Build > Generate Signed Bundle / APK**
2. Selecione **APK**
3. Crie ou selecione seu keystore
4. Configure as informações de assinatura
5. Selecione **release** como build variant
6. Clique em **Finish**

## Comandos Úteis

```bash
# Executar no emulador/dispositivo
npx cap run android

# Sincronizar após mudanças no código
npm run build && npx cap sync android

# Ver logs do dispositivo
npx cap run android --livereload --external
```

## Configurações Importantes

### Ícones do App
- Substitua os ícones em `android/app/src/main/res/mipmap-*/`
- Use diferentes resoluções: 48x48, 72x72, 96x96, 144x144, 192x192

### Splash Screen
- Configure em `android/app/src/main/res/drawable/splash.xml`
- Adicione imagens em `android/app/src/main/res/drawable-*/`

### Permissões
- Edite `android/app/src/main/AndroidManifest.xml` para adicionar permissões necessárias

## Publicação na Google Play Store

1. **Criar conta de desenvolvedor** na Google Play Console
2. **Gerar APK assinado** (release)
3. **Testar o APK** em diferentes dispositivos
4. **Fazer upload** na Google Play Console
5. **Preencher informações** da loja (descrição, screenshots, etc.)
6. **Enviar para revisão**

## Troubleshooting

### Erro de Build
- Limpe o cache: `npx cap clean android`
- Reconstrua: `npm run build && npx cap sync android`

### Erro de Sincronização
- Verifique se o build foi gerado: pasta `dist/` deve existir
- Execute `npx cap doctor` para diagnóstico

### Erro no Android Studio
- Verifique se o Android SDK está atualizado
- Sincronize o projeto Gradle: **File > Sync Project with Gradle Files**
