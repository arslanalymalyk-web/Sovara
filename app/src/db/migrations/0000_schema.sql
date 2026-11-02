CREATE TABLE "actions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"module" text NOT NULL,
	CONSTRAINT "actions_kind_ck" CHECK ("actions"."kind" in ('view','write','technical','delegable','admin'))
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"kind" text DEFAULT 'area' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_kind_ck" CHECK ("areas"."kind" in ('area','asset'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"record_kind" text,
	"record_id" text,
	"reason" text,
	"detail" jsonb,
	"prev_hash" text,
	"hash" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delegated_authorities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"scope_project_id" uuid NOT NULL,
	"scope_area_id" uuid,
	"scope_service" text,
	"scope_categories" text[],
	"granted_by" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nominated_by_user" uuid,
	"nominated_by_org" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	CONSTRAINT "authorities_status_ck" CHECK ("delegated_authorities"."status" in ('active','revoked')),
	CONSTRAINT "authorities_no_self_grant_ck" CHECK ("delegated_authorities"."granted_by" <> "delegated_authorities"."user_id"),
	CONSTRAINT "authorities_nomination_ck" CHECK (("delegated_authorities"."nominated_by_user" is not null) <> ("delegated_authorities"."nominated_by_org" is not null)),
	CONSTRAINT "authorities_nominator_not_grantor_ck" CHECK ("delegated_authorities"."nominated_by_user" is null or "delegated_authorities"."nominated_by_user" <> "delegated_authorities"."granted_by"),
	CONSTRAINT "authorities_period_ck" CHECK ("delegated_authorities"."valid_to" >= "delegated_authorities"."valid_from" and "delegated_authorities"."valid_to" - "delegated_authorities"."valid_from" <= 366),
	CONSTRAINT "authorities_revoked_ck" CHECK (("delegated_authorities"."status" = 'revoked') = ("delegated_authorities"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_kind_ck" CHECK ("organisations"."kind" in ('rgs','customer')),
	CONSTRAINT "organisations_status_ck" CHECK ("organisations"."status" in ('active','suspended'))
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"area_id" uuid,
	"service" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "packages_service_ck" CHECK ("packages"."service" in ('scaffolding','insulation','waterproofing','fireproofing'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"customer_org_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"location" text,
	"status" text DEFAULT 'planning' NOT NULL,
	"planned_start" date,
	"planned_completion" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_type_ck" CHECK ("projects"."type" in ('industrial','infrastructure','commercial','residential')),
	CONSTRAINT "projects_status_ck" CHECK ("projects"."status" in ('planning','execution','handover','closed')),
	CONSTRAINT "projects_dates_ck" CHECK ("projects"."planned_completion" is null or "projects"."planned_start" is null or "projects"."planned_completion" >= "projects"."planned_start")
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"scope_all_projects" boolean DEFAULT false NOT NULL,
	"scope_project_id" uuid,
	"scope_area_id" uuid,
	"scope_service" text,
	"status" text DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_status_ck" CHECK ("role_assignments"."status" in ('active','revoked')),
	CONSTRAINT "role_assignments_scope_ck" CHECK (("role_assignments"."scope_all_projects" and "role_assignments"."scope_project_id" is null and "role_assignments"."scope_area_id" is null and "role_assignments"."scope_service" is null) or (not "role_assignments"."scope_all_projects" and "role_assignments"."scope_project_id" is not null)),
	CONSTRAINT "role_assignments_service_ck" CHECK ("role_assignments"."scope_service" is null or "role_assignments"."scope_service" in ('scaffolding','insulation','waterproofing','fireproofing'))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role" text NOT NULL,
	"action" text NOT NULL,
	"relation" text NOT NULL,
	CONSTRAINT "role_permissions_role_action_relation_pk" PRIMARY KEY("role","action","relation"),
	CONSTRAINT "role_permissions_rel_ck" CHECK ("role_permissions"."relation" in ('grant','eligible'))
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"side" text NOT NULL,
	"scope_level" text NOT NULL,
	CONSTRAINT "roles_side_ck" CHECK ("roles"."side" in ('customer','rgs'))
);
--> statement-breakpoint
CREATE TABLE "support_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"staff" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "support_category_ck" CHECK ("support_requests"."category" in ('access','data','report','other')),
	CONSTRAINT "support_status_ck" CHECK ("support_requests"."status" in ('open','in_progress','resolved'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"idp_subject" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"status_reason" text,
	"status_at" timestamp with time zone,
	"status_by" uuid,
	"last_visit_at" timestamp with time zone,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_ck" CHECK ("users"."status" in ('invited','active','suspended')),
	CONSTRAINT "users_language_ck" CHECK ("users"."preferred_language" in ('en','ar'))
);
--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_action_actions_id_fk" FOREIGN KEY ("action") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_scope_project_id_projects_id_fk" FOREIGN KEY ("scope_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_scope_area_id_areas_id_fk" FOREIGN KEY ("scope_area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_nominated_by_user_users_id_fk" FOREIGN KEY ("nominated_by_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_nominated_by_org_organisations_id_fk" FOREIGN KEY ("nominated_by_org") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delegated_authorities" ADD CONSTRAINT "delegated_authorities_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_customer_org_id_organisations_id_fk" FOREIGN KEY ("customer_org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_roles_id_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_scope_project_id_projects_id_fk" FOREIGN KEY ("scope_project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_scope_area_id_areas_id_fk" FOREIGN KEY ("scope_area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_roles_id_fk" FOREIGN KEY ("role") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_action_actions_id_fk" FOREIGN KEY ("action") REFERENCES "public"."actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_request_id_support_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."support_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_replies" ADD CONSTRAINT "support_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organisations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_project_code_uq" ON "areas" USING btree ("project_id","code");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_record_idx" ON "audit_log" USING btree ("record_kind","record_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authorities_ref_uq" ON "delegated_authorities" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "authorities_user_idx" ON "delegated_authorities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_name_uq" ON "organisations" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "packages_code_uq" ON "packages" USING btree ("code");--> statement-breakpoint
CREATE INDEX "packages_project_idx" ON "packages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_code_uq" ON "projects" USING btree ("code");--> statement-breakpoint
CREATE INDEX "projects_customer_idx" ON "projects" USING btree ("customer_org_id");--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_replies_request_idx" ON "support_replies" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_ref_uq" ON "support_requests" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "support_user_idx" ON "support_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_idp_subject_uq" ON "users" USING btree ("idp_subject") WHERE "users"."idp_subject" is not null;--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("org_id");