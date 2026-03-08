-- ============================================
-- 携帯レンタル管理システム データベーススキーマ
-- Azure SQL Database
-- ============================================

-- 端末テーブル
CREATE TABLE devices (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    management_no   NVARCHAR(50),                          -- 管理番号（NULL許容・空文字禁止はアプリ側で保証）
    device_type     NVARCHAR(20)    NOT NULL,              -- 種別: 'smartphone' | 'accessory'
    model_name      NVARCHAR(100)   NOT NULL,              -- 機種名
    color           NVARCHAR(50),                          -- 端末カラー
    capacity        NVARCHAR(20),                          -- 容量 (64GB等)
    imei            NVARCHAR(20),                          -- IMEI/シリアル番号
    carrier_sb      BIT DEFAULT 0,                        -- SoftBank対応
    carrier_au      BIT DEFAULT 0,                        -- au対応
    carrier_his     BIT DEFAULT 0,                        -- HIS対応
    carrier_rakuten BIT DEFAULT 0,                        -- 楽天対応
    condition_notes NVARCHAR(500),                         -- 商品状態備考
    -- ステータス: 'in_stock' | 'renting' | 'sold'
    status          NVARCHAR(20)    NOT NULL DEFAULT 'in_stock',
    -- 動作確認
    check_appearance NVARCHAR(10),                         -- 外観
    check_boot       NVARCHAR(10),                         -- 起動
    check_sim        NVARCHAR(10),                         -- SIM
    check_charge     NVARCHAR(10),                         -- 充電
    check_battery    DECIMAL(5,2),                         -- バッテリー(%)
    -- 仕入情報
    purchase_price   DECIMAL(12,2),                        -- 仕入価格(税抜)
    supplier         NVARCHAR(100),                        -- 仕入先
    purchase_date    DATE,                                  -- 仕入日
    arrival_date     DATE,                                  -- 入荷日
    -- 卸価格
    wholesale_price  DECIMAL(12,2),                        -- フォーカス卸価格(税抜)
    created_at       DATETIME2       DEFAULT GETDATE(),
    updated_at       DATETIME2       DEFAULT GETDATE()
);

-- レンタル契約テーブル
CREATE TABLE rental_contracts (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    device_id               INT             NOT NULL REFERENCES devices(id),
    -- Dataverseの顧客ID (account entity) — Excelインポート時はNULL許容
    customer_dataverse_id   NVARCHAR(100),
    customer_name           NVARCHAR(200)   NOT NULL,      -- 表示用キャッシュ
    customer_phone          NVARCHAR(50),                  -- 連絡先
    -- 配送先
    delivery_name           NVARCHAR(200),
    delivery_address        NVARCHAR(500),
    delivery_phone          NVARCHAR(50),
    -- 契約期間
    contract_start_date     DATE            NOT NULL,      -- 契約開始日
    billing_start_date      DATE,                          -- 課金開始日
    contract_end_date       DATE            NOT NULL,      -- 契約終了日
    contract_months         INT,                           -- 契約期間(月)
    auto_renewal            BIT DEFAULT 0,                 -- 自動更新
    min_contract_months     INT,                           -- 最低契約期間(月)
    total_contract_months   INT DEFAULT 0,                 -- 累計契約期間(月)
    -- 料金
    monthly_wholesale_price DECIMAL(12,2),                 -- 月額卸価格
    monthly_end_user_price  DECIMAL(12,2),                 -- 月額エンドユーザー価格
    -- 保証
    natural_failure_coverage BIT DEFAULT 0,                -- 自然故障保険
    op_coverage             BIT DEFAULT 0,                 -- OP保証
    op_coverage_details     NVARCHAR(200),                 -- OP保証内容
    op_coverage_price       DECIMAL(12,2),                 -- OP保証加入価格
    -- ステータス: 'active' | 'returned' | 'cancelled'
    status                  NVARCHAR(20)    NOT NULL DEFAULT 'active',
    notes                   NVARCHAR(1000),                -- 備考
    created_at              DATETIME2       DEFAULT GETDATE(),
    updated_at              DATETIME2       DEFAULT GETDATE()
);

