import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30];

export default function Devices() {
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deviceType, setDeviceType] = useState<'smartphone' | 'accessory'>('smartphone');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    customer: '',
    endDateFrom: '',
    endDateTo: '',
    model: '',
    imei: '',
  });

  const fetchDevices = async (f = filters, p = page, ps = pageSize, dt = deviceType) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
      params.set('deviceType', dt);
      params.set('page', String(p));
      params.set('pageSize', String(ps));
      const res = await apiFetch<{ data: Device[]; total: number; page: number; pageSize: number }>(`/devices?${params.toString()}`);
      setDevices(res.data);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const handleTabChange = (dt: 'smartphone' | 'accessory') => {
    setDeviceType(dt);
    setPage(1);
    fetchDevices(filters, 1, pageSize, dt);
  };

  const handleSearch = () => {
    setPage(1);
    fetchDevices(filters, 1, pageSize, deviceType);
  };

  const handleClear = () => {
    const empty = { status: '', customer: '', endDateFrom: '', endDateTo: '', model: '', imei: '' };
    setFilters(empty);
    setPage(1);
    fetchDevices(empty, 1, pageSize, deviceType);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchDevices(filters, newPage, pageSize, deviceType);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
    fetchDevices(filters, 1, newSize, deviceType);
  };

  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const fmt = (n: number) => n?.toLocaleString('ja-JP') ?? '-';
  const fmtDate = (d?: string) => d ? format(new Date(d), 'yyyy/MM/dd', { locale: ja }) : '-';

  // page number buttons: show up to 5 around current page
  const pageButtons = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

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

      {/* カテゴリタブ */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['smartphone', 'accessory'] as const).map((dt) => (
          <button
            key={dt}
            onClick={() => handleTabChange(dt)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              deviceType === dt
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {dt === 'smartphone' ? '📱 スマートフォン' : '🎒 アクセサリー'}
          </button>
        ))}
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.endDateFrom}
            onChange={(e) => setFilters({ ...filters, endDateFrom: e.target.value })}
          />
          <input
            type="date"
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
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            検索
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            クリア
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-500">読み込み中...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-base">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['管理番号', '機種名・カラー・容量', 'ステータス', 'お客様名', '契約開始日', '契約終了日', '月額料金', '仕入価格', 'IMEI', '修理履歴'].map(h => (
                      <th key={h} className="px-4 py-3 align-middle text-center text-sm font-semibold text-gray-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-3 align-middle text-center text-sm font-semibold text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {devices.length === 0 ? (
                    <tr><td colSpan={11} className="py-12 text-center text-gray-500">データがありません</td></tr>
                  ) : devices.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-middle text-center font-mono whitespace-nowrap">{d.management_no || '-'}</td>
                      <td className="px-4 py-3 align-middle">
                        <p className="font-medium text-gray-800 whitespace-nowrap">{d.model_name}</p>
                        <p className="text-sm text-gray-500 whitespace-nowrap">{d.color} {d.capacity}</p>
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <span className={`px-2 py-0.5 text-sm rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[d.status]}`}>
                          {STATUS_LABELS[d.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-700 whitespace-nowrap">{d.customer_name || '-'}</td>
                      <td className="px-4 py-3 align-middle text-center text-gray-600 whitespace-nowrap">{fmtDate(d.contract_start_date)}</td>
                      <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                        {d.contract_end_date ? (
                          <span className="text-gray-600">{fmtDate(d.contract_end_date)}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 align-middle text-right text-gray-700 whitespace-nowrap">
                        {d.monthly_end_user_price ? `¥${fmt(d.monthly_end_user_price)}` : '-'}
                      </td>
                      <td className="px-4 py-3 align-middle text-right text-gray-700 whitespace-nowrap">
                        {d.purchase_price ? `¥${fmt(d.purchase_price)}` : '-'}
                      </td>
                      <td className="px-4 py-3 align-middle text-center font-mono text-sm text-gray-500 whitespace-nowrap">{d.imei || '-'}</td>
                      <td className="px-4 py-3 align-middle text-center">
                        {d.total_repair_cost ? (
                          <span className="text-orange-600 font-medium">有</span>
                        ) : (
                          <span className="text-gray-400">無</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-center">
                        <div className="flex justify-center gap-1">
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

            {/* ページネーション */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>{total} 件中 {from}～{to} 件</span>
                <span className="text-gray-400">|</span>
                <span>表示件数:</span>
                {PAGE_SIZE_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handlePageSizeChange(s)}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${pageSize === s ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                {pageButtons().map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`px-3 py-1 text-xs border rounded ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ›
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}