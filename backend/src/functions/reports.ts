import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPool, sql } from '../shared/db';
import { verifyToken, unauthorizedResponse } from '../shared/auth';
import * as XLSX from 'xlsx';

// GET /api/reports/monthly?year=2026&month=3
async function monthlyReport(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const year = parseInt(req.query.get('year') || String(new Date().getFullYear()));
  const month = parseInt(req.query.get('month') || String(new Date().getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return { status: 400, jsonBody: { error: 'year・monthは正しい整数で指定してください' } };
  }

  const pool = await getPool();

  // アクティブなレンタル（月に1日以上重複している契約）
  const rentals = await pool.request()
    .input('year', sql.Int, year)
    .input('month', sql.Int, month)
    .query(`
      DECLARE @start DATE = DATEFROMPARTS(@year, @month, 1)
      DECLARE @end DATE = EOMONTH(DATEFROMPARTS(@year, @month, 1))

      SELECT
        rc.id AS contract_id,
        rc.customer_name,
        rc.monthly_wholesale_price,
        rc.monthly_end_user_price,
        rc.op_coverage_price,
        (rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0) - rc.monthly_wholesale_price) AS monthly_profit,
        d.model_name, d.color, d.capacity, d.management_no,
        rc.contract_start_date, rc.contract_end_date
      FROM rental_contracts rc
      JOIN devices d ON d.id = rc.device_id
      WHERE rc.status IN ('active', 'returned')
        AND (rc.billing_start_date IS NULL OR rc.billing_start_date <= @end)
        AND rc.contract_end_date >= @start
      ORDER BY rc.customer_name, d.model_name
    `);

  // 同月の販売
  const sales = await pool.request()
    .input('year', sql.Int, year)
    .input('month', sql.Int, month)
    .query(`
      SELECT
        s.id, s.customer_name, s.sale_price, s.sale_method, s.sale_date,
        d.model_name, d.color, d.management_no, d.purchase_price,
        (s.sale_price - d.purchase_price) AS profit
      FROM sales s
      JOIN devices d ON d.id = s.device_id
      WHERE YEAR(s.sale_date) = @year AND MONTH(s.sale_date) = @month
    `);

  // 修理費（同月）
  const repairs = await pool.request()
    .input('year', sql.Int, year)
    .input('month', sql.Int, month)
    .query(`
      SELECT SUM(repair_cost) AS total_repair_cost
      FROM repairs
      WHERE YEAR(repair_date) = @year AND MONTH(repair_date) = @month
    `);

  const rentalRevenue = rentals.recordset.reduce((s, r) => s + (r.monthly_end_user_price || 0) + (r.op_coverage_price || 0), 0);
  const rentalProfit = rentals.recordset.reduce((s, r) => s + (r.monthly_profit || 0), 0);
  const saleRevenue = sales.recordset.reduce((s, r) => s + (r.sale_price || 0), 0);
  const saleProfit = sales.recordset.reduce((s, r) => s + (r.profit || 0), 0);
  const repairCost = repairs.recordset[0]?.total_repair_cost || 0;

  return {
    status: 200,
    jsonBody: {
      year,
      month,
      summary: {
        rental_revenue: rentalRevenue,
        rental_profit: rentalProfit,
        sale_revenue: saleRevenue,
        sale_profit: saleProfit,
        total_revenue: rentalRevenue + saleRevenue,
        total_profit: rentalProfit + saleProfit - repairCost,
        repair_cost: repairCost,
        active_contracts: rentals.recordset.length,
      },
      rentals: rentals.recordset,
      sales: sales.recordset,
    }
  };
}

// GET /api/reports/monthly/export?year=2026&month=3
async function exportMonthlyReport(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const year = parseInt(req.query.get('year') || String(new Date().getFullYear()));
  const month = parseInt(req.query.get('month') || String(new Date().getMonth() + 1));

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return { status: 400, jsonBody: { error: 'year・monthは正しい整数で指定してください' } };
  }

  const pool = await getPool();

  const rentals = await pool.request()
    .input('year', sql.Int, year)
    .input('month', sql.Int, month)
    .query(`
      DECLARE @start DATE = DATEFROMPARTS(@year, @month, 1)
      DECLARE @end DATE = EOMONTH(DATEFROMPARTS(@year, @month, 1))

      SELECT
        rc.customer_name AS 'お客様名',
        d.management_no AS '管理番号',
        d.model_name AS '機種名',
        d.color AS 'カラー',
        d.capacity AS '容量',
        rc.contract_start_date AS '契約開始日',
        rc.contract_end_date AS '契約終了日',
        rc.monthly_wholesale_price AS '月額卸価格(税抜)',
        rc.monthly_end_user_price AS '月額エンドU価格(税抜)',
        COALESCE(rc.op_coverage_price, 0) AS 'OP保証料(税抜)',
        (rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0) - rc.monthly_wholesale_price) AS '月額利益'
      FROM rental_contracts rc
      JOIN devices d ON d.id = rc.device_id
      WHERE rc.status IN ('active', 'returned')
        AND (rc.billing_start_date IS NULL OR rc.billing_start_date <= @end)
        AND rc.contract_end_date >= @start
      ORDER BY rc.customer_name
    `);

  const sales = await pool.request()
    .input('year', sql.Int, year)
    .input('month', sql.Int, month)
    .query(`
      SELECT
        s.customer_name AS 'お客様名',
        d.management_no AS '管理番号',
        d.model_name AS '機種名',
        s.sale_date AS '販売日',
        s.sale_method AS '販売方法',
        d.purchase_price AS '仕入価格(税抜)',
        s.sale_price AS '販売価格(税抜)',
        (s.sale_price - d.purchase_price) AS '利益'
      FROM sales s
      JOIN devices d ON d.id = s.device_id
      WHERE YEAR(s.sale_date) = @year AND MONTH(s.sale_date) = @month
    `);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rentals.recordset), 'レンタル');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales.recordset), '販売');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return {
    status: 200,
    body: buffer,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${year}${String(month).padStart(2, '0')}_report.xlsx"`,
    },
  };
}

