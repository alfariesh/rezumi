ALTER TABLE "portfolio" ADD COLUMN "files_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "portfolio_file" ADD COLUMN "unused_since" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "portfolio_file_unused_since_index" ON "portfolio_file" ("unused_since");