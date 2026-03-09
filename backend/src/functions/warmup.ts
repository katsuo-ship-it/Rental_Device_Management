import { app, Timer, InvocationContext } from '@azure/functions';
import { getPool } from '../shared/db';

// 5分ごとに実行してコールドスタートを防ぐ
// Consumption プランはアイドル状態が続くとスリープするため、
// タイマーで定期的に DB 接続プールを維持する
async function warmup(_timer: Timer, ctx: InvocationContext): Promise<void> {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ping');
    ctx.log('[warmup] DB ping OK');
  } catch (err) {
    ctx.log('[warmup] DB ping failed:', err);
  }
}

// NCrontab: 秒 分 時 日 月 曜日
// 0 */5 * * * * = 毎時 0,5,10,15...分の0秒に実行
app.timer('warmup', {
  schedule: '0 */5 * * * *',
  runOnStartup: true,
  handler: warmup,
});
