import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { DataverseCustomer, Device } from '../types';

export default function SellForm() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<DataverseCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<DataverseCustomer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    sale_method: '',
    sale_price: '',
    notes: '',
  });

  useEffect(() => {
    if (!id) return;
    apiFetch<Device>(`/devices/${id}`)
      .then(setDevice)
      .catch(() => setError('端末情報の取得に失敗しました'));
  }, [id]);

  const searchCustomers = async () => {
    if (!customerQuery) return;
    try {
      const results = await apiFetch<DataverseCustomer[]>(
        `/customers?q=${encodeURIComponent(customerQuery)}`
      );
      setCustomers(results);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSubmit = async () => {
    if (!form.sale_date || !form.sale_price) {
      setError('販売日と販売価格は必須です');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/devices/${id}/sell`, {
        method: 'POST',
        body: JSON.stringify({
          customer_dataverse_id: selectedCustomer?.accountid || null,
          customer_name: selectedCustomer?.name || null,
          sale_date: form.sale_date,
          sale_method: form.sale_method,
          sale_price: parseFloat(form.sale_price),
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
    <div className="h-full overflow-y-auto max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1 className="text-2xl font-bold text-gray-800">販売処理</h1>
      </div>

      {device && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
          <p><span className="text-gray-500">端末:</span> <span className="font-medium">{device.model_name} {device.color} {device.capacity}</span></p>
          <p><span className="text-gray-500">管理番号:</span> <span className="font-mono">{device.management_no || '-'}</span></p>
          <p><span className="text-gray-500">卸価格:</span> <span className="font-medium">¥{device.wholesale_price?.toLocaleString('ja-JP') || '-'}</span></p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* お客様選択（任意） */}
        <div>
          <label className={label}>お客様（任意）</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-medium text-blue-800">{selectedCustomer.name}</p>
              <button onClick={() => { setSelectedCustomer(null); setCustomers([]); }}
                className="text-xs text-blue-500 hover:text-blue-700">変更</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <input type="text" placeholder="会社名で検索..." className={input}
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCustomers()} />
                <button onClick={searchCustomers}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap">
                  検索
                </button>
              </div>
              {customers.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {customers.map((c) => (
                    <button key={c.accountid} onClick={() => setSelectedCustomer(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.address1_city} {c.telephone1}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className={label}>販売日 *</label>
          <input type="date" className={input} value={form.sale_date}
            onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
        </div>

        <div>
          <label className={label}>販売方法</label>
          <select className={input} value={form.sale_method}
            onChange={(e) => setForm({ ...form, sale_method: e.target.value })}>
            <option value="">選択してください</option>
            <option value="店舗">店舗</option>
            <option value="WEB">WEB</option>
            <option value="営業卸">営業卸</option>
          </select>
        </div>

        <div>
          <label className={label}>販売価格（税抜） *</label>
          <input type="number" className={input} value={form.sale_price}
            onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="0" />
          {device?.wholesale_price && form.sale_price && (
            <p className="mt-1 text-sm text-green-600">
              利益: ¥{(parseFloat(form.sale_price) - device.wholesale_price).toLocaleString('ja-JP')}
            </p>
          )}
        </div>

        <div>
          <label className={label}>備考</label>
          <textarea className={`${input} h-20 resize-none`} value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)}
          className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
          キャンセル
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40">
          {submitting ? '処理中...' : '販売処理を完了する'}
        </button>
      </div>
    </div>
  );
}
