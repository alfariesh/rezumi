CREATE TABLE "custom_domain_removal" (
	"cf_hostname_id" text PRIMARY KEY,
	"hostname" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "cf_hostname_id" text;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "cf_hostname_status" text;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "cf_ssl_status" text;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "cf_problem" text;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "cf_next_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "plan_lapsed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD COLUMN "plan_checked_at" timestamp with time zone;