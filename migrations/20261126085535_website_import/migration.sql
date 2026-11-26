CREATE TABLE "website_import" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"free" boolean DEFAULT false NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"pages_read" integer DEFAULT 0 NOT NULL,
	"work_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd_micros" bigint,
	"error_code" text,
	"result" jsonb,
	"result_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "website_import_status" CHECK ("status" IN ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "website_import_user_id_created_at_index" ON "website_import" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "website_import_result_expires_at_index" ON "website_import" ("result_expires_at");--> statement-breakpoint
CREATE INDEX "website_import_status_created_at_index" ON "website_import" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "website_import_one_free" ON "website_import" ("user_id") WHERE "free" AND "status" IN ('running', 'succeeded');--> statement-breakpoint
ALTER TABLE "website_import" ADD CONSTRAINT "website_import_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;