CREATE TABLE "extension_capture_report" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"site" text,
	"extension_version" text NOT NULL,
	"missing" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "source_key" text;--> statement-breakpoint
CREATE INDEX "application_user_id_source_key_index" ON "application" ("user_id","source_key");--> statement-breakpoint
CREATE INDEX "extension_capture_report_user_id_created_at_index" ON "extension_capture_report" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "extension_capture_report_notified_at_created_at_index" ON "extension_capture_report" ("notified_at","created_at");--> statement-breakpoint
ALTER TABLE "extension_capture_report" ADD CONSTRAINT "extension_capture_report_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;