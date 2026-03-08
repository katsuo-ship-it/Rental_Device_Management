import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { RentalContract, DashboardSummary } from '../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

function AlertBadge({ days }: { days: number }) {
  if (days <= 7) return <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-bold">7日以内</span>;
  if (days <= 30) return <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-bold">30日以内</span>;
  return <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-bold">60日以内</span>;
}

export default function Dashboard() {
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<RentalContract[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setError('接続がタイムアウトしました。ページを再読み込みしてください。');
      setLoading(false);
    }, 20000);

    Promise.all([
      apiFetch<RentalContract[]>('/alerts'),
      apiFetch<DashboardSummary>('/reports/summary'),
      apiFetch<RentalContract[]>('/contracts?status=active'),
    ]).then(([a, s, all]) => {
      setAlerts(a);
      setSummary(s);
      setOverdueCount(all.filter(c => c.days_until_end != null && c.days_until_end < 0).length);
    }).catch((e: Error) => {
      setError(e.message || 'データの取得に失敗しました');
    }).finally(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => clearTimeout(timeout);
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-500">読み込み中...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>;

  const fmt = (n: number) => n?.toLocaleString('ja-JP') ?? '-';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/devices?status=renting">
          <SummaryCard label="レンタル中" value={`${summary?.devices.renting ?? 0} 台`} color="blue" clickable />
        </Link>
        <Link to="/devices?status=in_stock">
          <SummaryCard label="在庫" value={`${summary?.devices.in_stock ?? 0} 台`} color="green" clickable />
        </Link>
        <SummaryCard label="今月売上" value={`¥${fmt(summary?.current_month.monthly_revenue ?? 0)}`} color="purple" />
        <SummaryCard label="今月利益" value={`¥${fmt(summary?.current_month.monthly_profit ?? 0)}`} color="indigo" />
      </div>

      {/* アラート一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">契約期限アラート</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              契約期間超過
              <span className="ml-1.5 bg-red-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {overdueCount}件
              </span>
            </span>
            <span className="text-sm text-gray-600">
              契約終了間近
              <span className={`ml-1.5 text-xs font-bold rounded-full px-2 py-0.5 ${alerts.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {alerts.length}件
              </span>
            </span>
          </div>
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center text-gray-500">期限が近い契約はありません</div>
        ) : (
          <div className="divide-y">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50">
                <AlertBadge days={a.days_until_end ?? 0} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{a.customer_name}</p>
                  <p className="text-sm text-gray-500">
                    {a.model_name} {a.color} {a.capacity} / 管理番号: {a.management_no}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-gray-800">
                    {a.contract_end_date
                      ? format(new Date(a.contract_end_date), 'yyyy年M月d日', { locale: ja })
                      : '-'}
                  </p>
                  <p className="text-xs text-gray-500">終了日</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/contracts/${a.id}/return`)}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    返却処理
                  </button>
                  <Link
                    to={`/devices/${a.device_id}`}
                    className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    詳細
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, clickable }: { label: string; value: string; color: string; clickable?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]} ${clickable ? 'hover:brightness-95 cursor-pointer transition-all' : ''}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {clickable && <p className="text-xs opacity-50 mt-1">→ 一覧を見る</p>}
    </div>
  );
}
