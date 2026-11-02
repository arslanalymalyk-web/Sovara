-- Security layer: application role, access functions, row-level security, append-only hash-chained audit log.
-- Hand-written; the access functions mirror the TypeScript rules in src/lib/rbac (parity-tested in tests/db-rls.test.ts).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rgs_app_rw') THEN CREATE ROLE rgs_app_rw NOLOGIN; END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO rgs_app_rw;
--> statement-breakpoint

-- ---- Session identity -----------------------------------------------------------------------------------------------
-- The application sets `app.user_id` for the length of each transaction (see src/db/session.ts).
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint

-- ---- Access functions (SECURITY DEFINER so they can read the access tables without being filtered by them) ----------
-- Does this person hold a role that grants `act` over the given project / area / service, at time `at`?
-- proj = NULL asks the global question (assignments for all projects only). Mirrors can() for read actions.
CREATE OR REPLACE FUNCTION app_role_allows(uid uuid, act text, proj uuid, area uuid, svc text, at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users u
    JOIN organisations o ON o.id = u.org_id
    JOIN role_assignments ra ON ra.user_id = u.id
    JOIN roles r ON r.id = ra.role
    JOIN role_permissions rp ON rp.role = ra.role AND rp.action = act AND rp.relation = 'grant'
    WHERE u.id = uid AND u.status = 'active'
      AND ra.status <> 'revoked'
      AND (ra.valid_from IS NULL OR ra.valid_from <= at)
      AND (ra.valid_until IS NULL OR ra.valid_until >= at)
      AND r.side = CASE o.kind WHEN 'customer' THEN 'customer' ELSE 'rgs' END
      AND (
        (proj IS NULL AND ra.scope_all_projects)
        OR (proj IS NOT NULL
            AND (ra.scope_all_projects OR ra.scope_project_id = proj)
            AND (ra.scope_area_id IS NULL OR area IS NULL OR ra.scope_area_id = area)
            AND (ra.scope_service IS NULL OR svc IS NULL OR ra.scope_service = svc)
            AND (o.kind <> 'customer' OR EXISTS (SELECT 1 FROM projects p WHERE p.id = proj AND p.customer_org_id = o.id)))
      )
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_view_project(p uuid, at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT app_role_allows(app_user_id(), 'project.view', p, NULL, NULL, at) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_view_area(a uuid, at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT coalesce((SELECT app_role_allows(app_user_id(), 'project.view', ar.project_id, ar.id, NULL, at) FROM areas ar WHERE ar.id = a), false) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_view_package(k uuid, at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT coalesce((SELECT app_role_allows(app_user_id(), 'package.view', pk.project_id, pk.area_id, pk.service, at) FROM packages pk WHERE pk.id = k), false) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_has_action_global(act text, at timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT app_role_allows(app_user_id(), act, NULL, NULL, NULL, at) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_org() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT u.org_id FROM users u WHERE u.id = app_user_id() AND u.status = 'active' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_rgs_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT EXISTS (SELECT 1 FROM users u JOIN organisations o ON o.id = u.org_id WHERE u.id = app_user_id() AND u.status = 'active' AND o.kind = 'rgs') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_org_is_rgs(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS
$$ SELECT EXISTS (SELECT 1 FROM organisations o WHERE o.id = org AND o.kind = 'rgs') $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_user_id(), app_role_allows(uuid, text, uuid, uuid, text, timestamptz), app_can_view_project(uuid, timestamptz), app_can_view_area(uuid, timestamptz),
  app_can_view_package(uuid, timestamptz), app_has_action_global(text, timestamptz), app_user_org(), app_is_rgs_staff(), app_org_is_rgs(uuid) TO rgs_app_rw;
--> statement-breakpoint

-- ---- Row-level security -------------------------------------------------------------------------------------------------
-- Tables with no INSERT/UPDATE policy cannot be written by the application role in Stage 0; Stage 1 adds audited commands.
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE users FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE areas FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE role_assignments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE delegated_authorities ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE delegated_authorities FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE support_replies FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Reference tables are not sensitive; they hold the rules themselves.
GRANT SELECT ON actions, roles, role_permissions TO rgs_app_rw;
--> statement-breakpoint
GRANT SELECT ON organisations, users, projects, areas, packages, role_assignments, delegated_authorities, audit_log, support_requests, support_replies TO rgs_app_rw;
--> statement-breakpoint
GRANT INSERT ON audit_log, support_requests, support_replies TO rgs_app_rw;
--> statement-breakpoint
GRANT UPDATE ON support_requests TO rgs_app_rw;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_log_id_seq TO rgs_app_rw;
--> statement-breakpoint

-- A customer sees their own organisation and RGS; RGS staff see every organisation.
CREATE POLICY organisations_read ON organisations FOR SELECT TO rgs_app_rw
  USING (app_is_rgs_staff() OR id = app_user_org() OR kind = 'rgs');
--> statement-breakpoint
-- Names of people are shown to everyone who works with them: own organisation, and RGS people (shown as owners and reviewers).
CREATE POLICY users_read ON users FOR SELECT TO rgs_app_rw
  USING (id = app_user_id() OR app_is_rgs_staff() OR org_id = app_user_org() OR app_org_is_rgs(org_id));
--> statement-breakpoint
CREATE POLICY projects_read ON projects FOR SELECT TO rgs_app_rw USING (app_can_view_project(id));
--> statement-breakpoint
CREATE POLICY areas_read ON areas FOR SELECT TO rgs_app_rw USING (app_can_view_area(id));
--> statement-breakpoint
CREATE POLICY packages_read ON packages FOR SELECT TO rgs_app_rw USING (app_can_view_package(id));
--> statement-breakpoint
CREATE POLICY role_assignments_read ON role_assignments FOR SELECT TO rgs_app_rw USING (user_id = app_user_id() OR app_has_action_global('admin.roles'));
--> statement-breakpoint
CREATE POLICY authorities_read ON delegated_authorities FOR SELECT TO rgs_app_rw USING (user_id = app_user_id() OR app_has_action_global('admin.roles'));
--> statement-breakpoint
CREATE POLICY audit_read ON audit_log FOR SELECT TO rgs_app_rw USING (app_has_action_global('admin.audit.view'));
--> statement-breakpoint
CREATE POLICY audit_insert ON audit_log FOR INSERT TO rgs_app_rw WITH CHECK (actor_id = app_user_id());
--> statement-breakpoint
CREATE POLICY support_read ON support_requests FOR SELECT TO rgs_app_rw USING (user_id = app_user_id() OR app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY support_insert ON support_requests FOR INSERT TO rgs_app_rw WITH CHECK (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY support_update ON support_requests FOR UPDATE TO rgs_app_rw
  USING (user_id = app_user_id() OR app_has_action_global('admin.users')) WITH CHECK (user_id = app_user_id() OR app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY support_replies_read ON support_replies FOR SELECT TO rgs_app_rw
  USING (EXISTS (SELECT 1 FROM support_requests s WHERE s.id = request_id));
--> statement-breakpoint
CREATE POLICY support_replies_insert ON support_replies FOR INSERT TO rgs_app_rw
  WITH CHECK (author_id = app_user_id() AND EXISTS (SELECT 1 FROM support_requests s WHERE s.id = request_id));
--> statement-breakpoint

-- ---- Audit log: append-only and hash-chained -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_log_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege'; END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_guard();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_log_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_row_hash(prev text, r audit_log) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(sha256(convert_to(coalesce(prev, '') || '|' || r.at::text || '|' || coalesce(r.actor_id::text, '') || '|' || r.action || '|' ||
    coalesce(r.record_kind, '') || '|' || coalesce(r.record_id, '') || '|' || coalesce(r.reason, '') || '|' || coalesce(r.detail::text, ''), 'utf8')), 'hex')
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_chain() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(7240001);          -- one writer at a time keeps the chain in order
  SELECT hash INTO prev FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := prev;
  NEW.hash := audit_row_hash(prev, NEW);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_log_hash BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_log_chain();
--> statement-breakpoint
-- Returns the ids of entries whose hash or link no longer matches. Empty = the log is intact.
CREATE OR REPLACE FUNCTION audit_verify() RETURNS TABLE (broken_id bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (x.rec).id FROM (SELECT l AS rec, lag(l.hash) OVER (ORDER BY l.id) AS expected_prev FROM audit_log l) x
  WHERE (x.rec).prev_hash IS DISTINCT FROM x.expected_prev OR (x.rec).hash <> audit_row_hash((x.rec).prev_hash, x.rec)
  ORDER BY (x.rec).id
$$;
--> statement-breakpoint

-- ---- Integrity rules the CHECK constraints cannot express -----------------------------------------------------------------
-- Only technical approvals and delegable actions (such as publishing documents) can be delegated; a role title alone never carries sign-off.
CREATE OR REPLACE FUNCTION authority_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM actions a WHERE a.id = NEW.action AND a.kind IN ('technical','delegable')) THEN
    RAISE EXCEPTION 'This action cannot be delegated (%).', NEW.action USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER delegated_authorities_guard BEFORE INSERT OR UPDATE OF action ON delegated_authorities FOR EACH ROW EXECUTE FUNCTION authority_guard();
--> statement-breakpoint
-- A person's customer role must belong to a customer organisation, and an RGS role to RGS.
CREATE OR REPLACE FUNCTION role_side_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE want text; have text;
BEGIN
  SELECT r.side INTO want FROM roles r WHERE r.id = NEW.role;
  SELECT CASE o.kind WHEN 'customer' THEN 'customer' ELSE 'rgs' END INTO have FROM users u JOIN organisations o ON o.id = u.org_id WHERE u.id = NEW.user_id;
  IF want IS DISTINCT FROM have THEN RAISE EXCEPTION 'Role % belongs to the % side, not the person''s organisation', NEW.role, want USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER role_assignments_side_guard BEFORE INSERT OR UPDATE OF role, user_id ON role_assignments FOR EACH ROW EXECUTE FUNCTION role_side_guard();
