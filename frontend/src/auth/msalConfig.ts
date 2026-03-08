import { Configuration, PopupRequest } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

// ログイン用スコープ（OpenID標準スコープ — 初回同意画面が自然になる）
export const loginRequest: PopupRequest = {
  scopes: ['openid', 'profile'],
};

// APIアクセス用スコープ
export const apiRequest: PopupRequest = {
  scopes: [`api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`],
};

// Dataverse アクセス用スコープ
export const dataverseRequest: PopupRequest = {
  scopes: [`${import.meta.env.VITE_DATAVERSE_URL}/.default`],
};
