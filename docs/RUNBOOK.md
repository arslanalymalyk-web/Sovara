# Runbook: standing up an environment (RGS IT)

Audience: RGS IT. Covers dev, staging and production, which are three copies of the same template. Nothing here needs the builder to hold your cloud credentials. Every command below was written against the templates in `infra/`; the SQL steps were run against PostgreSQL 16.

## 0. What you need before starting

| Item | Notes |
|---|---|
| Azure subscription and a resource group per environment | **In the in-Kingdom region.** Confirm the region offers: Database for PostgreSQL flexible server (zone-redundant HA for production), Storage, App Service (P1v3), Key Vault, Communication Services Email, Log Analytics, Entra External ID. Anything missing blocks go-live; tell the builder. |
| Microsoft Entra ID (staff) tenant | An app registration for the portal; redirect URI `https://<host>/api/auth/callback/entra`; groups claim not needed (roles come from the portal). |
| Microsoft Entra External ID tenant (customers) | A user flow with email + password and MFA required, invitation only (self sign-up off); an app registration with redirect URI `https://<host>/api/auth/callback/entra-external`. |
| Mail domain | e.g. `portal.<rgs-domain>`; you add the DNS records Azure shows after step 3. |
| Web address | e.g. `portal.<rgs-domain>` (production), `staging.portal...`, `dev.portal...`. |
| A strong database admin password per environment | Stored only in your pipeline secret store and Key Vault. |

## 1. Create the resource group and deploy the template

```bash
az group create -n rg-rgs-portal-staging -l <in-kingdom-region>
export RGS_PG_ADMIN_PASSWORD='<strong secret>'
az deployment group create -g rg-rgs-portal-staging -f infra/main.bicep -p infra/staging.bicepparam
```

Fill the `<...>` values in `infra/<env>.bicepparam` first (tenant ids, app ids, mail domain, in-Kingdom region and Communication Services data location). Do not commit secrets. Deploying to production the same way with `production.bicepparam`.

What it creates: a virtual network (the database is reachable only from the app subnet), PostgreSQL 16, private storage for files, Key Vault, the web app (Node 22, HTTPS only, managed identity), Log Analytics and Application Insights, and Communication Services Email. Backups stay in region (no geo-redundancy by design).

## 2. Create the application's own database login (once per environment)

The template creates the server and an admin login. The application must not run as the admin. From a machine inside the virtual network (for example `az webapp ssh` on the web app, or a self-hosted pipeline agent), as the admin:

```bash
psql "$(az keyvault secret show --vault-name <kv> -n database-admin-url --query value -o tsv)"
```
```sql
-- 1. apply migrations first (step 3), then:
CREATE ROLE rgs_app LOGIN PASSWORD '<new strong secret>' IN ROLE rgs_app_rw;
GRANT CONNECT ON DATABASE rgs_portal TO rgs_app;
ALTER ROLE rgs_app SET search_path = public;
```

Store its connection string as the Key Vault secret `database-url`:
`postgres://rgs_app:<secret>@<server>.postgres.database.azure.com:5432/rgs_portal`

`rgs_app` cannot create tables, cannot edit or delete the audit log, and sees no rows unless the application sets the signed-in person's identity. Row-level security enforces this inside the database.

## 3. Apply migrations and sync the access rules

Run the bundled migration tool from inside the network, as the admin, on every deploy **before** the new web app version starts:

```bash
DATABASE_URL="$(az keyvault secret show --vault-name <kv> -n database-admin-url --query value -o tsv)" node dist/migrate.mjs
```

It applies new migrations and re-synchronises the access-rule tables from the code. It is safe to run repeatedly. (`dist/` is produced by `npm run build:migrate` in `app/`.)

## 4. Deploy the application

CI builds the package (`npm run build` in `app/`, then zip `.next/standalone`, `.next/static` into `standalone/.next/static`, and `public`). Deploy it:

```bash
az webapp deploy -g rg-rgs-portal-staging -n <web app name> --src-path portal.zip --type zip
```

The web app starts with `node server.js` and reports health at `/api/health`.

## 5. Custom domain and mail

1. Add the web address as a custom domain on the web app and bind a managed certificate (the CNAME and TXT records are shown in the portal).
2. In the Communication Services email domain, add the SPF, DKIM, DKIM2 and domain-verification records it lists to your DNS, then verify. Mail will not send until verified.

## 6. First sign-in and verification checklist

Do all of these on staging before production.

- [ ] `https://<host>/api/health` returns `{"status":"ok"}` with the security headers.
- [ ] The staff sign-in works for one named administrator; MFA is demanded; the session ends after 30 minutes idle.
- [ ] A customer invited from the portal receives the invitation email, sets a password and MFA, and can sign in.
- [ ] As that customer you cannot see any project that is not theirs (check with a second customer organisation).
- [ ] `select * from audit_verify();` returns no rows (the audit log is intact).
- [ ] `update audit_log set reason = 'x';` as `rgs_app` fails with *permission denied*.
- [ ] Application Insights shows requests; an alert exists for failed health checks.
- [ ] A backup restore to a new server succeeded (see below).

## 7. Backup and restore drill (quarterly)

Production keeps 35 days of point-in-time backups in region. Restore to a new server from the Azure portal (point-in-time), run the migration tool against it, run `audit_verify()`, then delete the test server. Record the date and result here.

## 8. Values the builder needs back from you

Region and service availability (step 0), tenant and app ids (step 1), the mail domain and web addresses, confirmation that DNS records were added, and the name of the RGS decision owner for the open items in `docs/PRODUCTION-PLAN.md` §6.
