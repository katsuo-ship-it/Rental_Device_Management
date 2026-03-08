import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Device, DeviceStatus } from '../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  in_stock: '在庫',
  renting: 'レンタル中',
  sold: '販売済み',
};

const STATUS_COLORS: Record<DeviceStatus, string> = {
  in_stock: 'bg-green-100 text-green-700',
  renting: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-500',
};

export default function Devices() {
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    customer: '',
    endDateFrom: '',
    endDateTo: '',
    model: '',
    imei: '',
  });

  const fetchDevices = async (f = filters) => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    const data = await apiFetch<Device[]>(`/devices?${params.toString()}`);
    setDevices(data);
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const fmt = (n: number) => n?.toLocaleString('ja-JP') ?? '-';
  const fmtDate = (d?: string) => d ? format(new Date(d), 'yyyy/MM/dd', { locale: ja }) : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">端末管理</h1>
        <Link
          to="/devices/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + 新規登録
        </Link>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">全ステータス</option>
            <option value="renting">レンタル中</option>
            <option value="in_stock">在庫</option>
            <option value="sold">販売済み</option>
          </select>
          <input
            type="text"
            placeholder="お客様名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.customer}
            onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
          />
          <input
            type="date"
            placeholder="終了日(From)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.endDateFrom}
            onChange={(e) => setFilters({ ...filters, endDateFrom: e.target.value })}
          />
          <input
            type="date"
            placeholder="終了日(To)"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.endDateTo}
            onChange={(e) => setFilters({ ...filters, endDateTo: e.target.value })}
          />
          <input
            type="text"
            placeholder="機種名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.model}
            onChange={(e) => setFilters({ ...filters, model: e.target.value })}
          />
          <input
            type="text"
            placeholder="IMEI"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.imei}
            onChange={(e) => setFilters({ ...filters, imei: e.target.value })}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={fetchDevices}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            検索
          </button>
          <button
            onClick={() => {
              const empty = { status: '', customer: '', endDateFrom: '', endDateTo: '', model: '', imei: '' };
              setFilters(empty);
              fetchDevices(empty);
            }}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            クリア
          </button>
        </div>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500">読み込み中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['管理番号', '機種名・カラー・容量', 'ステータス', 'お客様名', '契約開始日', '契約終了日', '月額料金', '仕入価格', 'IMEI', '修理履歴'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {devices.length === 0 ? (
                  <tr><td colSpan={11} className="py-12 text-center text-gray-500">データがありません</td></tr>
                ) : devices.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{d.management_no || '-'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{d.model_name}</p>
                      <p className="text-xs text-gray-500">{d.color} {d.capacity}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(d.contract_start_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.contract_end_date ? (
                        <span className="text-gray-600">{fmtDate(d.contract_end_date)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {d.monthly_end_user_price ? `¥${fmt(d.monthly_end_user_price)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {d.purchase_price ? `¥${fmt(d.purchase_price)}` : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.imei || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {d.total_repair_cost ? (
                        <span className="text-orange-600 font-medium">有</span>
                      ) : (
                        <span className="text-gray-400">無</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          to={`/devices/${d.id}`}
                          className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-100"
                        >
                          詳細
                        </Link>
                        {d.status === 'in_stock' ? (
                          <>
                            <button
                              onClick={() => navigate(`/contracts/new?deviceId=${d.id}`)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              貸出
                            </button>
                            <button
                              onClick={() => navigate(`/devices/${d.id}/sell`)}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              販売
                            </button>
                          </>
                        ) : d.status === 'renting' ? (
                          <button
                            onClick={() => navigate(`/contracts/${d.contract_id}/return`)}
                            className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                          >
                            返却
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
