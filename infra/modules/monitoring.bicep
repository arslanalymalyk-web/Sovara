// Logs and application telemetry. Data stays in the chosen region.
param location string
param namePrefix string
param tags object
param retentionDays int

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: retentionDays, features: { disableLocalAuth: false } }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-insights'
  location: location
  tags: tags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logs.id, DisableIpMasking: false }
}

output workspaceId string = logs.id
output connectionString string = insights.properties.ConnectionString
