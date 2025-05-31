
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Sistema de logging global para debugging
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
  
  // Se for erro de auth, tentar recuperar
  const errorMessage = event.reason?.message?.toLowerCase() || '';
  if (errorMessage.includes('jwt') || 
      errorMessage.includes('unauthorized') || 
      errorMessage.includes('invalid_token')) {
    console.log('Main: Erro de auth global detectado, recarregando página...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
});

// Monitoramento de performance
const startTime = performance.now();

createRoot(document.getElementById("root")!).render(
  <App />
);

// Log de tempo de inicialização
setTimeout(() => {
  const loadTime = performance.now() - startTime;
  console.log(`Sistema inicializado em ${loadTime.toFixed(2)}ms`);
}, 100);
