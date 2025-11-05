import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

// Tratamento global de erros não capturados
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  
  // Se for erro de autenticação, redirecionar para página de erro de sessão
  if (event.error?.message?.includes('Auth session missing') || 
      event.error?.message?.includes('session')) {
    console.log('Auth error detected, redirecting to session error page');
    window.location.href = '/session-error';
  }
});

// Tratamento global de promises rejeitadas
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Se for erro de autenticação, redirecionar para página de erro de sessão
  if (event.reason?.message?.includes('Auth session missing') || 
      event.reason?.message?.includes('session')) {
    console.log('Auth promise rejection detected, redirecting to session error page');
    window.location.href = '/session-error';
  }
});

createRoot(document.getElementById("root")!).render(<App />);