import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Device } from '../types';

const EMPTY_FORM = {
  management_no: '',
  device_type: 'smartphone' as 'smartphone' | 'accessory',
  model_name: '',
  color: '',
  capacity: '',
  imei: '',
  carrier_sb: false,
  carrier_au: false,
  carrier_his: false,
  carrier_rakuten: false,
  condition_notes: '',
  check_appearance: '',
  check_boot: '',
  check_sim: '',
  check_charge: '',
  check_battery: '',
  purchase_price: '',
  supplier: '',
  purchase_date: '',
  arrival_date: '',
  wholesale_price: '',
};

export default function DeviceForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { apiFetch } = useApi();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    apiFetch<Device>(`/devices/${id}`).then((d) => {
      setForm({
        management_no: d.management_no || '',
        device_type: d.device_type,
        model_name: d.model_name || '',
        color: d.color || '',
        capacity: d.capacity || '',
        imei: d.imei || '',
        carrier_sb: !!d.carrier_sb,
        carrier_au: !!d.carrier_au,
        carrier_his: !!d.carrier_his,
        carrier_rakuten: !!d.carrier_rakuten,
        condition_notes: d.condition_notes || '',
        check_appearance: d.check_appearance || '',
        check_boot: d.check_boot || '',
        check_sim: d.check_sim || '',
        check_charge: d.check_charge || '',
        check_battery: d.check_battery != null ? String(d.check_battery) : '',
        purchase_price: d.purchase_price != null ? String(d.purchase_price) : '',
        supplier: d.supplier || '',
        purchase_date: d.purchase_date ? d.purchase_date.split('T')[0] : '',
        arrival_date: d.arrival_date ? d.arrival_date.split('T')[0] : '',
        wholesale_price: d.wholesale_price != null ? String(d.wholesale_price) : '',
      });
    }).catch(() => setError('端末情報の取得に失敗しました'));
  }, [id]);

  const handleSubmit = async () => {
    if (!form.model_name || !form.device_type) {
      setError('機種名と種別は必須です');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const toNum = (v: string) => v === '' ? null : parseFloat(v);
      const body = {
        ...form,
        check_battery: toNum(form.check_battery),
        purchase_price: toNum(form.purchase_price),
        wholesale_price: toNum(form.wholesale_price),
        purchase_date: form.purchase_date || null,
        arrival_date: form.arrival_date || null,
      };
      if (isEdit) {
        await apiFetch(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await apiFetch('/devices', { method: 'POST', body: JSON.stringify(body) });
      }
      navigate('/devices');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const section = 'bg-white rounded-xl border border-gray-200 p-6 space-y-4';

  const CHECK_OPTIONS = ['良好', '要確認', '不良', '-'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1 className="text-2xl font-bold text-gray-800">{isEdit ? '端末編集' : '端末登録'}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* 基本情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">基本情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>種別 *</label>
            <select className={input} value={form.device_type}
              onChange={(e) => setForm({ ...form, device_type: e.target.value as 'smartphone' | 'accessory' })}>
              <option value="smartphone">スマートフォン</option>
              <option value="accessory">周辺機器</option>
            </select>
          </div>
          <div>
            <label className={label}>管理番号</label>
            <input type="text" className={input} value={form.management_no}
              onChange={(e) => setForm({ ...form, management_no: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={label}>機種名 *</label>
            <input type="text" className={input} value={form.model_name}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })} />
          </div>
          <div>
            <label className={label}>カラー</label>
            <input type="text" className={input} value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div>
            <label className={label}>容量</label>
            <input type="text" className={input} value={form.capacity} placeholder="128GB"
              onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={label}>IMEI / シリアル番号</label>
            <input type="text" className={`${input} font-mono`} value={form.imei}
              onChange={(e) => setForm({ ...form, imei: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">キャリア対応</label>
          <div className="flex gap-4">
            {(['carrier_sb', 'carrier_au', 'carrier_his', 'carrier_rakuten'] as const).map((key) => {
              const labels = { carrier_sb: 'SoftBank', carrier_au: 'au', carrier_his: 'HIS', carrier_rakuten: '楽天' };
              return (
                <label key={key} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                  {labels[key]}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <label className={label}>商品状態備考</label>
          <textarea className={`${input} h-20 resize-none`} value={form.condition_notes}
            onChange={(e) => setForm({ ...form, condition_notes: e.target.value })} />
        </div>
      </div>

      {/* 動作確認 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">動作確認</h2>
        <div className="grid grid-cols-2 gap-4">
          {(['check_appearance', 'check_boot', 'check_sim', 'check_charge'] as const).map((key) => {
            const labels = { check_appearance: '外観', check_boot: '起動', check_sim: 'SIM', check_charge: '充電' };
            return (
              <div key={key}>
                <label className={label}>{labels[key]}</label>
                <select className={input} value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                  <option value="">未確認</option>
                  {CHECK_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            );
          })}
          <div>
            <label className={label}>バッテリー（%）</label>
            <input type="number" className={input} value={form.check_battery} min="0" max="100"
              onChange={(e) => setForm({ ...form, check_battery: e.target.value })} />
          </div>
        </div>
      </div>

      {/* 仕入情報 */}
      <div className={section}>
        <h2 className="text-base font-semibold text-gray-700">仕入情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>仕入先</label>
            <input type="text" className={input} value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <div>
            <label className={label}>仕入価格（税抜）</label>
            <input type="number" className={input} value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
          </div>
          <div>
            <label className={label}>仕入日</label>
            <input type="date" className={input} value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          </div>
          <div>
            <label className={label}>入荷日</label>
            <input type="date" className={input} value={form.arrival_date}
              onChange={(e) => setForm({ ...form, arrival_date: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className={label}>フォーカス卸価格（税抜）</label>
            <input type="number" className={input} value={form.wholesale_price}
              onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)}
          className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
          キャンセル
        </button>
        <button onClick={handleSubmit} disabled={submitting}
          className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40">
          {submitting ? '保存中...' : isEdit ? '更新する' : '登録する'}
        </button>
      </div>
    </div>
  );
}
