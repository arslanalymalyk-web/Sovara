// Object storage for documents, photos and evidence. Private, TLS 1.2, no shared keys, soft delete and versioning on.
param location string
@minLength(3)
@maxLength(24)
param accountName string
param tags object
param appSubnetId string
@allowed(['Standard_LRS', 'Standard_ZRS'])
param skuName string = 'Standard_LRS' // geo-redundant skus are deliberately not offered: data must stay in the Kingdom
param containerName string = 'files'
param softDeleteDays int = 30

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: accountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: skuName }
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
    publicNetworkAccess: 'Enabled'
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices', virtualNetworkRules: [{ id: appSubnetId, action: 'Allow' }] }
  }
}

resource blob 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: softDeleteDays }
    containerDeleteRetentionPolicy: { enabled: true, days: softDeleteDays }
  }
}

resource files 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blob
  name: containerName
  properties: { publicAccess: 'None' }
}

output accountName string = account.name
output accountId string = account.id
output containerName string = files.name
