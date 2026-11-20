CREATE TABLE "job_listing" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"company" jsonb NOT NULL,
	"location" jsonb NOT NULL,
	"country_code" text,
	"work_arrangement" text,
	"seniority" text,
	"employment_type" text,
	"visa_sponsorship" boolean,
	"salary" jsonb,
	"description" text NOT NULL,
	"requirements_summary" text,
	"skills" jsonb DEFAULT '[]' NOT NULL,
	"posting_url" text NOT NULL,
	"apply_url" text,
	"source" text,
	"language" text,
	"posted_at" timestamp with time zone,
	"raw" jsonb DEFAULT '{}' NOT NULL,
	"search_text" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_search_cache" (
	"key" text PRIMARY KEY,
	"providers" text[] NOT NULL,
	"query" jsonb NOT NULL,
	"listing_ids" text[] NOT NULL,
	"cursors" jsonb DEFAULT '{}' NOT NULL,
	"total" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_listing_provider_external_id_index" ON "job_listing" ("provider","external_id");--> statement-breakpoint
CREATE INDEX "job_listing_closed_at_index" ON "job_listing" ("closed_at");--> statement-breakpoint
CREATE INDEX "job_listing_last_seen_at_index" ON "job_listing" ("last_seen_at");--> statement-breakpoint
CREATE INDEX "job_search_cache_expires_at_index" ON "job_search_cache" ("expires_at");