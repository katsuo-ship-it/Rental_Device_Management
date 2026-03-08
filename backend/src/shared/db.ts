import sql from 'mssql';

if (!process.env.DB_SERVER) {
  throw new Error('[db] 必須環境変数が未設定です: DB_SERVER を設定してください');
}

const config: sql.config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME || 'rental_management',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  // 切断済みまたは未接続の場合は新しいプールを作成
  if (pool) {
    try { await pool.close(); } catch { /* 無視 */ }
    pool = null;
  }
  pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', () => { pool = null; });
  return pool;
}

export { sql };
