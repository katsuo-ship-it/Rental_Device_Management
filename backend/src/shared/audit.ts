import { getPool, sql } from './db';
import { AuthUser } from './auth';

/**
 * 操作履歴を audit_logs テーブルに記録する（ベストエフォート）
 * 失敗してもメイン処理には影響しない
 */
export async function logAudit(
  user: AuthUser,
  tableName: string,
  recordId: number,
  action: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request()
      .input('table_name', sql.NVarChar, tableName)
      .input('record_id', sql.Int, recordId)
      .input('action', sql.NVarChar, action)
      .input('user_oid', sql.NVarChar, user.oid)
      .input('user_name', sql.NVarChar, user.name)
      .input('user_email', sql.NVarChar, user.email)
      .input('details', sql.NVarChar, details ? JSON.stringify(details) : null)
      .query(`
        INSERT INTO audit_logs (table_name, record_id, action, user_oid, user_name, user_email, details)
        VALUES (@table_name, @record_id, @action, @user_oid, @user_name, @user_email, @details)
      `);
  } catch {
    // 監査ログの失敗はメイン処理に影響させない
  }
}
