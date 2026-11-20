CREATE TABLE "job_search_recent" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"criteria_key" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"searched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_search_recent_user_id_criteria_key_index" ON "job_search_recent" ("user_id","criteria_key");--> statement-breakpoint
CREATE INDEX "job_search_recent_user_id_searched_at_index" ON "job_search_recent" ("user_id","searched_at");--> statement-breakpoint
ALTER TABLE "job_search_recent" ADD CONSTRAINT "job_search_recent_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;