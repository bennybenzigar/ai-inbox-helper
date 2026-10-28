export const environment = {
  production: true,
  apiBaseUrl:
    (typeof window !== 'undefined' && (window as any).__env?.apiBaseUrl) ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:3000'),
};
