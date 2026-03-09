import { useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';

const CSV_HEADERS = [
  'management_no', 'device_type', 'model_name', 'color', 'capacity', 'imei',
  'carrier_sb', 'carrier_au', 'carrier_his', 'carrier_rakuten', 'condition_notes',
  'status', 'purchase_price', 'supplier', 'wholesale_price',
  'customer_name', 'customer_phone', 'delivery_name', 'delivery_address', 'delivery_phone',
  'contract_start_date', 'billing_start_date', 'contract_end_date',
  'contract_months', 'auto_renewal', 'min_contract_months', 'total_contract_months',
  'monthly_wholesale_price', 'monthly_end_user_price',
  'natural_failure_coverage', 'op_coverage', 'op_coverage_details', 'op_coverage_price',
  'notes', 'sale_date', 'sale_method', 'sale_price',
];

const CSV_SAMPLE = [
  'RAW0001', 'smartphone', 'iPhone 15', 'ブラック', '128GB', '123456789012345',
  '0', '1', '0', '0', '',
  'renting', '30000', '仕入先A', '35000',
  '株式会社サンプル', '06-1234-5678', '山田太郎', '大阪府大阪市1-1-1', '06-8765-4321',
  '2024-04-01', '2024-04-01', '2025-03-31',
  '12', '0', '12', '12',
  '3000', '4000',
  '0', '1', 'OP保証スタンダード', '500',
  '', '', '', '',
];

function downloadCsvTemplate() {
  const bom = '\uFEFF';
  const rows = [CSV_HEADERS.join(','), CSV_SAMPLE.map(v => v.includes(',') ? `"${v}"` : v).join(',')];
  const blob = new Blob([bom + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'device_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { uploadFile } = useApi();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const result = await uploadFile<{ success: number; errors: string[] }>('/import/csv', file);
      setImportResult(result);
    } catch (e) {
      setImportResult({ success: 0, errors: [(e as Error).message] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">設定</h1>

      {/* CSVインポート */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">CSVデータインポート</h2>
        <p className="text-sm text-gray-600">
          CSVテンプレートをダウンロードし、データを入力してからインポートしてください。
          端末情報・契約情報・販売情報をまとめて登録できます。
        </p>
        <button
          onClick={downloadCsvTemplate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          CSVテンプレートをダウンロード
        </button>
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0 file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            {importing ? 'インポート中...' : 'インポート実行'}
          </button>
        </div>
        {importResult && (
          <div className={`rounded-lg p-4 text-sm ${importResult.errors.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
            <p className="font-medium text-green-800">成功: {importResult.success} 件</p>
            {importResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-orange-700 font-medium">エラー ({importResult.errors.length}件):</p>
                <ul className="mt-1 space-y-1">
                  {importResult.errors.slice(0, 10).map((e, i) => (
                    <li key={i} className="text-orange-600 text-xs">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Teams通知設定 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Teams通知</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium">通知ルール（固定）</p>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>契約終了 60日前に通知</li>
            <li>契約終了 30日前に通知</li>
            <li>契約終了 7日前に通知</li>
          </ul>
          <p className="mt-3">通知先チャンネルは Azure Logic Apps で設定済みです。</p>
        </div>
      </div>
    </div>
  );
}
