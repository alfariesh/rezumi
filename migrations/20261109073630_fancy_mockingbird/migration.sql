CREATE TABLE "portfolio_moderation_log" (
	"id" text PRIMARY KEY,
	"portfolio_id" text,
	"target_user_id" text,
	"actor_user_id" text,
	"action" text NOT NULL,
	"reason" text,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_report" (
	"id" text PRIMARY KEY,
	"portfolio_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text NOT NULL,
	"reporter_email" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by_user_id" text
);
--> statement-breakpoint
CREATE INDEX "portfolio_moderation_log_portfolio_id_created_at_index" ON "portfolio_moderation_log" ("portfolio_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_moderation_log_target_user_id_created_at_index" ON "portfolio_moderation_log" ("target_user_id","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_report_status_created_at_index" ON "portfolio_report" ("status","created_at");--> statement-breakpoint
CREATE INDEX "portfolio_report_portfolio_id_created_at_index" ON "portfolio_report" ("portfolio_id","created_at");--> statement-breakpoint
ALTER TABLE "portfolio_moderation_log" ADD CONSTRAINT "portfolio_moderation_log_portfolio_id_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portfolio_moderation_log" ADD CONSTRAINT "portfolio_moderation_log_target_user_id_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portfolio_moderation_log" ADD CONSTRAINT "portfolio_moderation_log_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portfolio_report" ADD CONSTRAINT "portfolio_report_portfolio_id_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portfolio_report" ADD CONSTRAINT "portfolio_report_handled_by_user_id_user_id_fkey" FOREIGN KEY ("handled_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;