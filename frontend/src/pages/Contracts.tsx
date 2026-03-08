import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { RentalContract } from '../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const STATUS_LABELS: Record<string, string> = {
  active: 'レンタル中',
  returned: '返却済み',
  cancelled: 'キャンセル',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  returned: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
};

function DaysBadge({ days }: { days: number }) {
  if (days < 0)   return <span className="px-2 py-0.5 text-xs bg-red-600 text-white rounded-full font-bold whitespace-nowrap">要確認</span>;
  if (days <= 7)  return <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-bold whitespace-nowrap">残{days}日</span>;
  if (days <= 30) return <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-bold whitespace-nowrap">残{days}日</span>;
  if (days <= 60) return <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full whitespace-nowrap">残{days}日</span>;
  return <span className="text-xs text-gray-500 whitespace-nowrap">残{days}日</span>;
}

export default function Contracts() {
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<RentalContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'active' | 'returned' | 'cancelled'>('active');

  // クライアントサイドフィルター
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterEndFrom, setFilterEndFrom] = useState('');
  const [filterEndTo, setFilterEndTo] = useState('');

  const fetchContracts = async (s = status) => {
    setLoading(true);
    setError('');

    const timeoutId = setTimeout(() => {
      setError('接続がタイムアウトしました。ページを再読み込みしてください。');
      setLoading(false);
    }, 20000);

    try {
      const data = await apiFetch<RentalContract[]>(`/contracts?status=${s}`);
      setContracts(data);
    } catch (e) {
      setError((e as Error).message || 'データの取得に失敗しました');
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    // タブ切り替え時にフィルターをリセット
    setFilterCustomer('');
    setFilterModel('');
    setFilterEndFrom('');
    setFilterEndTo('');
    fetchContracts();
  }, [status]);

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (filterCustomer && !c.customer_name?.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
      if (filterModel && !c.model_name?.toLowerCase().includes(filterModel.toLowerCase())) return false;
      // ISOstring ("2026-03-31T00:00:00.000Z") 対策: 先頭10文字だけで比較
      const endDate = c.contract_end_date?.slice(0, 10) ?? '';
      if (filterEndFrom && endDate < filterEndFrom) return false;
      if (filterEndTo && endDate > filterEndTo) return false;
      return true;
    });
  }, [contracts, filterCustomer, filterModel, filterEndFrom, filterEndTo]);

  const fmt = (n: number) => n?.toLocaleString('ja-JP') ?? '-';
  const fmtDate = (d?: string) => d ? format(new Date(d), 'yyyy/MM/dd', { locale: ja }) : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">契約管理</h1>
        <div className="flex gap-2">
          {(['active', 'returned', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* フィルターバー */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="お客様名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          />
          <input
            type="text"
            placeholder="機種名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
          />
          <input
            type="date"
            title="終了日 From"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterEndFrom}
            onChange={(e) => setFilterEndFrom(e.target.value)}
          />
          <input
            type="date"
            title="終了日 To"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterEndTo}
            onChange={(e) => setFilterEndTo(e.target.value)}
          />
        </div>
        {(filterCustomer || filterModel || filterEndFrom || filterEndTo) && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => { setFilterCustomer(''); setFilterModel(''); setFilterEndFrom(''); setFilterEndTo(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              フィルタークリア
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ステータス', 'お客様名', '機種名', '管理番号', '契約開始日', '契約終了日', '残日数', '月額エンドU', '月額利益', '操作'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-gray-500">
                      {contracts.length > 0 ? 'フィルター条件に一致する契約がありません' : `${STATUS_LABELS[status]}の契約はありません`}
                    </td>
                  </tr>
                ) : filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {c.model_name} <span className="text-gray-400">{c.color}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.management_no || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(c.contract_start_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={
                        c.days_until_end != null && c.days_until_end <= 30 && c.status === 'active'
                          ? 'font-semibold text-orange-700'
                          : 'text-gray-600'
                      }>
                        {fmtDate(c.contract_end_date)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'active' && c.days_until_end != null
                        ? <DaysBadge days={c.days_until_end} />
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {c.monthly_end_user_price ? `¥${fmt(c.monthly_end_user_price)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {c.monthly_end_user_price != null && c.monthly_wholesale_price != null
                        ? `¥${fmt((c.monthly_end_user_price + (c.op_coverage_price || 0)) - c.monthly_wholesale_price)}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          to={`/contracts/${c.id}`}
                          className="px-2 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100"
                        >
                          詳細
                        </Link>
                        <Link
                          to={`/devices/${c.device_id}`}
                          className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-100"
                        >
                          端末
                        </Link>
                        {c.status === 'active' && (
                          <button
                            onClick={() => navigate(`/contracts/${c.id}/return`)}
                            className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                          >
                            返却
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} 件表示{filtered.length !== contracts.length ? `（全${contracts.length}件中）` : '（最大500件）'}
        </p>
      )}
    </div>
  );
}
