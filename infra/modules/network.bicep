// Virtual network: one subnet for the web app, one delegated to PostgreSQL. The database has no public address.
param location string
param namePrefix string
param tags object
param addressSpace string = '10.40.0.0/16'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: '${namePrefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [addressSpace] }
    subnets: [
      {
        name: 'app'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 24, 0)
          delegations: [{ name: 'appservice', properties: { serviceName: 'Microsoft.Web/serverFarms' } }]
          serviceEndpoints: [{ service: 'Microsoft.KeyVault' }, { service: 'Microsoft.Storage' }]
        }
      }
      {
        name: 'db'
        properties: {
          addressPrefix: cidrSubnet(addressSpace, 24, 1)
          delegations: [{ name: 'postgres', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } }]
        }
      }
    ]
  }
}

resource dnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: '${namePrefix}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: dnsZone
  name: '${namePrefix}-link'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: vnet.id } }
}

output vnetId string = vnet.id
output appSubnetId string = '${vnet.id}/subnets/app'
output dbSubnetId string = '${vnet.id}/subnets/db'
output postgresDnsZoneId string = dnsZone.id