// GET /api/reports/summary — ダッシュボード用サマリー
async function getSummary(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const pool = await getPool();

  const deviceStats = await pool.request().query(`
    SELECT
      SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) AS in_stock,
      SUM(CASE WHEN status = 'renting' THEN 1 ELSE 0 END) AS renting,
      SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold,
      COUNT(*) AS total
    FROM devices
  `);

  const currentMonth = await pool.request().query(`
    SELECT
      SUM(monthly_end_user_price + COALESCE(op_coverage_price, 0)) AS monthly_revenue,
      SUM(monthly_end_user_price + COALESCE(op_coverage_price, 0) - monthly_wholesale_price) AS monthly_profit,
      COUNT(*) AS active_contracts
    FROM rental_contracts
    WHERE status = 'active'
      AND (billing_start_date IS NULL OR billing_start_date <= GETDATE())
  `);

  return {
    status: 200,
    jsonBody: {
      devices: deviceStats.recordset[0],
      current_month: currentMonth.recordset[0],
    }
  };
}

// GET /api/reports/yearly?year=2026
async function yearlyReport(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const year = parseInt(req.query.get('year') || String(new Date().getFullYear()));
  if (isNaN(year)) {
    return { status: 400, jsonBody: { error: 'yearは整数で指定してください' } };
  }

  const pool = await getPool();

  const result = await pool.request()
    .input('year', sql.Int, year)
    .query(`
      WITH Months AS (
        SELECT 1 AS m UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
        UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
      )
      SELECT
        mo.m AS month,
        COUNT(DISTINCT rc.id) AS active_contracts,
        COALESCE(SUM(rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0)), 0) AS rental_revenue,
        COALESCE(SUM(rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0) - rc.monthly_wholesale_price), 0) AS rental_profit,
        COALESCE((
          SELECT SUM(s.sale_price)
          FROM sales s
          WHERE YEAR(s.sale_date) = @year AND MONTH(s.sale_date) = mo.m
        ), 0) AS sale_revenue,
        COALESCE((
          SELECT SUM(s.sale_price - d2.purchase_price)
          FROM sales s
          JOIN devices d2 ON d2.id = s.device_id
          WHERE YEAR(s.sale_date) = @year AND MONTH(s.sale_date) = mo.m
        ), 0) AS sale_profit,
        COALESCE((
          SELECT SUM(r.repair_cost)
          FROM repairs r
          WHERE YEAR(r.repair_date) = @year AND MONTH(r.repair_date) = mo.m
        ), 0) AS repair_cost
      FROM Months mo
      LEFT JOIN rental_contracts rc
        ON rc.status IN ('active', 'returned')
        AND (rc.billing_start_date IS NULL OR rc.billing_start_date <= EOMONTH(DATEFROMPARTS(@year, mo.m, 1)))
        AND rc.contract_end_date >= DATEFROMPARTS(@year, mo.m, 1)
        AND rc.contract_start_date <= EOMONTH(DATEFROMPARTS(@year, mo.m, 1))
      GROUP BY mo.m
      ORDER BY mo.m
    `);

  const months = result.recordset.map(r => ({
    month: r.month,
    active_contracts: r.active_contracts,
    rental_revenue: r.rental_revenue,
    rental_profit: r.rental_profit,
    sale_revenue: r.sale_revenue,
    sale_profit: r.sale_profit,
    repair_cost: r.repair_cost,
    total_revenue: r.rental_revenue + r.sale_revenue,
    total_profit: r.rental_profit + r.sale_profit - r.repair_cost,
  }));

  const totals = months.reduce((acc, m) => ({
    rental_revenue: acc.rental_revenue + m.rental_revenue,
    rental_profit: acc.rental_profit + m.rental_profit,
    sale_revenue: acc.sale_revenue + m.sale_revenue,
    sale_profit: acc.sale_profit + m.sale_profit,
    repair_cost: acc.repair_cost + m.repair_cost,
    total_revenue: acc.total_revenue + m.total_revenue,
    total_profit: acc.total_profit + m.total_profit,
  }), { rental_revenue: 0, rental_profit: 0, sale_revenue: 0, sale_profit: 0, repair_cost: 0, total_revenue: 0, total_profit: 0 });

  return { status: 200, jsonBody: { year, months, totals } };
}

