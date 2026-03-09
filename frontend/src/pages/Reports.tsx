import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { YearlyReport, CustomerSummary } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Tab = 'monthly' | 'yearly' | 'customers';

interface MonthlyReport {
  year: number;
  month: number;
  summary: {
    rental_revenue: number;
    rental_profit: number;
    sale_revenue: number;
    sale_profit: number;
    total_revenue: number;
    total_profit: number;
    repair_cost: number;
    active_contracts: number;
  };
  rentals: Record<string, unknown>[];
  sales: Record<string, unknown>[];
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

// ===================== 月次タブ =====================
function MonthlyTab() {
  const { apiFetch, downloadFile } = useApi();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<MonthlyReport>(`/reports/monthly?year=${year}&month=${month}`);
      setReport(data);
    } catch (e) {
      setError((e as Error).message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [year, month]);

  const fmt = (n: number) => (n ?? 0).toLocaleString('ja-JP');

  const chartData = report ? [
    { name: 'レンタル', 売上: report.summary.rental_revenue, 利益: report.summary.rental_profit },
    { name: '販売', 売上: report.summary.sale_revenue, 利益: report.summary.sale_profit },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i).map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
        <button
          onClick={() => downloadFile(
            `/reports/monthly/export?year=${year}&month=${month}`,
            `${year}${String(month).padStart(2, '0')}_report.xlsx`
          )}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Excelダウンロード
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-gray-500">読み込み中...</div>
      ) : report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="レンタル売上" value={`¥${fmt(report.summary.rental_revenue)}`} sub="税抜" color="blue" />
            <Card label="販売売上" value={`¥${fmt(report.summary.sale_revenue)}`} sub="税抜" color="purple" />
            <Card label="修理費" value={`¥${fmt(report.summary.repair_cost)}`} sub="税抜" color="orange" />
            <Card label="総利益" value={`¥${fmt(report.summary.total_profit)}`} sub="税抜" color="green" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">売上・利益内訳</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `¥${v.toLocaleString('ja-JP')}`} />
                <Legend />
                <Bar dataKey="売上" fill="#3b82f6" />
                <Bar dataKey="利益" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-base font-semibold text-gray-700">レンタル明細（{report.rentals.length}件）</h2>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-72">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {['お客様名', '機種名', '管理番号', '契約期間', '月額卸', '月額エンドU', 'OP保証料', '月額利益'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.rentals.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{r.customer_name as string}</td>
                      <td className="px-4 py-3">{r.model_name as string} {r.color as string}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.management_no as string}</td>
                      <td className="px-4 py-3 text-xs">{r.contract_start_date as string} 〜 {r.contract_end_date as string}</td>
                      <td className="px-4 py-3 text-right">¥{fmt(r.monthly_wholesale_price as number)}</td>
                      <td className="px-4 py-3 text-right">¥{fmt(r.monthly_end_user_price as number)}</td>
                      <td className="px-4 py-3 text-right">{r.op_coverage_price ? `¥${fmt(r.op_coverage_price as number)}` : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">¥{fmt(r.monthly_profit as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.sales.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-base font-semibold text-gray-700">販売明細（{report.sales.length}件）</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['お客様名', '機種名', '販売日', '販売方法', '仕入価格', '販売価格', '利益'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {report.sales.map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{s.customer_name as string}</td>
                        <td className="px-4 py-3">{s.model_name as string}</td>
                        <td className="px-4 py-3 text-xs">{s.sale_date as string}</td>
                        <td className="px-4 py-3">{s.sale_method as string}</td>
                        <td className="px-4 py-3 text-right">¥{fmt(s.purchase_price as number)}</td>
                        <td className="px-4 py-3 text-right">¥{fmt(s.sale_price as number)}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">¥{fmt(s.profit as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===================== 年間タブ =====================
function YearlyTab() {
  const { apiFetch } = useApi();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<YearlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    apiFetch<YearlyReport>(`/reports/yearly?year=${year}`)
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  const fmt = (n: number) => (n ?? 0).toLocaleString('ja-JP');

  const chartData = report?.months.map((m) => ({
    name: `${m.month}月`,
    レンタル売上: m.rental_revenue,
    販売売上: m.sale_revenue,
    利益: m.total_profit,
  })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value))}
        >
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="py-16 text-center text-gray-500">読み込み中...</div>
      ) : report && (
        <>
          {/* 年間サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="年間レンタル売上" value={`¥${fmt(report.totals.rental_revenue)}`} sub="税抜" color="blue" />
            <Card label="年間販売売上" value={`¥${fmt(report.totals.sale_revenue)}`} sub="税抜" color="purple" />
            <Card label="年間修理費" value={`¥${fmt(report.totals.repair_cost)}`} sub="税抜" color="orange" />
            <Card label="年間総利益" value={`¥${fmt(report.totals.total_profit)}`} sub="税抜" color="green" />
          </div>

          {/* 月別グラフ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-4">{year}年 月別売上・利益</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
                <Tooltip formatter={(v: number) => `¥${v.toLocaleString('ja-JP')}`} />
                <Legend />
                <Bar dataKey="レンタル売上" fill="#3b82f6" />
                <Bar dataKey="販売売上" fill="#8b5cf6" />
                <Bar dataKey="利益" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 月別明細テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['月', '稼働契約数', 'レンタル売上', '販売売上', '修理費', '総売上', '総利益'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.months.map((m) => (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{m.month}月</td>
                      <td className="px-4 py-3 text-center">{m.active_contracts}</td>
                      <td className="px-4 py-3 text-right">¥{fmt(m.rental_revenue)}</td>
                      <td className="px-4 py-3 text-right">¥{fmt(m.sale_revenue)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">¥{fmt(m.repair_cost)}</td>
                      <td className="px-4 py-3 text-right">¥{fmt(m.total_revenue)}</td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">¥{fmt(m.total_profit)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td className="px-4 py-3 text-gray-700">合計</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right">¥{fmt(report.totals.rental_revenue)}</td>
                    <td className="px-4 py-3 text-right">¥{fmt(report.totals.sale_revenue)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">¥{fmt(report.totals.repair_cost)}</td>
                    <td className="px-4 py-3 text-right">¥{fmt(report.totals.total_revenue)}</td>
                    <td className="px-4 py-3 text-right text-green-700">¥{fmt(report.totals.total_profit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== 顧客別タブ =====================
function CustomersTab() {
  const { apiFetch } = useApi();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<CustomerSummary[]>('/reports/customers')
      .then(setCustomers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => (n ?? 0).toLocaleString('ja-JP');
  const fmtDate = (d?: string) => d ? d.split('T')[0] : '-';

  if (loading) return <div className="py-16 text-center text-gray-500">読み込み中...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>;

  const totalRevenue = customers.reduce((s, c) => s + (c.monthly_revenue || 0), 0);
  const totalProfit = customers.reduce((s, c) => s + (c.monthly_profit || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card label="アクティブ顧客数" value={`${customers.length}社`} sub="稼働中" color="blue" />
        <Card label="月額総売上" value={`¥${fmt(totalRevenue)}`} sub="税抜" color="purple" />
        <Card label="月額総利益" value={`¥${fmt(totalProfit)}`} sub="税抜" color="green" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['お客様名', '稼働契約数', '月額売上', '月額利益', '最近の終了日', '最遅の終了日'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-500">アクティブな契約がありません</td></tr>
              ) : customers.map((c) => (
                <tr key={c.customer_name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                  <td className="px-4 py-3 text-center">{c.active_contracts}</td>
                  <td className="px-4 py-3 text-right text-gray-700">¥{fmt(c.monthly_revenue)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">¥{fmt(c.monthly_profit)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(c.earliest_end_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(c.latest_end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===================== メインコンポーネント =====================
export default function Reports() {
  const [tab, setTab] = useState<Tab>('monthly');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'monthly', label: '月次レポート' },
    { key: 'yearly', label: '年間レポート' },
    { key: 'customers', label: '顧客別サマリー' },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">料金・利益</h1>
        <div className="flex gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                tab === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'monthly' && <MonthlyTab />}
        {tab === 'yearly' && <YearlyTab />}
        {tab === 'customers' && <CustomersTab />}
      </div>
    </div>
  );
}
