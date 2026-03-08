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
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<RentalContract[]>('/alerts'),
      apiFetch<DashboardSummary>('/reports/summary'),
    ]).then(([a, s]) => {
      setAlerts(a);
      setSummary(s);
    }).catch((e: Error) => {
      setError(e.message || 'データの取得に失敗しました');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-500">読み込み中...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>;

  const fmt = (n: number) => n?.toLocaleString('ja-JP') ?? '-';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="レンタル中" value={`${summary?.devices.renting ?? 0} 台`} color="blue" />
        <SummaryCard label="在庫" value={`${summary?.devices.in_stock ?? 0} 台`} color="green" />
        <SummaryCard label="今月売上" value={`¥${fmt(summary?.current_month.monthly_revenue ?? 0)}`} color="purple" />
        <SummaryCard label="今月利益" value={`¥${fmt(summary?.current_month.monthly_profit ?? 0)}`} color="indigo" />
      </div>

      {/* アラート一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            契約期限アラート
            {alerts.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {alerts.length}
              </span>
            )}
          </h2>
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

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
