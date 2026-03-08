import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, sql } from '../shared/db';
import { verifyToken, unauthorizedResponse } from '../shared/auth';

// GET /api/devices
async function listDevices(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const status = req.query.get('status') || '';
  const customer = req.query.get('customer') || '';
  const model = req.query.get('model') || '';
  const imei = req.query.get('imei') || '';
  const endDateFrom = req.query.get('endDateFrom') || '';
  const endDateTo = req.query.get('endDateTo') || '';

  const pool = await getPool();
  let query = `
    SELECT TOP 500
      d.id, d.management_no, d.device_type, d.model_name, d.color, d.capacity,
      d.imei, d.status, d.purchase_price, d.wholesale_price,
      d.check_appearance, d.check_boot, d.check_sim, d.check_charge, d.check_battery,
      d.supplier, d.purchase_date, d.arrival_date, d.condition_notes,
      d.carrier_sb, d.carrier_au, d.carrier_his, d.carrier_rakuten,
      d.created_at, d.updated_at,
      rc.id AS contract_id,
      rc.customer_name,
      rc.contract_start_date,
      rc.contract_end_date,
      rc.monthly_end_user_price,
      rc.monthly_wholesale_price,
      (SELECT SUM(repair_cost) FROM repairs WHERE device_id = d.id) AS total_repair_cost
    FROM devices d
    LEFT JOIN rental_contracts rc ON rc.device_id = d.id AND rc.status = 'active'
    WHERE 1=1
  `;

  const inputs: { name: string; value: string }[] = [];

  if (status) {
    query += ` AND d.status = @status`;
    inputs.push({ name: 'status', value: status });
  }
  if (customer) {
    query += ` AND rc.customer_name LIKE @customer`;
    inputs.push({ name: 'customer', value: `%${customer}%` });
  }
  if (model) {
    query += ` AND d.model_name LIKE @model`;
    inputs.push({ name: 'model', value: `%${model}%` });
  }
  if (imei) {
    query += ` AND d.imei LIKE @imei`;
    inputs.push({ name: 'imei', value: `%${imei}%` });
  }
  if (endDateFrom) {
    query += ` AND rc.contract_end_date >= @endDateFrom`;
    inputs.push({ name: 'endDateFrom', value: endDateFrom });
  }
  if (endDateTo) {
    query += ` AND rc.contract_end_date <= @endDateTo`;
    inputs.push({ name: 'endDateTo', value: endDateTo });
  }

  query += ` ORDER BY d.created_at DESC`;

  const request = pool.request();
  for (const { name, value } of inputs) {
    request.input(name, sql.NVarChar, value);
  }

  const result = await request.query(query);
  return { status: 200, jsonBody: result.recordset };
}

// GET /api/devices/:id
async function getDevice(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const id = req.params.id;
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, parseInt(id))
    .query(`
      SELECT d.*,
        rc.id AS contract_id, rc.customer_name, rc.customer_dataverse_id,
        rc.contract_start_date, rc.billing_start_date, rc.contract_end_date,
        rc.contract_months, rc.auto_renewal, rc.min_contract_months,
        rc.monthly_wholesale_price, rc.monthly_end_user_price,
        rc.natural_failure_coverage, rc.op_coverage, rc.op_coverage_details,
        rc.op_coverage_price, rc.notes AS contract_notes, rc.status AS contract_status
      FROM devices d
      LEFT JOIN rental_contracts rc ON rc.device_id = d.id AND rc.status = 'active'
      WHERE d.id = @id
    `);

  if (result.recordset.length === 0) {
    return { status: 404, jsonBody: { error: '端末が見つかりません' } };
  }

  // 修理履歴
  const repairs = await pool.request()
    .input('device_id', sql.Int, parseInt(id))
    .query(`SELECT * FROM repairs WHERE device_id = @device_id ORDER BY repair_date DESC`);

  // 販売履歴
  const sales = await pool.request()
    .input('device_id', sql.Int, parseInt(id))
    .query(`SELECT * FROM sales WHERE device_id = @device_id ORDER BY sale_date DESC`);

  return {
    status: 200,
    jsonBody: {
      ...result.recordset[0],
      repairs: repairs.recordset,
      sales: sales.recordset,
    }
  };
}

