#!/bin/bash
# =============================================
# Azure デプロイスクリプト
# =============================================

set -e

SUBSCRIPTION_ID="074c0f6b-46e0-4f82-b918-07278b67317f"
RESOURCE_GROUP="rg-rental-management"
LOCATION="japaneast"

# ── 必須環境変数チェック ──────────────────────────────────────────
if [ -z "$ENTRA_CLIENT_ID" ] || [ -z "$ENTRA_TENANT_ID" ]; then
  echo "エラー: ENTRA_CLIENT_ID と ENTRA_TENANT_ID を環境変数に設定してください"
  echo "  export ENTRA_CLIENT_ID=<クライアントID>"
  echo "  export ENTRA_TENANT_ID=<テナントID>"
  exit 1
fi

# DB パスワードは毎回生成すると再デプロイ時にDBに繋がらなくなるため、
# 環境変数またはプロンプトで明示的に指定する
if [ -z "$SQL_ADMIN_PASSWORD" ]; then
  read -rsp "SQL 管理者パスワード (新規の場合は任意の値): " SQL_ADMIN_PASSWORD
  echo
fi

# ── サブスクリプション設定 ────────────────────────────────────────
az account set --subscription "$SUBSCRIPTION_ID"

# ── リソースグループ作成 ──────────────────────────────────────────
echo "リソースグループを作成中..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# ── Bicep デプロイ ────────────────────────────────────────────────
echo "Azureリソースをデプロイ中..."
OUTPUTS=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file main.bicep \
  --parameters \
    sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
    entraClientId="$ENTRA_CLIENT_ID" \
    entraTenantId="$ENTRA_TENANT_ID" \
  --query "properties.outputs" \
  --output json)

echo "$OUTPUTS"

FUNC_APP_NAME=$(echo "$OUTPUTS" | jq -r '.funcAppName.value')
STATIC_WEB_APP_NAME=$(echo "$OUTPUTS" | jq -r '.staticWebAppName // .funcAppName | .value' 2>/dev/null || echo "")

if [ -z "$FUNC_APP_NAME" ]; then
  echo "エラー: Functions アプリ名を取得できませんでした"
  exit 1
fi

# ── バックエンドビルド & デプロイ ─────────────────────────────────
echo ""
echo "バックエンドをビルド中..."
cd ../backend
npm install
npm run build

echo "Azure Functions にデプロイ中..."
func azure functionapp publish "$FUNC_APP_NAME" --javascript

# ── フロントエンドビルド & デプロイ ──────────────────────────────
echo ""
echo "フロントエンドをビルド中..."
cd ../frontend
npm install

# Static Web Apps のデプロイトークンを取得
SWA_NAME=$(az staticwebapp list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[0].name" --output tsv 2>/dev/null || echo "")

if [ -n "$SWA_NAME" ]; then
  DEPLOY_TOKEN=$(az staticwebapp secrets list \
    --name "$SWA_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" --output tsv)

  FUNC_URL=$(echo "$OUTPUTS" | jq -r '.funcAppUrl.value')
  VITE_API_BASE_URL="$FUNC_URL" npm run build

  npx @azure/static-web-apps-cli deploy dist \
    --deployment-token "$DEPLOY_TOKEN" \
    --env production
else
  echo "警告: Static Web App が見つかりません。手動でフロントエンドをデプロイしてください。"
  FUNC_URL=$(echo "$OUTPUTS" | jq -r '.funcAppUrl.value')
  VITE_API_BASE_URL="$FUNC_URL" npm run build
  echo "生成された dist/ フォルダを Azure Static Web Apps にアップロードしてください"
fi

# ── 完了メッセージ ────────────────────────────────────────────────
echo ""
echo "========================================"
echo "デプロイ完了"
echo "========================================"
echo ""
echo "次のステップ:"
echo "1. 出力されたSQL ServerのFQDNに接続し、database/schema.sql を実行"
echo "2. Entra IDアプリ登録でStatic Web AppsのURLをリダイレクトURIに追加"
echo "3. Teamsに専用チャンネルを作成し、WebhookをLogic Appsに設定"
echo "4. Logic Appsのテンプレート (logicapp-alert.json) をAzureポータルからインポート"
echo ""
echo "SQL Admin Password をメモしておいてください (次回の再デプロイで必要):"
echo "  export SQL_ADMIN_PASSWORD='$SQL_ADMIN_PASSWORD'"
