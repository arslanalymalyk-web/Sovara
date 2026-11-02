// The web application: Linux App Service running Node 22, HTTPS only, in the VNet, reading secrets via managed identity.
param location string
param namePrefix string
param tags object
param skuName string
param identityId string
param appSubnetId string
param workspaceId string
param appInsightsConnectionString string
param settings object
param customHostName string = ''

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: skuName }
  properties: { reserved: true }
}

var baseSettings = {
  WEBSITE_RUN_FROM_PACKAGE: '1'
  WEBSITE_NODE_DEFAULT_VERSION: '~22'
  APPLICATIONINSIGHTS_CONNECTION_STRING: appInsightsConnectionString
  WEBSITE_VNET_ROUTE_ALL: '1'
}
var allSettings = union(baseSettings, settings)

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: '${namePrefix}-web'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    virtualNetworkSubnetId: appSubnetId
    keyVaultReferenceIdentity: identityId
    siteConfig: {
      linuxFxVersion: 'NODE|22-lts'
      appCommandLine: 'node server.js'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      vnetRouteAllEnabled: true
      appSettings: [for s in items(allSettings): { name: s.key, value: string(s.value) }]
    }
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: site
  name: 'to-log-analytics'
  properties: {
    workspaceId: workspaceId
    logs: [
      { category: 'AppServiceHTTPLogs', enabled: true }
      { category: 'AppServiceConsoleLogs', enabled: true }
      { category: 'AppServiceAppLogs', enabled: true }
      { category: 'AppServiceAuditLogs', enabled: true }
    ]
    metrics: [{ category: 'AllMetrics', enabled: true }]
  }
}

output siteName string = site.name
output defaultHostName string = site.properties.defaultHostName
output customHostName string = customHostName
