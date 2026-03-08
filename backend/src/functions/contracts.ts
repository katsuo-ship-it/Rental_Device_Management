import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, sql } from '../shared/db';
import { verifyToken, unauthorizedResponse } from '../shared/auth';

// GET /api/contracts
async function listContracts(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const status = req.query.get('status') || 'active';
  const pool = await getPool();

  const result = await pool.request()
    .input('status', sql.NVarChar, status)
    .query(`
      SELECT TOP 500
        rc.*,
        d.model_name, d.color, d.capacity, d.imei, d.management_no, d.device_type,
        DATEDIFF(day, GETDATE(), rc.contract_end_date) AS days_until_end,
        (SELECT SUM(repair_cost) FROM repairs WHERE contract_id = rc.id) AS total_repair_cost
      FROM rental_contracts rc
      JOIN devices d ON d.id = rc.device_id
      WHERE rc.status = @status
      ORDER BY rc.contract_end_date ASC
    `);

  return { status: 200, jsonBody: result.recordset };
}

// GET /api/contracts/:id
async function getContract(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const id = parseInt(req.params.id);
  const pool = await getPool();

  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT
        rc.*,
        d.model_name, d.color, d.capacity, d.imei, d.management_no, d.device_type,
        DATEDIFF(day, GETDATE(), rc.contract_end_date) AS days_until_end,
        (SELECT SUM(repair_cost) FROM repairs WHERE contract_id = rc.id) AS total_repair_cost
      FROM rental_contracts rc
      JOIN devices d ON d.id = rc.device_id
      WHERE rc.id = @id
    `);

  if (result.recordset.length === 0) {
    return { status: 404, jsonBody: { error: '契約が見つかりません' } };
  }

  return { status: 200, jsonBody: result.recordset[0] };
}

// POST /api/contracts
async function createContract(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const body = await req.json() as Record<string, unknown>;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // 端末のステータスを 'renting' に変更
    const deviceCheck = await new sql.Request(transaction)
      .input('device_id', sql.Int, body.device_id as number)
      .query(`SELECT status FROM devices WHERE id = @device_id`);

    if (deviceCheck.recordset.length === 0) {
      await transaction.rollback();
      return { status: 404, jsonBody: { error: '端末が見つかりません' } };
    }
    const deviceStatus = deviceCheck.recordset[0].status;
    if (deviceStatus === 'renting' || deviceStatus === 'sold') {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: 'この端末は現在レンタルまたは販売済みです' } };
    }

    // 必須フィールドのバリデーション
    if (!body.customer_name || typeof body.customer_name !== 'string' || !(body.customer_name as string).trim()) {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: 'お客様名は必須です' } };
    }
    if (!body.monthly_wholesale_price || !body.monthly_end_user_price) {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: '月額卸価格と月額エンドユーザー価格は必須です' } };
    }

    // 契約日付の前後関係チェック
    const startDate = new Date(body.contract_start_date as string);
    const endDate = new Date(body.contract_end_date as string);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: '日付の形式が正しくありません' } };
    }
    if (endDate <= startDate) {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: '契約終了日は契約開始日より後の日付を指定してください' } };
    }

    const result = await new sql.Request(transaction)
      .input('device_id', sql.Int, body.device_id as number)
      .input('customer_dataverse_id', sql.NVarChar, body.customer_dataverse_id as string)
      .input('customer_name', sql.NVarChar, body.customer_name as string)
      .input('customer_phone', sql.NVarChar, body.customer_phone as string)
      .input('delivery_name', sql.NVarChar, body.delivery_name as string)
      .input('delivery_address', sql.NVarChar, body.delivery_address as string)
      .input('delivery_phone', sql.NVarChar, body.delivery_phone as string)
      .input('contract_start_date', sql.Date, body.contract_start_date as string)
      .input('billing_start_date', sql.Date, body.billing_start_date as string)
      .input('contract_end_date', sql.Date, body.contract_end_date as string)
      .input('contract_months', sql.Int, body.contract_months as number)
      .input('auto_renewal', sql.Bit, body.auto_renewal ? 1 : 0)
      .input('min_contract_months', sql.Int, body.min_contract_months as number)
      .input('monthly_wholesale_price', sql.Decimal(12, 2), body.monthly_wholesale_price as number)
      .input('monthly_end_user_price', sql.Decimal(12, 2), body.monthly_end_user_price as number)
      .input('natural_failure_coverage', sql.Bit, body.natural_failure_coverage ? 1 : 0)
      .input('op_coverage', sql.Bit, body.op_coverage ? 1 : 0)
      .input('op_coverage_details', sql.NVarChar, body.op_coverage_details as string)
      .input('op_coverage_price', sql.Decimal(12, 2), body.op_coverage_price as number)
      .input('notes', sql.NVarChar, body.notes as string)
      .query(`
        INSERT INTO rental_contracts (
          device_id, customer_dataverse_id, customer_name, customer_phone,
          delivery_name, delivery_address, delivery_phone,
          contract_start_date, billing_start_date, contract_end_date, contract_months,
          auto_renewal, min_contract_months, monthly_wholesale_price, monthly_end_user_price,
          natural_failure_coverage, op_coverage, op_coverage_details, op_coverage_price, notes
        )
        OUTPUT INSERTED.id
        VALUES (
          @device_id, @customer_dataverse_id, @customer_name, @customer_phone,
          @delivery_name, @delivery_address, @delivery_phone,
          @contract_start_date, @billing_start_date, @contract_end_date, @contract_months,
          @auto_renewal, @min_contract_months, @monthly_wholesale_price, @monthly_end_user_price,
          @natural_failure_coverage, @op_coverage, @op_coverage_details, @op_coverage_price, @notes
        )
      `);

    await new sql.Request(transaction)
      .input('device_id', sql.Int, body.device_id as number)
      .query(`UPDATE devices SET status = 'renting' WHERE id = @device_id`);

    await transaction.commit();
    return { status: 201, jsonBody: { id: result.recordset[0].id, message: 'レンタル契約を登録しました' } };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// POST /api/contracts/:id/return
async function returnContract(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const id = req.params.id;
  const body = await req.json() as Record<string, unknown>;
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const contractResult = await new sql.Request(transaction)
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT device_id, status FROM rental_contracts WHERE id = @id`);

    if (contractResult.recordset.length === 0) {
      await transaction.rollback();
      return { status: 404, jsonBody: { error: '契約が見つかりません' } };
    }
    if (contractResult.recordset[0].status !== 'active') {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: 'この契約はすでに返却済みまたはキャンセルされています' } };
    }

    const deviceId = contractResult.recordset[0].device_id;

    // 返却記録
    await new sql.Request(transaction)
      .input('contract_id', sql.Int, parseInt(id))
      .input('device_id', sql.Int, deviceId)
      .input('return_date', sql.Date, body.return_date as string)
      .input('condition_ok', sql.Bit, body.condition_ok !== false ? 1 : 0)
      .input('condition_notes', sql.NVarChar, body.condition_notes as string)
      .query(`
        INSERT INTO returns (contract_id, device_id, return_date, condition_ok, condition_notes)
        VALUES (@contract_id, @device_id, @return_date, @condition_ok, @condition_notes)
      `);

    // 修理費があれば記録
    if (body.repair_cost && (body.repair_cost as number) > 0) {
      await new sql.Request(transaction)
        .input('contract_id', sql.Int, parseInt(id))
        .input('device_id', sql.Int, deviceId)
        .input('repair_date', sql.Date, body.return_date as string)
        .input('repair_cost', sql.Decimal(12, 2), body.repair_cost as number)
        .input('description', sql.NVarChar, body.repair_description as string)
        .query(`
          INSERT INTO repairs (contract_id, device_id, repair_date, repair_cost, description)
          VALUES (@contract_id, @device_id, @repair_date, @repair_cost, @description)
        `);
    }

    // 契約ステータスを 'returned' に
    await new sql.Request(transaction)
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE rental_contracts SET status = 'returned' WHERE id = @id`);

    // 端末を在庫に戻す
    await new sql.Request(transaction)
      .input('device_id', sql.Int, deviceId)
      .query(`UPDATE devices SET status = 'in_stock' WHERE id = @device_id`);

    await transaction.commit();
    return { status: 200, jsonBody: { message: '返却処理が完了しました' } };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// GET /api/alerts
async function getAlerts(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      rc.id, rc.device_id, rc.customer_name, rc.contract_end_date,
      d.model_name, d.color, d.capacity, d.management_no,
      DATEDIFF(day, GETDATE(), rc.contract_end_date) AS days_until_end
    FROM rental_contracts rc
    JOIN devices d ON d.id = rc.device_id
    WHERE rc.status = 'active'
      AND rc.contract_end_date BETWEEN GETDATE() AND DATEADD(day, 60, GETDATE())
    ORDER BY rc.contract_end_date ASC
  `);

  return { status: 200, jsonBody: result.recordset };
}

