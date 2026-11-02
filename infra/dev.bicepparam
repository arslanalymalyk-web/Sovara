using 'main.bicep'

// Values RGS IT must supply before deploying (dev). Secrets are passed on the command line or from a pipeline secret, never committed.
param environmentName = 'dev'
param location = '<in-kingdom Azure region, e.g. confirmed by RGS IT>'
param entraTenantId = '<staff Entra tenant id>'
param entraClientId = '<portal app registration (client) id>'
param entraExternalTenantId = '<External ID tenant id>'
param entraExternalClientId = '<External ID app registration (client) id>'
param mailDomain = 'dev.portal.example.com'
param mailFrom = 'no-reply@dev.portal.example.com'
param communicationDataLocation = '<in-kingdom ACS data location, to be confirmed>'
param postgresAdminPassword = readEnvironmentVariable('RGS_PG_ADMIN_PASSWORD')
