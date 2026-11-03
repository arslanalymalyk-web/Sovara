-- Stage 1: write access for the audited commands, a safe authorization snapshot, reference numbers, and the sign-in function.
-- Every write policy requires the caller to hold the matching administrative permission (checked by the same access tables the
-- TypeScript rules are synced into), so a bug in application code still cannot let an ordinary user change users or authority.

CREATE SEQUENCE IF NOT EXISTS authority_ref_seq START 8001;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS support_ref_seq START 1;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE authority_ref_seq, support_ref_seq TO rgs_app_rw;
--> statement-breakpoint

-- Reference numbers: DA-8001, SUP-0001 ...
CREATE OR REPLACE FUNCTION app_next_ref(kind text) RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE kind WHEN 'authority' THEN 'DA-' || nextval('authority_ref_seq')::text
                   WHEN 'support' THEN 'SUP-' || lpad(nextval('support_ref_seq')::text, 4, '0') END
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_next_ref(text) TO rgs_app_rw;
--> statement-breakpoint

-- ---- Authorization snapshot ---------------------------------------------------------------------------------------------
-- The access rules need to see the people, projects and assignments they are deciding about, which row-level security hides
-- from most callers. Administrators receive the full picture; everyone else receives only their own rows.
CREATE OR REPLACE FUNCTION app_authz_snapshot() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE me uuid := app_user_id(); see_all boolean;
BEGIN
  see_all := app_has_action_global('admin.users') OR app_has_action_global('admin.roles') OR app_has_action_global('admin.authority.grant');
  RETURN jsonb_build_object(
    'orgs', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'kind', o.kind)), '[]') FROM organisations o),
    'users', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'orgId', u.org_id, 'status', u.status, 'email', u.email)), '[]') FROM users u WHERE see_all OR u.id = me),
    'projects', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'customerOrgId', p.customer_org_id)), '[]') FROM projects p WHERE see_all OR app_can_view_project(p.id)),
    'areas', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'projectId', a.project_id)), '[]') FROM areas a WHERE see_all OR app_can_view_area(a.id)),
    'packages', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'projectId', k.project_id, 'areaId', k.area_id, 'service', k.service)), '[]') FROM packages k WHERE see_all OR app_can_view_package(k.id)),
    'assignments', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'userId', r.user_id, 'role', r.role, 'status', r.status, 'allProjects', r.scope_all_projects,
        'projectId', r.scope_project_id, 'areaId', r.scope_area_id, 'service', r.scope_service, 'validFrom', r.valid_from, 'validUntil', r.valid_until)), '[]') FROM role_assignments r WHERE see_all OR r.user_id = me),
    'authorities', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'ref', d.ref, 'userId', d.user_id, 'action', d.action, 'status', d.status, 'projectId', d.scope_project_id,
        'areaId', d.scope_area_id, 'service', d.scope_service, 'categories', d.scope_categories, 'grantedBy', d.granted_by, 'revokedAt', d.revoked_at, 'validFrom', d.valid_from, 'validTo', d.valid_to)), '[]') FROM delegated_authorities d WHERE see_all OR d.user_id = me)
  );
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_authz_snapshot() TO rgs_app_rw;
--> statement-breakpoint

-- ---- Write policies (administrators only) ---------------------------------------------------------------------------------
GRANT INSERT, UPDATE ON organisations, users, role_assignments, delegated_authorities TO rgs_app_rw;
--> statement-breakpoint
CREATE POLICY organisations_write_insert ON organisations FOR INSERT TO rgs_app_rw WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY organisations_write_update ON organisations FOR UPDATE TO rgs_app_rw USING (app_has_action_global('admin.users')) WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY users_write_insert ON users FOR INSERT TO rgs_app_rw WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY users_write_update ON users FOR UPDATE TO rgs_app_rw USING (app_has_action_global('admin.users')) WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY assignments_write_insert ON role_assignments FOR INSERT TO rgs_app_rw WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY assignments_write_update ON role_assignments FOR UPDATE TO rgs_app_rw USING (app_has_action_global('admin.users')) WITH CHECK (app_has_action_global('admin.users'));
--> statement-breakpoint
CREATE POLICY authorities_write_insert ON delegated_authorities FOR INSERT TO rgs_app_rw WITH CHECK (app_has_action_global('admin.authority.grant') AND granted_by = app_user_id());
--> statement-breakpoint
CREATE POLICY authorities_write_update ON delegated_authorities FOR UPDATE TO rgs_app_rw USING (app_has_action_global('admin.authority.grant')) WITH CHECK (app_has_action_global('admin.authority.grant'));
--> statement-breakpoint

-- ---- Sign-in -----------------------------------------------------------------------------------------------------------------
-- Called by the server after the identity provider has proved who the person is (verified token, MFA). Before the person is known
-- there is no session identity, so this runs with elevated rights and does exactly one thing: resolve the account.
--   * a known idp subject resolves to its account;
--   * otherwise an INVITED account with the same (verified) email is claimed: the subject is bound and the account becomes active;
--   * a suspended account, or an email with no invitation, resolves to nothing usable.
CREATE OR REPLACE FUNCTION app_sign_in(p_subject text, p_email text) RETURNS TABLE (out_user_id uuid, out_status text, out_outcome text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE u users%ROWTYPE;
BEGIN
  SELECT * INTO u FROM users WHERE users.idp_subject = p_subject;
  IF NOT FOUND THEN
    SELECT * INTO u FROM users WHERE lower(users.email) = lower(p_email) AND users.idp_subject IS NULL AND users.status = 'invited' FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, NULL::text, 'no_invitation'::text; RETURN; END IF;
    UPDATE users SET idp_subject = p_subject, status = 'active', status_at = now(), updated_at = now() WHERE users.id = u.id;
    INSERT INTO audit_log (actor_id, action, record_kind, record_id, detail) VALUES (u.id, 'auth.invitation.accepted', 'user', u.id::text, jsonb_build_object('email', p_email));
    u.status := 'active';
  END IF;
  IF u.status <> 'active' THEN RETURN QUERY SELECT u.id, u.status, 'not_active'::text; RETURN; END IF;
  UPDATE users SET last_visit_at = now() WHERE users.id = u.id;
  INSERT INTO audit_log (actor_id, action, record_kind, record_id) VALUES (u.id, 'auth.sign_in', 'user', u.id::text);
  RETURN QUERY SELECT u.id, u.status, 'ok'::text;
END $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_sign_in(text, text) TO rgs_app_rw;
