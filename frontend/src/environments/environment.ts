export const environment = {
  production: false,
  apiBaseUrl:
    (typeof window !== 'undefined' && (window as any).__env?.apiBaseUrl) || 'http://localhost:3000',
};
