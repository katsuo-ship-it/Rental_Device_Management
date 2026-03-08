import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { RentalContract } from '../types';

export default function ReturnForm() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [contract, setContract] = useState<RentalContract | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    return_date: new Date().toISOString().split('T')[0],
    condition_ok: true,
    condition_notes: '',
    repair_cost: '',
    repair_description: '',
  });

  useEffect(() => {
    if (!id) return;
    apiFetch<RentalContract>(`/contracts/${id}`)
      .then(setContract)
      .catch(() => setError('契約情報の取得に失敗しました'));
  }, [id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/contracts/${id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          return_date: form.return_date,
          condition_ok: form.condition_ok,
          condition_notes: form.condition_notes,
          repair_cost: parseFloat(form.repair_cost) || 0,
          repair_description: form.repair_description,
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
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1 className="text-2xl font-bold text-gray-800">返却処理</h1>
      </div>

      {contract && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
          <p><span className="text-gray-500">お客様:</span> <span className="font-medium">{contract.customer_name}</span></p>
          <p><span className="text-gray-500">端末:</span> <span className="font-medium">{contract.model_name} {contract.color}</span></p>
          <p><span className="text-gray-500">契約終了日:</span> {contract.contract_end_date}</p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className={label}>返却日 *</label>
          <input type="date" className={input} value={form.return_date}
            onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">端末の状態</label>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer
              ${form.condition_ok ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
              <input type="radio" name="condition" checked={form.condition_ok}
                onChange={() => setForm({ ...form, condition_ok: true })} />
              動作OK
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer
              ${!form.condition_ok ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500'}`}>
              <input type="radio" name="condition" checked={!form.condition_ok}
                onChange={() => setForm({ ...form, condition_ok: false })} />
              修理が必要
            </label>
          </div>
        </div>

        <div>
          <label className={label}>状態メモ</label>
          <textarea className={`${input} h-20 resize-none`} value={form.condition_notes}
            onChange={(e) => setForm({ ...form, condition_notes: e.target.value })}
            placeholder="傷・割れなどの状態を記録..." />
        </div>

        {!form.condition_ok && (
          <div className="space-y-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="text-sm font-semibold text-orange-800">修理費の記録</h3>
            <div>
              <label className={label}>修理費（税抜）</label>
              <input type="number" className={input} value={form.repair_cost}
                onChange={(e) => setForm({ ...form, repair_cost: e.target.value })}
                placeholder="0" />
            </div>
            <div>
              <label className={label}>修理内容</label>
              <input type="text" className={input} value={form.repair_description}
                onChange={(e) => setForm({ ...form, repair_description: e.target.value })}
                placeholder="画面交換など" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {submitting ? '処理中...' : '返却処理を完了する'}
        </button>
      </div>
    </div>
  );
}
