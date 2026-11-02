CREATE TABLE "billing_account" (
	"user_id" text PRIMARY KEY,
	"trial_granted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_audit_log" (
	"id" text PRIMARY KEY,
	"actor_user_id" text,
	"target_user_id" text,
	"action" text NOT NULL,
	"reason" text,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership_period" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"granted_by" text,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_period_ends_after_start" CHECK ("ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE INDEX "billing_audit_log_target_user_id_created_at_index" ON "billing_audit_log" ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "membership_period_user_id_ends_at_index" ON "membership_period" ("user_id","ends_at");--> statement-breakpoint
ALTER TABLE "billing_account" ADD CONSTRAINT "billing_account_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "billing_audit_log" ADD CONSTRAINT "billing_audit_log_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "billing_audit_log" ADD CONSTRAINT "billing_audit_log_target_user_id_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "membership_period" ADD CONSTRAINT "membership_period_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership_period" ADD CONSTRAINT "membership_period_granted_by_user_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE SET NULL;