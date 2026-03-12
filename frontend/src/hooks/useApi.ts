import { useMsal } from '@azure/msal-react';
import { apiRequest, dataverseRequest } from '../auth/msalConfig';

// 本番: VITE_API_BASE_URL = Azure Functions の URL (例: https://rental-func-xxx.azurewebsites.net)
// 開発: 未設定 → vite.config.ts のプロキシが /api/* を localhost:7071 に転送
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useApi() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  async function getToken(forceRefresh = false): Promise<string> {
    const result = await instance.acquireTokenSilent({
      ...apiRequest,
      account,
      forceRefresh,
    }).catch(() => instance.acquireTokenPopup({ ...apiRequest, account }));
    return result.accessToken;
  }

  async function getDataverseToken(forceRefresh = false): Promise<string> {
    const result = await instance.acquireTokenSilent({
      ...dataverseRequest,
      account,
      forceRefresh,
    }).catch(() => instance.acquireTokenPopup({ ...dataverseRequest, account }));
    return result.accessToken;
  }

  async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    // 401の場合、トークンを強制更新してリトライ
    if (res.status === 401) {
      const freshToken = await getToken(true);
      const retry = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
          ...(options.headers || {}),
        },
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ error: retry.statusText }));
        throw new Error(err.error || 'APIエラー');
      }
      return retry.json();
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'APIエラー');
    }
    return res.json();
  }

  async function apiFetchWithDataverse<T>(path: string): Promise<T> {
    const [token, dvToken] = await Promise.all([getToken(), getDataverseToken()]);
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-dataverse-token': dvToken,
      },
    });

    // 401の場合、両トークンを強制更新してリトライ
    if (res.status === 401) {
      const [freshToken, freshDvToken] = await Promise.all([getToken(true), getDataverseToken(true)]);
      const retry = await fetch(`${API_BASE}/api${path}`, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'x-dataverse-token': freshDvToken,
        },
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ error: retry.statusText }));
        throw new Error(err.error || 'APIエラー');
      }
      return retry.json();
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'APIエラー');
    }
    return res.json();
  }

  async function downloadFile(path: string, filename: string) {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 401の場合、トークンを強制更新してリトライ
    if (res.status === 401) {
      const freshToken = await getToken(true);
      const retry = await fetch(`${API_BASE}/api${path}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      if (!retry.ok) throw new Error('ダウンロードに失敗しました');
      const blob = await retry.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!res.ok) throw new Error('ダウンロードに失敗しました');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadFile<T>(path: string, file: File): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: file,
    });

    // 401の場合、トークンを強制更新してリトライ
    if (res.status === 401) {
      const freshToken = await getToken(true);
      const retry = await fetch(`${API_BASE}/api${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        body: file,
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ error: retry.statusText }));
        throw new Error(err.error || 'アップロードエラー');
      }
      return retry.json();
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'アップロードエラー');
    }
    return res.json();
  }

  return { apiFetch, apiFetchWithDataverse, downloadFile, uploadFile };
}
