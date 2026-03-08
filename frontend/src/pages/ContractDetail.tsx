import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { RentalContractDetail } from '../types';
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

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [contract, setContract] = useState<RentalContractDetail | null>(null);
  const [error, setError] = useState('');

  // キャンセルモーダル
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // 更新モーダル
  const [showRenew, setShowRenew] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState('');

  const load = () => {
    if (!id) return;
    apiFetch<RentalContractDetail>(`/contracts/${id}`)
      .then(setContract)
      .catch(() => setError('契約情報の取得に失敗しました'));
  };

  useEffect(() => { load(); }, [id]);

  const fmt = (n?: number) => n != null ? `¥${n.toLocaleString('ja-JP')}` : '-';
  const fmtDate = (d?: string) => d ? format(new Date(d), 'yyyy/MM/dd', { locale: ja }) : '-';

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await apiFetch(`/contracts/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancel_reason: cancelReason }),
      });
      setShowCancel(false);
      load();
    } catch (e) {
      setCancelError((e as Error).message);
    } finally {
      setCancelling(false);
    }
  };

  const handleRenew = async () => {
    if (!newEndDate) { setRenewError('新しい終了日を入力してください'); return; }
    setRenewing(true);
    setRenewError('');
    try {
      await apiFetch(`/contracts/${id}/renew`, {
        method: 'POST',
        body: JSON.stringify({ new_end_date: newEndDate }),
      });
      setShowRenew(false);
      setNewEndDate('');
      load();
    } catch (e) {
      setRenewError((e as Error).message);
    } finally {
      setRenewing(false);
    }
  };

  const section = 'bg-white rounded-xl border border-gray-200 p-6 space-y-3';
  const rowCls = 'flex py-1.5 border-b border-gray-100 last:border-0 text-sm';
  const labelCls = 'text-gray-500 w-44 shrink-0';
  const valueCls = 'font-medium text-gray-800';

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
    </div>
  );
  if (!contract) return <div className="py-16 text-center text-gray-500">読み込み中...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
          <h1 className="text-2xl font-bold text-gray-800">契約詳細</h1>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[contract.status]}`}>
            {STATUS_LABELS[contract.status]}
          </span>
        </div>
        {contract.status === 'active' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowRenew(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              契約更新
            </button>
            <button
              onClick={() => navigate(`/contracts/${id}/return`)}
              className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              返却処理
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>

      {/* 端末情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">端末情報</h2>
        <div className={rowCls}><span className={labelCls}>機種名</span><span className={valueCls}>{contract.model_name || '-'} {contract.color || ''}</span></div>
        <div className={rowCls}><span className={labelCls}>容量</span><span className={valueCls}>{contract.capacity || '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>管理番号</span><span className={`${valueCls} font-mono`}>{contract.management_no || '-'}</span></div>
        <div className={rowCls}>
          <span className={labelCls}>端末詳細</span>
          <button
            onClick={() => navigate(`/devices/${contract.device_id}`)}
            className="text-blue-600 hover:underline text-sm font-medium"
          >
            端末ページを開く →
          </button>
        </div>
      </div>

      {/* 契約基本情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">契約情報</h2>
        <div className={rowCls}><span className={labelCls}>お客様名</span><span className={valueCls}>{contract.customer_name}</span></div>
        <div className={rowCls}><span className={labelCls}>連絡先</span><span className={valueCls}>{contract.customer_phone || '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>契約開始日</span><span className={valueCls}>{fmtDate(contract.contract_start_date)}</span></div>
        <div className={rowCls}><span className={labelCls}>課金開始日</span><span className={valueCls}>{fmtDate(contract.billing_start_date)}</span></div>
        <div className={rowCls}><span className={labelCls}>契約終了日</span><span className={valueCls}>{fmtDate(contract.contract_end_date)}</span></div>
        <div className={rowCls}><span className={labelCls}>契約期間</span><span className={valueCls}>{contract.contract_months != null ? `${contract.contract_months}ヶ月` : '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>累計契約期間</span><span className={valueCls}>{contract.total_contract_months != null ? `${contract.total_contract_months}ヶ月` : '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>最低契約期間</span><span className={valueCls}>{contract.min_contract_months != null ? `${contract.min_contract_months}ヶ月` : '-'}</span></div>
        <div className={rowCls}><span className={labelCls}>自動更新</span><span className={valueCls}>{contract.auto_renewal ? 'あり' : 'なし'}</span></div>
      </div>

      {/* 配送先 */}
      {(contract.delivery_name || contract.delivery_address) && (
        <div className={section}>
          <h2 className="text-base font-semibold text-gray-700">配送先</h2>
          <div className={rowCls}><span className={labelCls}>宛名</span><span className={valueCls}>{contract.delivery_name || '-'}</span></div>
          <div className={rowCls}><span className={labelCls}>住所</span><span className={valueCls}>{contract.delivery_address || '-'}</span></div>
          <div className={rowCls}><span className={labelCls}>電話</span><span className={valueCls}>{contract.delivery_phone || '-'}</span></div>
        </div>
      )}

      {/* 料金情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">料金情報</h2>
        <div className={rowCls}><span className={labelCls}>月額卸価格</span><span className={valueCls}>{fmt(contract.monthly_wholesale_price)}</span></div>
        <div className={rowCls}><span className={labelCls}>月額エンドU価格</span><span className={valueCls}>{fmt(contract.monthly_end_user_price)}</span></div>
        <div className={rowCls}><span className={labelCls}>OP保証</span><span className={valueCls}>{contract.op_coverage ? `あり（${contract.op_coverage_details || ''}）` : 'なし'}</span></div>
        {contract.op_coverage && (
          <div className={rowCls}><span className={labelCls}>OP保証料</span><span className={valueCls}>{fmt(contract.op_coverage_price)}</span></div>
        )}
        <div className={rowCls}><span className={labelCls}>自然故障保険</span><span className={valueCls}>{contract.natural_failure_coverage ? 'あり' : 'なし'}</span></div>
        <div className={rowCls}>
          <span className={labelCls}>月額利益</span>
          <span className="font-bold text-green-700">
            {contract.monthly_end_user_price != null && contract.monthly_wholesale_price != null
              ? fmt((contract.monthly_end_user_price + (contract.op_coverage_price || 0)) - contract.monthly_wholesale_price)
              : '-'}
          </span>
        </div>
        {contract.notes && (
          <div className={rowCls}><span className={labelCls}>備考</span><span className={valueCls}>{contract.notes}</span></div>
        )}
      </div>

      {/* 修理履歴 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">修理履歴（この契約分）</h2>
        {contract.repairs.length === 0 ? (
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
              {contract.repairs.map((r) => (
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

      {/* キャンセルモーダル */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-800">契約をキャンセルしますか？</h3>
            <p className="text-sm text-gray-500">端末のステータスが「在庫」に戻ります。この操作は取り消せません。</p>
            {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
            <div>
              <label className="block text-sm text-gray-700 mb-1">キャンセル理由（任意）</label>
              <input
                type="text"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCancel(false); setCancelReason(''); setCancelError(''); }}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40"
              >
                {cancelling ? '処理中...' : 'キャンセル実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 更新モーダル */}
      {showRenew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-gray-800">契約更新</h3>
            <p className="text-sm text-gray-500">
              現在の終了日: <strong>{fmtDate(contract.contract_end_date)}</strong>
            </p>
            {renewError && <p className="text-sm text-red-600">{renewError}</p>}
            <div>
              <label className="block text-sm text-gray-700 mb-1">新しい契約終了日 *</label>
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                value={newEndDate}
                min={contract.contract_end_date?.split('T')[0]}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRenew(false); setNewEndDate(''); setRenewError(''); }}
                className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRenew}
                disabled={renewing}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                {renewing ? '更新中...' : '更新する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
