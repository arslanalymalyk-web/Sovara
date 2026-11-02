// PostgreSQL flexible server in the delegated subnet (no public access). Backups stay in region.
param location string
param namePrefix string
param tags object
param delegatedSubnetId string
param privateDnsZoneId string
param adminLogin string = 'rgsadmin'
@secure()
param adminPassword string
param skuName string
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string
param storageGb int
param backupRetentionDays int
param highAvailability bool
param databaseName string = 'rgs_portal'

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${namePrefix}-pg'
  location: location
  tags: tags
  sku: { name: skuName, tier: skuTier }
  properties: {
    version: '16'
    administratorLogin: adminLogin
    administratorLoginPassword: adminPassword
    storage: { storageSizeGB: storageGb, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: backupRetentionDays, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: highAvailability ? 'ZoneRedundant' : 'Disabled' }
    network: { delegatedSubnetResourceId: delegatedSubnetId, privateDnsZoneArmResourceId: privateDnsZoneId, publicNetworkAccess: 'Disabled' }
    authConfig: { passwordAuth: 'Enabled', activeDirectoryAuth: 'Disabled' }
  }
}

resource db 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: server
  name: databaseName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource requireTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: server
  name: 'require_secure_transport'
  properties: { value: 'on', source: 'user-override' }
  dependsOn: [db]
}

resource logConnections 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: server
  name: 'log_connections'
  properties: { value: 'on', source: 'user-override' }
  dependsOn: [requireTls]
}

output serverName string = server.name
output fqdn string = server.properties.fullyQualifiedDomainName
output databaseName string = db.name
output adminLogin string = adminLogin
