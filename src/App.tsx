import React, { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';

function App() {
  useEffect(() => {
    // Solicita permissão para push
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        PushNotifications.register();
      }
    });

    // Sucesso no registro
    PushNotifications.addListener('registration', token => {
      console.log('Push registration success, token: ' + token.value);
      // Aqui você pode enviar o token para seu backend, se quiser
    });

    // Erro no registro
    PushNotifications.addListener('registrationError', err => {
      console.error('Push registration error: ', err.error);
    });

    // Notificação recebida em foreground
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('Push received: ', notification);
    });

    // Ação do usuário na notificação
    PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.log('Push action performed: ', notification);
    });
  }, []);

  return (
    <div style={{ padding: 40, fontSize: 24 }}>
      <b>TCPonto Teste</b>
      <div style={{ marginTop: 20, color: 'green' }}>Se você vê esta tela, o app está funcionando!</div>
    </div>
  );
}

export default App;
