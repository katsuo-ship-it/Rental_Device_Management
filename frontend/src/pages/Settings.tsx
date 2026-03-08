import { useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';

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
      const result = await uploadFile<{ success: number; errors: string[] }>('/import/excel', file);
      setImportResult(result);
    } catch (e) {
      setImportResult({ success: 0, errors: [(e as Error).message] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">設定</h1>

      {/* Excelインポート */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Excelデータ移行</h2>
        <p className="text-sm text-gray-600">
          既存の「旧HIS三宮_販売・レンタル用端末管理台帳」からデータを移行します。
          「レンタル端末」「レンタル（端末本体以外）」シートの全データが対象です。
        </p>
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0 file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40"
          >
            {importing ? '移行中...' : 'インポート実行'}
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