// POST /api/devices
async function createDevice(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const body = await req.json() as Record<string, unknown>;
  const pool = await getPool();
  // 空文字はNULLとして扱う（フィルタードUNIQUEインデックスがNULL・空文字を除外するため）
  const mgmtNo = (body.management_no as string) || null;

  const result = await pool.request()
    .input('management_no', sql.NVarChar, mgmtNo)
    .input('device_type', sql.NVarChar, body.device_type as string)
    .input('model_name', sql.NVarChar, body.model_name as string)
    .input('color', sql.NVarChar, body.color as string)
    .input('capacity', sql.NVarChar, body.capacity as string)
    .input('imei', sql.NVarChar, body.imei as string)
    .input('carrier_sb', sql.Bit, body.carrier_sb ? 1 : 0)
    .input('carrier_au', sql.Bit, body.carrier_au ? 1 : 0)
    .input('carrier_his', sql.Bit, body.carrier_his ? 1 : 0)
    .input('carrier_rakuten', sql.Bit, body.carrier_rakuten ? 1 : 0)
    .input('condition_notes', sql.NVarChar, body.condition_notes as string)
    .input('check_appearance', sql.NVarChar, body.check_appearance as string)
    .input('check_boot', sql.NVarChar, body.check_boot as string)
    .input('check_sim', sql.NVarChar, body.check_sim as string)
    .input('check_charge', sql.NVarChar, body.check_charge as string)
    .input('check_battery', sql.Decimal(5, 2), body.check_battery as number)
    .input('purchase_price', sql.Decimal(12, 2), body.purchase_price as number)
    .input('supplier', sql.NVarChar, body.supplier as string)
    .input('purchase_date', sql.Date, body.purchase_date as string)
    .input('arrival_date', sql.Date, body.arrival_date as string)
    .input('wholesale_price', sql.Decimal(12, 2), body.wholesale_price as number)
    .query(`
      INSERT INTO devices (
        management_no, device_type, model_name, color, capacity, imei,
        carrier_sb, carrier_au, carrier_his, carrier_rakuten, condition_notes,
        check_appearance, check_boot, check_sim, check_charge, check_battery,
        purchase_price, supplier, purchase_date, arrival_date, wholesale_price
      )
      OUTPUT INSERTED.*
      VALUES (
        @management_no, @device_type, @model_name, @color, @capacity, @imei,
        @carrier_sb, @carrier_au, @carrier_his, @carrier_rakuten, @condition_notes,
        @check_appearance, @check_boot, @check_sim, @check_charge, @check_battery,
        @purchase_price, @supplier, @purchase_date, @arrival_date, @wholesale_price
      )
    `);

  return { status: 201, jsonBody: result.recordset[0] };
}

