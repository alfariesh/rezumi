CREATE TABLE "job_search_setting" (
	"key" text PRIMARY KEY,
	"value" integer NOT NULL,
	"reason" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_search_setting_value_not_negative" CHECK ("value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "job_search_setting" ADD CONSTRAINT "job_search_setting_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;