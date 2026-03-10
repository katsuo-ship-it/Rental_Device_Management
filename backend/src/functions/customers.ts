import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyToken, unauthorizedResponse } from '../shared/auth';
import { getPool, sql } from '../shared/db';

// GET /api/customers?q=検索キーワード
// dv_accounts テーブル（Azure SQL）から顧客を検索
async function searchCustomers(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const q = (req.query.get('q') || '').slice(0, 100);

  const pool = await getPool();
  const result = await pool.request()
    .input('q', sql.NVarChar(100), `%${q}%`)
    .query(`
      SELECT TOP 20
        accountid,
        name,
        telephone1,
        address1_city,
        address1_line1
      FROM [dv_accounts]
      WHERE name LIKE @q
      ORDER BY name ASC
    `);

  return { status: 200, jsonBody: result.recordset };
}

app.get('customers', { route: 'customers', handler: searchCustomers });