// PUT /api/devices/:id
async function updateDevice(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const id = req.params.id;
  const body = await req.json() as Record<string, unknown>;
  const pool = await getPool();
  const mgmtNo = (body.management_no as string) || null;

  const updateResult = await pool.request()
    .input('id', sql.Int, parseInt(id))
    .input('management_no', sql.NVarChar, mgmtNo)
    .input('device_type', sql.NVarChar, body.device_type as string)
    .input('model_name', sql.NVarChar, body.model_name as string)
    .input('color', sql.NVarChar, body.color as string)
    .input('capacity', sql.NVarChar, body.capacity as string)
    .input('imei', sql.NVarChar, body.imei as string)
    .input('carrier_sb', sql.Bit, body.carrier_sb ? 1 : 0)
    .input('carrier_au', sql.Bit, body.carrier_au ? 1 : 0)
    .input('carrier_his', sql.Bit, body.carrier_his ? 1 : 0)
    .input('carrier_rakuten', sql.Bit, body.carrier_rakuten ? 1 : 0)
    .input('condition_notes', sql.NVarChar, body.condition_notes as string)
    .input('check_appearance', sql.NVarChar, body.check_appearance as string)
    .input('check_boot', sql.NVarChar, body.check_boot as string)
    .input('check_sim', sql.NVarChar, body.check_sim as string)
    .input('check_charge', sql.NVarChar, body.check_charge as string)
    .input('check_battery', sql.Decimal(5, 2), body.check_battery as number)
    .input('purchase_price', sql.Decimal(12, 2), body.purchase_price as number)
    .input('supplier', sql.NVarChar, body.supplier as string)
    .input('purchase_date', sql.Date, body.purchase_date as string)
    .input('arrival_date', sql.Date, body.arrival_date as string)
    .input('wholesale_price', sql.Decimal(12, 2), body.wholesale_price as number)
    .query(`
      UPDATE devices SET
        management_no = @management_no, device_type = @device_type,
        model_name = @model_name, color = @color, capacity = @capacity, imei = @imei,
        carrier_sb = @carrier_sb, carrier_au = @carrier_au,
        carrier_his = @carrier_his, carrier_rakuten = @carrier_rakuten,
        condition_notes = @condition_notes,
        check_appearance = @check_appearance, check_boot = @check_boot,
        check_sim = @check_sim, check_charge = @check_charge, check_battery = @check_battery,
        purchase_price = @purchase_price, supplier = @supplier,
        purchase_date = @purchase_date, arrival_date = @arrival_date,
        wholesale_price = @wholesale_price
      WHERE id = @id
    `);

  if (updateResult.rowsAffected[0] === 0) {
    return { status: 404, jsonBody: { error: '端末が見つかりません' } };
  }

  return { status: 200, jsonBody: { message: '更新しました' } };
}

// POST /api/devices/:id/sell
async function sellDevice(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
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

    // 端末のステータスを確認（in_stock のみ販売可能）
    const deviceCheck = await new sql.Request(transaction)
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT status FROM devices WHERE id = @id`);

    if (deviceCheck.recordset.length === 0) {
      await transaction.rollback();
      return { status: 404, jsonBody: { error: '端末が見つかりません' } };
    }
    const deviceStatus = deviceCheck.recordset[0].status;
    if (deviceStatus !== 'in_stock') {
      await transaction.rollback();
      return { status: 400, jsonBody: { error: 'この端末は販売できません（レンタル中または販売済み）' } };
    }

    await new sql.Request(transaction)
      .input('device_id', sql.Int, parseInt(id))
      .input('customer_dataverse_id', sql.NVarChar, body.customer_dataverse_id as string)
      .input('customer_name', sql.NVarChar, body.customer_name as string)
      .input('sale_date', sql.Date, body.sale_date as string)
      .input('sale_method', sql.NVarChar, body.sale_method as string)
      .input('sale_price', sql.Decimal(12, 2), body.sale_price as number)
      .input('notes', sql.NVarChar, body.notes as string)
      .query(`
        INSERT INTO sales (device_id, customer_dataverse_id, customer_name, sale_date, sale_method, sale_price, notes)
        VALUES (@device_id, @customer_dataverse_id, @customer_name, @sale_date, @sale_method, @sale_price, @notes)
      `);

    await new sql.Request(transaction)
      .input('id', sql.Int, parseInt(id))
      .query(`UPDATE devices SET status = 'sold' WHERE id = @id`);

    await transaction.commit();
    return { status: 200, jsonBody: { message: '販売処理が完了しました' } };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// 登録
app.get('devices', { route: 'devices', handler: listDevices });
app.get('devicesById', { route: 'devices/{id}', handler: getDevice });
app.post('devicesCreate', { route: 'devices', handler: createDevice });
app.put('devicesUpdate', { route: 'devices/{id}', handler: updateDevice });
app.post('devicesSell', { route: 'devices/{id}/sell', handler: sellDevice });
