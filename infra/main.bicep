// =============================================
// 携帯レンタル管理システム — Azure インフラ
// Subscription: 074c0f6b-46e0-4f82-b918-07278b67317f
// =============================================

param location string = 'japaneast'
param prefix string = 'rental'
@secure()
param sqlAdminPassword string
param entraClientId string
param entraTenantId string

// ====== Azure SQL Database ======
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: '${prefix}-sql-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    administratorLogin: 'sqladmin'
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: 'rental_management'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ====== Storage for Functions ======
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${prefix}stor${uniqueString(resourceGroup().id)}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

// ====== App Service Plan for Functions ======
resource funcPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${prefix}-func-plan'
  location: location
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
}

// ====== Azure Functions ======
resource funcApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${prefix}-func-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: funcPlan.id
    siteConfig: {
      nodeVersion: '~22'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        // Consumption プランに必須 — ないと Functions が起動しない
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'WEBSITE_CONTENTSHARE', value: '${prefix}-func-content' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~22' }
        { name: 'DB_SERVER', value: sqlServer.properties.fullyQualifiedDomainName }
        { name: 'DB_NAME', value: 'rental_management' }
        { name: 'DB_USER', value: 'sqladmin' }
        { name: 'DB_PASSWORD', value: sqlAdminPassword }
        { name: 'ENTRA_TENANT_ID', value: entraTenantId }
        { name: 'ENTRA_CLIENT_ID', value: entraClientId }
        { name: 'DATAVERSE_URL', value: 'https://org5a73169f.crm7.dynamics.com' }
      ]
      cors: {
        // Static Web Apps の URL のみ許可（ワイルドカード * は本番では使用しない）
        allowedOrigins: ['https://portal.azure.com', 'https://${staticWebApp.properties.defaultHostname}']
      }
    }
    httpsOnly: true
  }
}

// ====== Azure Static Web Apps ======
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${prefix}-web'
  location: 'eastasia'  // Static Web Apps は限られたリージョン
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: ''  // GitHub連携する場合はリポジトリURLを指定
    branch: 'main'
    buildProperties: {
      appLocation: 'frontend'
      outputLocation: 'dist'
    }
  }
}

// ====== Output ======
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output funcAppUrl string = 'https://${funcApp.properties.defaultHostName}'
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output funcAppName string = funcApp.name
