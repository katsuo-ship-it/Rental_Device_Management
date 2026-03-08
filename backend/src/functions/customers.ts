import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyToken, unauthorizedResponse } from '../shared/auth';

const DATAVERSE_URL = process.env.DATAVERSE_URL || 'https://org5a73169f.crm7.dynamics.com';

// GET /api/customers?q=検索キーワード
// Dataverse の account エンティティから顧客を検索
// フロントエンドのアクセストークンを OBO (on-behalf-of) で Dataverse に転送
async function searchCustomers(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let user;
  try {
    user = await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const q = req.query.get('q') || '';

  // フロントエンドから送られた Dataverse スコープのトークンを使用
  const dataverseToken = req.headers.get('x-dataverse-token') || '';
  if (!dataverseToken) {
    return { status: 400, jsonBody: { error: 'Dataverse トークンが必要です' } };
  }

  // 入力サニタイズ: 長さ制限 + OData予約文字除去
  const sanitizedQ = q.slice(0, 100).replace(/[%&+?#]/g, '');
  // OData では シングルクォートを '' でエスケープ
  const odataSafeQ = sanitizedQ.replace(/'/g, "''");

  const filter = odataSafeQ
    ? `$filter=contains(name,'${encodeURIComponent(odataSafeQ)}')&`
    : '';

  const url = `${DATAVERSE_URL}/api/data/v9.2/accounts?${filter}$select=accountid,name,telephone1,address1_city,address1_line1&$top=20&$orderby=name asc`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${dataverseToken}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return { status: response.status, jsonBody: { error: 'Dataverse への接続に失敗しました' } };
  }

  const data = await response.json() as { value: unknown[] };
  return { status: 200, jsonBody: data.value };
}

app.get('customers', { route: 'customers', handler: searchCustomers });
