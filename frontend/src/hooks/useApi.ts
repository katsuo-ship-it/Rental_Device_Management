import { useMsal } from '@azure/msal-react';
import { apiRequest, dataverseRequest } from '../auth/msalConfig';

export function useApi() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  async function getToken(): Promise<string> {
    const result = await instance.acquireTokenSilent({
      ...apiRequest,
      account,
    }).catch(() => instance.acquireTokenPopup({ ...apiRequest, account }));
    return result.accessToken;
  }

  async function getDataverseToken(): Promise<string> {
    const result = await instance.acquireTokenSilent({
      ...dataverseRequest,
      account,
    }).catch(() => instance.acquireTokenPopup({ ...dataverseRequest, account }));
    return result.accessToken;
  }

  async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getToken();
    const res = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'APIエラー');
    }
    return res.json();
  }

  async function apiFetchWithDataverse<T>(path: string): Promise<T> {
    const [token, dvToken] = await Promise.all([getToken(), getDataverseToken()]);
    const res = await fetch(`/api${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-dataverse-token': dvToken,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'APIエラー');
    }
    return res.json();
  }

  async function downloadFile(path: string, filename: string) {
    const token = await getToken();
    const res = await fetch(`/api${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: file,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'アップロードエラー');
    }
    return res.json();
  }

  return { apiFetch, apiFetchWithDataverse, downloadFile, uploadFile };
}