// GET /api/reports/customers — 顧客別サマリー
async function customerSummary(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    await verifyToken(req);
  } catch {
    return unauthorizedResponse();
  }

  const pool = await getPool();

  const result = await pool.request().query(`
    SELECT
      rc.customer_name,
      rc.customer_dataverse_id,
      COUNT(rc.id) AS active_contracts,
      SUM(rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0)) AS monthly_revenue,
      SUM(rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0) - rc.monthly_wholesale_price) AS monthly_profit,
      MIN(rc.contract_end_date) AS earliest_end_date,
      MAX(rc.contract_end_date) AS latest_end_date
    FROM rental_contracts rc
    WHERE rc.status = 'active'
      AND (rc.billing_start_date IS NULL OR rc.billing_start_date <= GETDATE())
    GROUP BY rc.customer_name, rc.customer_dataverse_id
    ORDER BY SUM(rc.monthly_end_user_price + COALESCE(rc.op_coverage_price, 0)) DESC
  `);

  return { status: 200, jsonBody: result.recordset };
}

app.get('monthlyReport', { route: 'reports/monthly', handler: monthlyReport });
app.get('exportReport', { route: 'reports/monthly/export', handler: exportMonthlyReport });
app.get('summary', { route: 'reports/summary', handler: getSummary });
app.get('yearlyReport', { route: 'reports/yearly', handler: yearlyReport });
app.get('customerSummary', { route: 'reports/customers', handler: customerSummary });
