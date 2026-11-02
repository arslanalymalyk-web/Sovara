// Azure Communication Services Email: invitations, approvals and alerts, sent from a domain RGS verifies.
param acsResourceName string
param emailResourceName string
param tags object
@description('Where ACS stores its data. Confirm that an in-Kingdom option is available for your subscription before production.')
param dataLocation string
@description('The domain mail is sent from, e.g. portal.example.com. DNS records are added by RGS IT (see docs/RUNBOOK.md).')
param mailDomain string

resource email 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: emailResourceName
  location: 'global'
  tags: tags
  properties: { dataLocation: dataLocation }
}

resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: email
  name: mailDomain
  location: 'global'
  tags: tags
  properties: { domainManagement: 'CustomerManaged', userEngagementTracking: 'Disabled' }
}

resource acs 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: acsResourceName
  location: 'global'
  tags: tags
  properties: { dataLocation: dataLocation, linkedDomains: [domain.id] }
}

output acsName string = acs.name
output domainName string = domain.name
