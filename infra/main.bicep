// RGS Client Portal: one environment (dev, staging or production) in one resource group in the chosen Saudi region.
// Deploy:  az deployment group create -g <rg> -f infra/main.bicep -p infra/<env>.bicepparam -p postgresAdminPassword=<secret> ...
// RGS IT runs this; see docs/RUNBOOK.md for the order of steps and the values it needs.
targetScope = 'resourceGroup'

@allowed(['dev', 'staging', 'production'])
param environmentName string
@description('The Azure region. Must be the in-Kingdom region; confirm it offers every service used here.')
param location string = resourceGroup().location
@minLength(3)
@maxLength(12)
param appName string = 'rgs-portal'
@description('Microsoft Entra tenant for staff, and the application (client) id registered for the portal.')
param entraTenantId string
param entraClientId string
@description('Microsoft Entra External ID tenant and application for customers.')
param entraExternalTenantId string
param entraExternalClientId string
@description('Domain mail is sent from, and the sender address (must be on that domain).')
param mailDomain string
param mailFrom string
@description('Where ACS keeps its data; confirm an in-Kingdom option.')
param communicationDataLocation string
@secure()
param postgresAdminPassword string
param tags object = {}

var prefix = '${appName}-${environmentName}'
var sizing = {
  dev: { webSku: 'B2', dbSku: 'Standard_B2s', dbTier: 'Burstable', dbStorageGb: 32, backupDays: 7, ha: false, logDays: 30, purgeProtection: false }
  staging: { webSku: 'P1v3', dbSku: 'Standard_D2ds_v5', dbTier: 'GeneralPurpose', dbStorageGb: 64, backupDays: 14, ha: false, logDays: 60, purgeProtection: true }
  production: { webSku: 'P1v3', dbSku: 'Standard_D4ds_v5', dbTier: 'GeneralPurpose', dbStorageGb: 128, backupDays: 35, ha: true, logDays: 365, purgeProtection: true }
}
var size = sizing[environmentName]
var vaultName = take('${prefix}-kv', 24)
var storageAccountName = take(replace('${prefix}st', '-', ''), 24)
var acsName = '${prefix}-acs'
var allTags = union(tags, { app: appName, environment: environmentName, dataResidency: 'saudi-arabia' })

module network 'modules/network.bicep' = { name: 'network', params: { location: location, namePrefix: prefix, tags: allTags } }
module monitoring 'modules/monitoring.bicep' = { name: 'monitoring', params: { location: location, namePrefix: prefix, tags: allTags, retentionDays: size.logDays } }
module vault 'modules/keyvault.bicep' = { name: 'keyvault', params: { location: location, vaultName: vaultName, tags: allTags, appSubnetId: network.outputs.appSubnetId, purgeProtection: size.purgeProtection } }
module storage 'modules/storage.bicep' = { name: 'storage', params: { location: location, accountName: storageAccountName, tags: allTags, appSubnetId: network.outputs.appSubnetId } }
module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    location: location, namePrefix: prefix, tags: allTags, delegatedSubnetId: network.outputs.dbSubnetId, privateDnsZoneId: network.outputs.postgresDnsZoneId
    adminPassword: postgresAdminPassword, skuName: size.dbSku, skuTier: size.dbTier, storageGb: size.dbStorageGb, backupRetentionDays: size.backupDays, highAvailability: size.ha
  }
}
module communication 'modules/communication.bicep' = { name: 'communication', params: { acsResourceName: acsName, emailResourceName: '${prefix}-email', tags: allTags, dataLocation: communicationDataLocation, mailDomain: mailDomain } }

// Identity the web app uses to read secrets and files. Created first so it can be granted access before the app starts.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = { name: '${prefix}-id', location: location, tags: allTags }

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = { name: vaultName }
resource account 'Microsoft.Storage/storageAccounts@2023-05-01' existing = { name: storageAccountName }
resource acs 'Microsoft.Communication/communicationServices@2023-04-01' existing = { name: acsName }

var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var storageBlobDataContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource kvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  dependsOn: [vault]
  scope: kv
  name: guid(kv.id, identity.id, keyVaultSecretsUser)
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser) }
}
resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  dependsOn: [storage]
  scope: account
  name: guid(account.id, identity.id, storageBlobDataContributor)
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributor) }
}

// Secrets written by this template. `database-url` (the application's own limited login) is created by hand after the first migration: docs/RUNBOOK.md.
resource adminUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  dependsOn: [vault]
  parent: kv
  name: 'database-admin-url'
  properties: { value: 'postgres://${postgres.outputs.adminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.outputs.fqdn}:5432/${postgres.outputs.databaseName}' }
}
resource acsSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  dependsOn: [vault, communication]
  parent: kv
  name: 'acs-connection-string'
  properties: { value: acs.listKeys().primaryConnectionString }
}

var vaultUri = vault.outputs.vaultUri
module web 'modules/webapp.bicep' = {
  name: 'web'
  dependsOn: [kvAccess, blobAccess]
  params: {
    location: location, namePrefix: prefix, tags: allTags, skuName: size.webSku, identityId: identity.id, appSubnetId: network.outputs.appSubnetId
    workspaceId: monitoring.outputs.workspaceId, appInsightsConnectionString: monitoring.outputs.connectionString
    settings: {
      APP_ENV: environmentName
      DATABASE_URL: '@Microsoft.KeyVault(SecretUri=${vaultUri}secrets/database-url/)'
      ACS_CONNECTION_STRING: '@Microsoft.KeyVault(SecretUri=${vaultUri}secrets/acs-connection-string/)'
      ENTRA_TENANT_ID: entraTenantId
      ENTRA_CLIENT_ID: entraClientId
      ENTRA_EXTERNAL_TENANT_ID: entraExternalTenantId
      ENTRA_EXTERNAL_CLIENT_ID: entraExternalClientId
      STORAGE_ACCOUNT_NAME: storage.outputs.accountName
      STORAGE_CONTAINER: storage.outputs.containerName
      MAIL_FROM: mailFrom
      SESSION_IDLE_MINUTES: 30
      SESSION_MAX_HOURS: 12
      MAX_UPLOAD_MB: 100
      AZURE_CLIENT_ID: identity.properties.clientId
    }
  }
}

output webAppName string = web.outputs.siteName
output webAppHost string = web.outputs.defaultHostName
output keyVaultName string = vault.outputs.vaultName
output postgresServer string = postgres.outputs.fqdn
output storageAccount string = storage.outputs.accountName
output managedIdentityClientId string = identity.properties.clientId
