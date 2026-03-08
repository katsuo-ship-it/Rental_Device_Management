import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, sql } from '../shared/db';
import { verifyToken, unauthorizedResponse } from '../shared/auth';

// GET /api/audit?table=rental_contracts&record_id=123&limit=100
async function getAuditLogs(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const tableName = req.query.get('table') || '';
  const recordIdStr = req.query.get('record_id');
  const recordId = recordIdStr ? parseInt(recordIdStr) : null;
  const limit = Math.min(parseInt(req.query.get('limit') || '200'), 500);

  const pool = await getPool();
  const request = pool.request();
  let query = `SELECT TOP ${limit} * FROM audit_logs WHERE 1=1`;

  if (tableName) {
    query += ' AND table_name = @table_name';
    request.input('table_name', sql.NVarChar, tableName);
  }
  if (recordId != null && !isNaN(recordId)) {
    query += ' AND record_id = @record_id';
    request.input('record_id', sql.Int, recordId);
  }

  query += ' ORDER BY created_at DESC';
  const result = await request.query(query);
  return { status: 200, jsonBody: result.recordset };
}

app.get('auditLogs', { route: 'audit', handler: getAuditLogs });
