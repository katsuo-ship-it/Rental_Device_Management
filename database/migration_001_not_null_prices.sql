-- ============================================
-- Migration 001: rental_contracts 月額価格 NOT NULL 化
-- 実行前に必ずバックアップを取得してください
-- Azure SQL Database 対応
-- ============================================

-- Step 1: NULL レコードを確認（実行前に必ずチェック）
SELECT
  id,
  customer_name,
  monthly_wholesale_price,
  monthly_end_user_price,
  contract_start_date,
  contract_end_date,
  status
FROM rental_contracts
WHERE monthly_wholesale_price IS NULL
   OR monthly_end_user_price IS NULL;

-- Step 2: NULL を 0 で埋める（Excelインポート由来の不完全データに対応）
-- ※ 実際の卸価格・販売価格が判明している場合は 0 以外の値に更新してください
UPDATE rental_contracts
SET
  monthly_wholesale_price = COALESCE(monthly_wholesale_price, 0),
  monthly_end_user_price  = COALESCE(monthly_end_user_price,  0)
WHERE monthly_wholesale_price IS NULL
   OR monthly_end_user_price IS NULL;

-- Step 3: NULL がなくなったことを確認
-- 以下のクエリが 0 件を返すことを確認してから Step 4 を実行してください
SELECT COUNT(*) AS null_count
FROM rental_contracts
WHERE monthly_wholesale_price IS NULL
   OR monthly_end_user_price IS NULL;

-- Step 4: NOT NULL 制約を追加
ALTER TABLE rental_contracts
  ALTER COLUMN monthly_wholesale_price DECIMAL(12,2) NOT NULL;

ALTER TABLE rental_contracts
  ALTER COLUMN monthly_end_user_price DECIMAL(12,2) NOT NULL;

-- Step 5: 完了確認
SELECT
  COLUMN_NAME,
  IS_NULLABLE,
  DATA_TYPE,
  NUMERIC_PRECISION,
  NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'rental_contracts'
  AND COLUMN_NAME IN ('monthly_wholesale_price', 'monthly_end_user_price');