-- 返却テーブル
CREATE TABLE returns (
    id                  INT IDENTITY(1,1) PRIMARY KEY,
    contract_id         INT             NOT NULL REFERENCES rental_contracts(id),
    device_id           INT             NOT NULL REFERENCES devices(id),
    return_date         DATE            NOT NULL,          -- 返却日
    condition_ok        BIT DEFAULT 1,                     -- 動作OK
    condition_notes     NVARCHAR(500),                     -- 状態備考
    created_at          DATETIME2       DEFAULT GETDATE()
);

-- 修理テーブル
CREATE TABLE repairs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    contract_id     INT             REFERENCES rental_contracts(id), -- NULL許容（在庫端末の単独修理に対応）
    device_id       INT             NOT NULL REFERENCES devices(id),
    repair_date     DATE            NOT NULL,              -- 修理日
    repair_cost     DECIMAL(12,2)   NOT NULL,              -- 修理費(税抜)
    description     NVARCHAR(500),                         -- 修理内容
    created_at      DATETIME2       DEFAULT GETDATE()
);

-- 販売テーブル
CREATE TABLE sales (
    id                      INT IDENTITY(1,1) PRIMARY KEY,
    device_id               INT             NOT NULL REFERENCES devices(id),
    customer_dataverse_id   NVARCHAR(100),                 -- Dataverse顧客ID
    customer_name           NVARCHAR(200),                 -- 顧客名キャッシュ
    sale_date               DATE            NOT NULL,      -- 販売日
    sale_method             NVARCHAR(50),                  -- 販売方法 (店舗/WEB/営業卸)
    sale_price              DECIMAL(12,2)   NOT NULL,      -- 販売価格(税抜)
    notes                   NVARCHAR(500),
    created_at              DATETIME2       DEFAULT GETDATE()
);

-- アラート通知ログ
CREATE TABLE alert_logs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    contract_id     INT             NOT NULL REFERENCES rental_contracts(id),
    alert_type      NVARCHAR(20)    NOT NULL,              -- '60days' | '30days' | '7days'
    sent_date       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE), -- 送信日（重複防止用）
    sent_at         DATETIME2       DEFAULT GETDATE(),
    success         BIT DEFAULT 1,
    -- 同一契約・同一アラート種別は1日1件のみ（Logic Appsリトライによる重複を防止）
    CONSTRAINT UQ_alert_logs_contract_day UNIQUE (contract_id, alert_type, sent_date)
);

-- インデックス
CREATE INDEX IX_devices_status ON devices(status);
-- management_no: NULL・空文字を除いた範囲で一意（管理番号未入力の端末を複数登録可能にする）
CREATE UNIQUE INDEX IX_devices_management_no
  ON devices(management_no)
  WHERE management_no IS NOT NULL AND management_no <> '';
CREATE INDEX IX_rental_contracts_device_id ON rental_contracts(device_id);
CREATE INDEX IX_rental_contracts_end_date ON rental_contracts(contract_end_date);
CREATE INDEX IX_rental_contracts_status ON rental_contracts(status);
CREATE INDEX IX_rental_contracts_customer ON rental_contracts(customer_dataverse_id);

-- ============================================
-- Migration: 監査ログテーブル（初回構築後に追加実行）
-- ============================================
CREATE TABLE audit_logs (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    table_name  NVARCHAR(50)    NOT NULL,              -- 操作対象テーブル
    record_id   INT             NOT NULL,               -- 操作対象レコードID
    action      NVARCHAR(20)    NOT NULL,               -- 'CREATE'|'CANCEL'|'RETURN'|'RENEW'|'SELL'|'REPAIR'
    user_oid    NVARCHAR(100),                          -- Entra ID ユーザー OID
    user_name   NVARCHAR(200),                          -- ユーザー表示名
    user_email  NVARCHAR(200),                          -- ユーザーメールアドレス
    details     NVARCHAR(MAX),                          -- 詳細情報（JSON）
    created_at  DATETIME2       DEFAULT GETDATE()
);
CREATE INDEX IX_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IX_audit_logs_created_at ON audit_logs(created_at);

-- 更新日時自動更新トリガー
CREATE TRIGGER TR_devices_updated_at ON devices
AFTER UPDATE AS
    UPDATE devices SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
GO

CREATE TRIGGER TR_rental_contracts_updated_at ON rental_contracts
AFTER UPDATE AS
    UPDATE rental_contracts SET updated_at = GETDATE()
    WHERE id IN (SELECT id FROM inserted);
GO
