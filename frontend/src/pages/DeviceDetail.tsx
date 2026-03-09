import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Device } from '../types';

interface Repair {
  id: number;
  repair_date: string;
  repair_cost: number;
  description: string;
}

interface Sale {
  id: number;
  customer_name: string;
  sale_date: string;
  sale_method: string;
  sale_price: number;
  notes: string;
}

interface DeviceWithHistory extends Device {
  contract_id?: number;
  customer_name?: string;
  customer_dataverse_id?: string;
  contract_start_date?: string;
  billing_start_date?: string;
  contract_end_date?: string;
  contract_months?: number;
  auto_renewal?: boolean;
  min_contract_months?: number;
  monthly_wholesale_price?: number;
  monthly_end_user_price?: number;
  natural_failure_coverage?: boolean;
  op_coverage?: boolean;
  op_coverage_details?: string;
  op_coverage_price?: number;
  contract_notes?: string;
  contract_status?: string;
  repairs: Repair[];
  sales: Sale[];
}

const STATUS_LABELS: Record<string, string> = {
  in_stock: '在庫',
  renting: 'レンタル中',
  sold: '販売済み',
};

const STATUS_COLORS: Record<string, string> = {
  in_stock: 'bg-green-100 text-green-700',
  renting: 'bg-blue-100 text-blue-700',
  sold: 'bg-gray-100 text-gray-500',
};

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [device, setDevice] = useState<DeviceWithHistory | null>(null);
  const [error, setError] = useState('');

  // 修理記録フォーム（在庫端末用）
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [repairDate, setRepairDate] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [repairError, setRepairError] = useState('');

  const loadDevice = () => {
    if (!id) return;
    apiFetch<DeviceWithHistory>(`/devices/${id}`)
      .then(setDevice)
      .catch(() => setError('端末情報の取得に失敗しました'));
  };

  useEffect(() => { loadDevice(); }, [id]);

  const handleRepairSubmit = async () => {
    if (!repairDate || !repairCost || parseFloat(repairCost) <= 0) { setRepairError('修理日と修理費（1円以上）は必須です'); return; }
    setRepairSubmitting(true);
    setRepairError('');
    try {
      await apiFetch(`/devices/${id}/repairs`, {
        method: 'POST',
        body: JSON.stringify({
          repair_date: repairDate,
          repair_cost: parseFloat(repairCost),
          description: repairDesc || null,
        }),
      });
      setShowRepairForm(false);
      setRepairDate('');
      setRepairCost('');
      setRepairDesc('');
      loadDevice();
    } catch (e) {
      setRepairError((e as Error).message);
    } finally {
      setRepairSubmitting(false);
    }
  };

  const fmt = (n?: number) => n != null ? `¥${n.toLocaleString('ja-JP')}` : '-';
  const fmtDate = (d?: string) => d ? d.split('T')[0] : '-';

  const section = 'bg-white rounded-xl border border-gray-200 p-6 space-y-3';
  const rowCls = 'flex py-1.5 border-b border-gray-100 last:border-0 text-sm';
  const labelCls = 'text-gray-500 w-40 shrink-0';
  const valueCls = 'font-medium text-gray-800';

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
    </div>
  );

  if (!device) return <div className="py-16 text-center text-gray-500">読み込み中...</div>;

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
          <h1 className="text-2xl font-bold text-gray-800">{device.model_name}</h1>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[device.status]}`}>
            {STATUS_LABELS[device.status]}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/devices/${id}/edit`)}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            編集
          </button>
          {device.status === 'in_stock' && (
            <>
              <button
                onClick={() => navigate(`/contracts/new?deviceId=${id}`)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                貸出
              </button>
              <button
                onClick={() => navigate(`/devices/${id}/sell`)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                販売
              </button>
            </>
          )}
          {device.status === 'renting' && device.contract_id && (
            <button
              onClick={() => navigate(`/contracts/${device.contract_id}/return`)}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              返却処理
            </button>
          )}
        </div>
      </div>

      {/* 基本情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">基本情報</h2>
        <div className={rowCls}><span className={labelCls}>管理番号</span><span className={`${valueCls} font-mono`}>{device.management_no || '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>種別</span><span className={valueCls}>{device.device_type === 'smartphone' ? 'スマートフォン' : '周辺機器'}</span></div>
        <div className={rowCls}><span className={labelCls}>カラー / 容量</span><span className={valueCls}>{device.color || '-'} / {device.capacity || '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>IMEI</span><span className={`${valueCls} font-mono`}>{device.imei || '-'}</span></div>
        <div className={rowCls}>
          <span className={labelCls}>キャリア</span>
          <span className={valueCls}>
            {[device.carrier_sb && 'SoftBank', device.carrier_au && 'au', device.carrier_his && 'HIS', device.carrier_rakuten && '楽天']
              .filter(Boolean).join(' / ') || '-'}
          </span>
        </div>
        <div className={rowCls}><span className={labelCls}>商品状態備考</span><span className={valueCls}>{device.condition_notes || '-'}</span></div>
      </div>

      {/* 動作確認 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">動作確認</h2>
        <div className="grid grid-cols-2 gap-x-8">
          {[
            ['外観', device.check_appearance],
            ['起動', device.check_boot],
            ['SIM', device.check_sim],
            ['充電', device.check_charge],
            ['バッテリー', device.check_battery != null ? `${device.check_battery}%` : '-'],
          ].map(([l, v]) => (
            <div key={l} className={rowCls}>
              <span className={labelCls}>{l}</span>
              <span className={valueCls}>{v || '-'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 仕入情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">仕入情報</h2>
        <div className={rowCls}><span className={labelCls}>仕入先</span><span className={valueCls}>{device.supplier || '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>仕入価格</span><span className={valueCls}>{fmt(device.purchase_price)}</span></div>
        <div className={rowCls}><span className={labelCls}>卸価格</span><span className={valueCls}>{fmt(device.wholesale_price)}</span></div>
        <div className={rowCls}><span className={labelCls}>仕入日</span><span className={valueCls}>{fmtDate(device.purchase_date)}</span></div>
        <div className={rowCls}><span className={labelCls}>入荷日</span><span className={valueCls}>{fmtDate(device.arrival_date)}</span></div>
      </div>

      {/* 現在のレンタル契約 */}
      {device.contract_status === 'active' && (
        <div className={section}>
          <h2 className="text-base font-semibold text-gray-700">現在のレンタル契約</h2>
          <div className={rowCls}><span className={labelCls}>お客様名</span><span className={valueCls}>{device.customer_name || '-'}</span></div>
          <div className={rowCls}><span className={labelCls}>契約期間</span><span className={valueCls}>{fmtDate(device.contract_start_date)} 〜 {fmtDate(device.contract_end_date)}</span></div>
          <div className={rowCls}><span className={labelCls}>月額卸価格</span><span className={valueCls}>{fmt(device.monthly_wholesale_price)}</span></div>
          <div className={rowCls}><span className={labelCls}>月額エンドU価格</span><span className={valueCls}>{fmt(device.monthly_end_user_price)}</span></div>
          <div className={rowCls}><span className={labelCls}>自動更新</span><span className={valueCls}>{device.auto_renewal ? 'あり' : 'なし'}</span></div>
          <div className={rowCls}><span className={labelCls}>OP保証</span><span className={valueCls}>{device.op_coverage ? `あり（${device.op_coverage_details}）` : 'なし'}</span></div>
          {device.contract_notes && (
            <div className={rowCls}><span className={labelCls}>備考</span><span className={valueCls}>{device.contract_notes}</span></div>
          )}
        </div>
      )}

      {/* 修理履歴 */}
      <div className={section}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-700">修理履歴</h2>
          {device.status === 'in_stock' && !showRepairForm && (
            <button
              onClick={() => setShowRepairForm(true)}
              className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              + 修理記録を追加
            </button>
          )}
        </div>

        {/* 修理記録追加フォーム */}
        {showRepairForm && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-orange-800">修理記録を追加</h3>
            {repairError && <p className="text-sm text-red-600">{repairError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">修理日 *</label>
                <input
                  type="date"
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                  value={repairDate}
                  onChange={(e) => setRepairDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">修理費（税抜）*</label>
                <input
                  type="number"
                  className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                  min="1"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">修理内容</label>
              <input
                type="text"
                className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full"
                value={repairDesc}
                onChange={(e) => setRepairDesc(e.target.value)}
                placeholder="画面交換、バッテリー交換など"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowRepairForm(false); setRepairError(''); }}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRepairSubmit}
                disabled={repairSubmitting}
                className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-40"
              >
                {repairSubmitting ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        )}

        {device.repairs.length === 0 ? (
          <p className="text-sm text-gray-500">修理履歴はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-medium">修理日</th>
                <th className="pb-2 font-medium">修理費</th>
                <th className="pb-2 font-medium">内容</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {device.repairs.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 text-gray-600">{fmtDate(r.repair_date)}</td>
                  <td className="py-2 text-orange-600 font-medium">{fmt(r.repair_cost)}</td>
                  <td className="py-2 text-gray-700">{r.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 販売履歴 */}
      {device.sales.length > 0 && (
        <div className={section}>
          <h2 className="text-base font-semibold text-gray-700">販売履歴</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-medium">販売日</th>
                <th className="pb-2 font-medium">お客様</th>
                <th className="pb-2 font-medium">販売方法</th>
                <th className="pb-2 font-medium">販売価格</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {device.sales.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-gray-600">{fmtDate(s.sale_date)}</td>
                  <td className="py-2 text-gray-700">{s.customer_name || '-'}</td>
                  <td className="py-2 text-gray-700">{s.sale_method || '-'}</td>
                  <td className="py-2 text-green-700 font-medium">{fmt(s.sale_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
