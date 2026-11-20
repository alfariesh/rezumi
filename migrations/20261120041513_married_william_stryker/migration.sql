CREATE TABLE "job_listing_fit" (
	"user_id" text,
	"listing_id" text,
	"data" jsonb NOT NULL,
	"fact_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"input_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_listing_fit_pkey" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "job_maintenance" (
	"day" text PRIMARY KEY,
	"since" text NOT NULL,
	"next_page" integer DEFAULT 1,
	"closed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "job_listing_id" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "posting_closed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "application_job_listing_id_index" ON "application" ("job_listing_id");--> statement-breakpoint
CREATE INDEX "job_listing_fit_listing_id_index" ON "job_listing_fit" ("listing_id");--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_job_listing_id_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listing"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "job_listing_fit" ADD CONSTRAINT "job_listing_fit_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_listing_fit" ADD CONSTRAINT "job_listing_fit_listing_id_job_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "job_listing"("id") ON DELETE CASCADE;