// GET /api/alerts/internal — Logic Apps専用（Functions Key認証のみ、JWT不要）
async function getAlertsInternal(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  // Logic AppsはEntra IDトークンを持てないため、Functions Keyのみで認証する専用エンドポイント
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      rc.id, rc.customer_name, rc.contract_end_date,
      d.model_name, d.color, d.capacity, d.management_no,
      DATEDIFF(day, GETDATE(), rc.contract_end_date) AS days_until_end
    FROM rental_contracts rc
    JOIN devices d ON d.id = rc.device_id
    WHERE rc.status = 'active'
      AND rc.contract_end_date BETWEEN GETDATE() AND DATEADD(day, 60, GETDATE())
    ORDER BY rc.contract_end_date ASC
  `);

  // 60日・30日・7日ちょうどの契約をアラートログに記録し、
  // 当日すでに送信済みの契約はTeams通知対象から除外する（Logic Appsリトライ時の重複送信防止）
  const alertTargets = result.recordset.filter(
    (r: { days_until_end: number }) => [60, 30, 7].includes(r.days_until_end)
  );
  const notifiedContractIds = new Set<number>();
  for (const target of alertTargets) {
    const alertType = target.days_until_end === 60 ? '60days'
      : target.days_until_end === 30 ? '30days' : '7days';
    try {
      await pool.request()
        .input('contract_id', sql.Int, target.id)
        .input('alert_type', sql.NVarChar, alertType)
        .query(`
          INSERT INTO alert_logs (contract_id, alert_type, sent_date)
          VALUES (@contract_id, @alert_type, CAST(GETDATE() AS DATE))
        `);
    } catch {
      // UNIQUE制約違反 = 当日すでに送信済み → 通知対象から除外する
      notifiedContractIds.add(target.id);
    }
  }

  // 当日送信済みの契約を除いたリストを返す（Logic Appsが重複通知しないように）
  const filteredRecords = result.recordset.filter(
    (r: { id: number }) => !notifiedContractIds.has(r.id)
  );

  return { status: 200, jsonBody: filteredRecords };
}

app.get('contracts', { route: 'contracts', handler: listContracts });
app.get('contractsDetail', { route: 'contracts/{id}', handler: getContract });
app.post('contractsCreate', { route: 'contracts', handler: createContract });
app.post('contractsReturn', { route: 'contracts/{id}/return', handler: returnContract });
app.get('alerts', { route: 'alerts', handler: getAlerts });
app.get('alertsInternal', { route: 'alerts/internal', authLevel: 'function', handler: getAlertsInternal });
