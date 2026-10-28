export const environment = {
  production: true,
  apiBaseUrl:
    (typeof window !== 'undefined' && (window as any).__env?.apiBaseUrl) ||
    'https://ai-inbox-backend.onrender.com',
};
