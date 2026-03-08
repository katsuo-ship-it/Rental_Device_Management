import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { DataverseCustomer, Device } from '../types';

export default function RentalForm() {
  const { apiFetch, apiFetchWithDataverse } = useApi();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');

  const [step, setStep] = useState(1);
  const [device, setDevice] = useState<Device | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<DataverseCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<DataverseCustomer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    contract_start_date: '',
    billing_start_date: '',
    contract_end_date: '',
    contract_months: '',
    auto_renewal: false,
    min_contract_months: '',
    monthly_wholesale_price: '',
    monthly_end_user_price: '',
    natural_failure_coverage: false,
    op_coverage: false,
    op_coverage_details: '',
    op_coverage_price: '',
    delivery_name: '',
    delivery_address: '',
    delivery_phone: '',
    notes: '',
  });

  useEffect(() => {
    if (deviceId) {
      apiFetch<Device>(`/devices/${deviceId}`).then(setDevice);
    }
  }, [deviceId]);

  const searchCustomers = async () => {
    if (!customerQuery) return;
    try {
      const results = await apiFetchWithDataverse<DataverseCustomer[]>(
        `/customers?q=${encodeURIComponent(customerQuery)}`
      );
      setCustomers(results);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !device) return;
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          device_id: device.id,
          customer_dataverse_id: selectedCustomer.accountid,
          customer_name: selectedCustomer.name,
          customer_phone: selectedCustomer.telephone1,
          delivery_name: form.delivery_name,
          delivery_address: form.delivery_address,
          delivery_phone: form.delivery_phone,
          contract_start_date: form.contract_start_date,
          billing_start_date: form.billing_start_date,
          contract_end_date: form.contract_end_date,
          contract_months: parseInt(form.contract_months),
          auto_renewal: form.auto_renewal,
          min_contract_months: parseInt(form.min_contract_months),
          monthly_wholesale_price: parseFloat(form.monthly_wholesale_price),
          monthly_end_user_price: parseFloat(form.monthly_end_user_price),
          natural_failure_coverage: form.natural_failure_coverage,
          op_coverage: form.op_coverage,
          op_coverage_details: form.op_coverage_details,
          op_coverage_price: parseFloat(form.op_coverage_price) || 0,
          notes: form.notes,
        }),
      });
      navigate('/devices');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1 className="text-2xl font-bold text-gray-800">レンタル登録</h1>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 text-sm">
        {['端末確認', 'お客様選択', '契約内容', '料金', '保証', '確認'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
              ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={step === i + 1 ? 'text-blue-700 font-medium' : 'text-gray-500'}>{s}</span>
            {i < 5 && <span className="text-gray-300">›</span>}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* ステップ1: 端末確認 */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">端末確認</h2>
            {device ? (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><span className="text-gray-500 text-sm">機種名:</span> <span className="font-medium">{device.model_name}</span></p>
                <p><span className="text-gray-500 text-sm">カラー/容量:</span> <span className="font-medium">{device.color} / {device.capacity}</span></p>
                <p><span className="text-gray-500 text-sm">管理番号:</span> <span className="font-mono text-sm">{device.management_no}</span></p>
                <p><span className="text-gray-500 text-sm">IMEI:</span> <span className="font-mono text-sm">{device.imei}</span></p>
              </div>
            ) : (
              <p className="text-gray-500">端末を選択してください（端末一覧から「貸出」ボタンで起動）</p>
            )}
          </div>
        )}

        {/* ステップ2: お客様選択 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">お客様選択</h2>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="会社名で検索..."
                className={input}
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchCustomers()}
              />
              <button
                onClick={searchCustomers}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap"
              >
                検索
              </button>
            </div>
            {selectedCustomer && (
              <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">選択済み: {selectedCustomer.name}</p>
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customers.map((c) => (
                <button
                  key={c.accountid}
                  onClick={() => setSelectedCustomer(c)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors
                    ${selectedCustomer?.accountid === c.accountid
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-gray-500 text-xs">{c.address1_city} {c.telephone1}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ステップ3: 契約内容 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">契約内容</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>契約開始日 *</label>
                <input type="date" className={input} value={form.contract_start_date}
                  onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
              </div>
              <div>
                <label className={label}>課金開始日</label>
                <input type="date" className={input} value={form.billing_start_date}
                  onChange={(e) => setForm({ ...form, billing_start_date: e.target.value })} />
              </div>
              <div>
                <label className={label}>契約終了日 *</label>
                <input type="date" className={input} value={form.contract_end_date}
                  onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
              </div>
              <div>
                <label className={label}>契約期間（月）</label>
                <input type="number" className={input} value={form.contract_months}
                  onChange={(e) => setForm({ ...form, contract_months: e.target.value })} />
              </div>
              <div>
                <label className={label}>最低契約期間（月）</label>
                <input type="number" className={input} value={form.min_contract_months}
                  onChange={(e) => setForm({ ...form, min_contract_months: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="auto_renewal" checked={form.auto_renewal}
                  onChange={(e) => setForm({ ...form, auto_renewal: e.target.checked })} />
                <label htmlFor="auto_renewal" className="text-sm text-gray-700">自動更新あり</label>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">配送先</h3>
              <div>
                <label className={label}>配送先名</label>
                <input type="text" className={input} value={form.delivery_name}
                  onChange={(e) => setForm({ ...form, delivery_name: e.target.value })} />
              </div>
              <div>
                <label className={label}>配送先住所</label>
                <input type="text" className={input} value={form.delivery_address}
                  onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
              </div>
              <div>
                <label className={label}>配送先電話</label>
                <input type="text" className={input} value={form.delivery_phone}
                  onChange={(e) => setForm({ ...form, delivery_phone: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* ステップ4: 料金 */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">料金設定</h2>
            <div className="space-y-4">
              <div>
                <label className={label}>月額卸価格（税抜）</label>
                <input type="number" className={input} value={form.monthly_wholesale_price}
                  onChange={(e) => setForm({ ...form, monthly_wholesale_price: e.target.value })} />
              </div>
              <div>
                <label className={label}>月額エンドユーザー価格（税抜）</label>
                <input type="number" className={input} value={form.monthly_end_user_price}
                  onChange={(e) => setForm({ ...form, monthly_end_user_price: e.target.value })} />
              </div>
              {form.monthly_wholesale_price && form.monthly_end_user_price && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    月額利益: <span className="font-bold text-lg">
                      ¥{(parseFloat(form.monthly_end_user_price) - parseFloat(form.monthly_wholesale_price)).toLocaleString('ja-JP')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ステップ5: 保証 */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">保証設定</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.natural_failure_coverage}
                  onChange={(e) => setForm({ ...form, natural_failure_coverage: e.target.checked })} />
                <span className="text-sm font-medium">自然故障保険あり</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.op_coverage}
                  onChange={(e) => setForm({ ...form, op_coverage: e.target.checked })} />
                <span className="text-sm font-medium">OP保証あり</span>
              </label>
              {form.op_coverage && (
                <>
                  <div>
                    <label className={label}>OP保証内容</label>
                    <input type="text" className={input} value={form.op_coverage_details}
                      onChange={(e) => setForm({ ...form, op_coverage_details: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>OP保証加入価格</label>
                    <input type="number" className={input} value={form.op_coverage_price}
                      onChange={(e) => setForm({ ...form, op_coverage_price: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <label className={label}>備考</label>
                <textarea className={`${input} h-24 resize-none`} value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {/* ステップ6: 確認 */}
        {step === 6 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">内容確認</h2>
            <dl className="space-y-2 text-sm">
              <Row label="端末" value={`${device?.model_name} ${device?.color} ${device?.capacity}`} />
              <Row label="お客様" value={selectedCustomer?.name || ''} />
              <Row label="契約期間" value={`${form.contract_start_date} 〜 ${form.contract_end_date}`} />
              <Row label="契約月数" value={`${form.contract_months}ヶ月`} />
              <Row label="自動更新" value={form.auto_renewal ? 'あり' : 'なし'} />
              <Row label="月額卸価格" value={`¥${parseFloat(form.monthly_wholesale_price || '0').toLocaleString('ja-JP')}`} />
              <Row label="月額エンドU価格" value={`¥${parseFloat(form.monthly_end_user_price || '0').toLocaleString('ja-JP')}`} />
              <Row label="自然故障保険" value={form.natural_failure_coverage ? 'あり' : 'なし'} />
              <Row label="OP保証" value={form.op_coverage ? `あり (${form.op_coverage_details})` : 'なし'} />
            </dl>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          ← 戻る
        </button>
        {step < 6 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && !device) ||
              (step === 2 && !selectedCustomer) ||
              (step === 3 && (!form.contract_start_date || !form.contract_end_date)) ||
              (step === 4 && (!form.monthly_wholesale_price || !form.monthly_end_user_price))
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            次へ →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40"
          >
            {submitting ? '登録中...' : '登録する'}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-1.5 border-b border-gray-100">
      <dt className="text-gray-500 w-36 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  );
}
