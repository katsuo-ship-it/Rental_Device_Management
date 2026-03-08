import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, sql } from '../shared/db';
import { verifyToken, unauthorizedResponse } from '../shared/auth';
import * as XLSX from 'xlsx';

// POST /api/import/excel — Excelからデータ移行
async function importFromExcel(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const pool = await getPool();
  const results = { success: 0, errors: [] as string[] };

  const toDate = (v: unknown): string | null => {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'number') {
      const date = new Date(Math.round((v - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    return String(v);
  };

  for (const sheetName of ['レンタル端末', 'レンタル（端末本体以外）']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row['機種名']) continue; // ヘッダー行スキップ

      try {
        const deviceType = sheetName === 'レンタル端末' ? 'smartphone' : 'accessory';
        const statusRaw = String(row['在庫'] || '');
        const status =
          statusRaw === 'レンタル中' ? 'renting' :
          statusRaw === '販売完了' ? 'sold' :
          'in_stock';

        // 端末登録（management_no が重複する場合はスキップして既存IDを使用）
        // 空文字はNULLに変換（createDevice/updateDeviceと統一 + 空管理番号の重複IDマッチを防止）
        const mgmtNo = (row['管理番号'] as string) || null;

        const deviceResult = await pool.request()
          .input('management_no', sql.NVarChar, mgmtNo)
          .input('device_type', sql.NVarChar, deviceType)
          .input('model_name', sql.NVarChar, row['機種名'] as string)
          .input('color', sql.NVarChar, row['端末カラー'] as string)
          .input('capacity', sql.NVarChar, row['容量'] as string)
          .input('imei', sql.NVarChar, row['IMEI(シリアル番号)'] as string)
          .input('carrier_sb', sql.Bit, row['SB'] ? 1 : 0)
          .input('carrier_au', sql.Bit, row['au'] ? 1 : 0)
          .input('carrier_his', sql.Bit, row['HIS'] ? 1 : 0)
          .input('carrier_rakuten', sql.Bit, row['楽天'] ? 1 : 0)
          .input('condition_notes', sql.NVarChar, row['商品状態備考'] as string)
          .input('status', sql.NVarChar, status)
          .input('purchase_price', sql.Decimal(12, 2), row['仕入価格\r\n税抜'] as number)
          .input('supplier', sql.NVarChar, row['仕入先'] as string)
          .input('wholesale_price', sql.Decimal(12, 2), row['フォーカス\r\n卸価格 税抜'] as number)
          .query(`
            -- 管理番号が既に存在する場合はスキップ（2回目以降のインポートで重複エラーを防ぐ）
            IF NOT EXISTS (SELECT 1 FROM devices WHERE management_no = @management_no AND @management_no IS NOT NULL)
            BEGIN
              INSERT INTO devices (
                management_no, device_type, model_name, color, capacity, imei,
                carrier_sb, carrier_au, carrier_his, carrier_rakuten, condition_notes, status,
                purchase_price, supplier, wholesale_price
              )
              OUTPUT INSERTED.id
              VALUES (
                @management_no, @device_type, @model_name, @color, @capacity, @imei,
                @carrier_sb, @carrier_au, @carrier_his, @carrier_rakuten, @condition_notes, @status,
                @purchase_price, @supplier, @wholesale_price
              )
            END
            ELSE
            BEGIN
              SELECT id FROM devices WHERE management_no = @management_no
            END
          `);

        const deviceId = deviceResult.recordset[0]?.id;
        // 既存レコードが既に契約・販売済みの場合は契約/販売の二重登録を防ぐためスキップ
        if (!deviceId) { results.success++; continue; }

        // レンタル契約登録（レンタル中のみ・2回目インポートで重複しないようチェック）
        if (status === 'renting' && row['レンタル\r\nお客様名']) {
          const contractExists = await pool.request()
            .input('device_id', sql.Int, deviceId)
            .query(`SELECT 1 FROM rental_contracts WHERE device_id = @device_id AND status = 'active'`);
          if (contractExists.recordset.length > 0) { results.success++; continue; }

          await pool.request()
            .input('device_id', sql.Int, deviceId)
            .input('customer_name', sql.NVarChar, row['レンタル\r\nお客様名'] as string)
            .input('customer_phone', sql.NVarChar, row['レンタルお客様\r\n連絡先'] as string)
            .input('delivery_name', sql.NVarChar, row['配送お客様名'] as string)
            .input('delivery_address', sql.NVarChar, row['配送先住所'] as string)
            .input('delivery_phone', sql.NVarChar, row['配送先\r\n連絡先'] as string)
            .input('contract_start_date', sql.Date, toDate(row['契約開始日']))
            .input('billing_start_date', sql.Date, toDate(row['課金開始日']))
            .input('contract_end_date', sql.Date, toDate(row['契約終了日']))
            .input('contract_months', sql.Int, row['契約期間'] as number)
            .input('auto_renewal', sql.Bit, row['自動更新'] === '有' ? 1 : 0)
            .input('min_contract_months', sql.Int, row['最低契約\r\n期間'] as number)
            .input('total_contract_months', sql.Int, row['累計契約\r\n期間'] as number)
            .input('monthly_wholesale_price', sql.Decimal(12, 2), row['フォーカス卸価格\r\n月々'] as number)
            .input('monthly_end_user_price', sql.Decimal(12, 2), row['レンタル\r\nエンドU価格'] as number)
            .input('natural_failure_coverage', sql.Bit, row['自然故障\r\n加入有無'] === '有' ? 1 : 0)
            .input('op_coverage', sql.Bit, row['OP保証\r\n加入有無'] === '有' ? 1 : 0)
            .input('op_coverage_details', sql.NVarChar, row['OP保証\r\n加入内容'] as string)
            .input('op_coverage_price', sql.Decimal(12, 2), row['加入価格'] as number)
            .query(`
              INSERT INTO rental_contracts (
                device_id, customer_name, customer_phone,
                delivery_name, delivery_address, delivery_phone,
                contract_start_date, billing_start_date, contract_end_date,
                contract_months, auto_renewal, min_contract_months, total_contract_months,
                monthly_wholesale_price, monthly_end_user_price,
                natural_failure_coverage, op_coverage, op_coverage_details, op_coverage_price
              )
              VALUES (
                @device_id, @customer_name, @customer_phone,
                @delivery_name, @delivery_address, @delivery_phone,
                @contract_start_date, @billing_start_date, @contract_end_date,
                @contract_months, @auto_renewal, @min_contract_months, @total_contract_months,
                @monthly_wholesale_price, @monthly_end_user_price,
                @natural_failure_coverage, @op_coverage, @op_coverage_details, @op_coverage_price
              )
            `);
        }

        // 販売済みの場合（2回目インポートで重複しないようチェック）
        if (status === 'sold' && row['販売日']) {
          const saleExists = await pool.request()
            .input('device_id', sql.Int, deviceId)
            .query(`SELECT 1 FROM sales WHERE device_id = @device_id`);
          if (saleExists.recordset.length > 0) { results.success++; continue; }

          await pool.request()
            .input('device_id', sql.Int, deviceId)
            .input('sale_date', sql.Date, toDate(row['販売日']))
            .input('sale_method', sql.NVarChar, row['販売方法'] as string)
            .input('sale_price', sql.Decimal(12, 2), row['希望販売\r\n価格 税抜'] as number)
            .query(`
              INSERT INTO sales (device_id, sale_date, sale_method, sale_price)
              VALUES (@device_id, @sale_date, @sale_method, @sale_price)
            `);
        }

        results.success++;
      } catch (err) {
        results.errors.push(`行 ${i + 3}: データの登録に失敗しました`);
      }
    }
  }

  return { status: 200, jsonBody: results };
}

app.post('importExcel', { route: 'import/excel', handler: importFromExcel });
