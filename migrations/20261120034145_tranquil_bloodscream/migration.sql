ALTER TABLE "career_opportunity" ADD COLUMN "listing_id" text;--> statement-breakpoint
ALTER TABLE "career_schedule" ADD COLUMN "search" jsonb;--> statement-breakpoint
ALTER TABLE "career_schedule" ADD COLUMN "discovery_state" jsonb;--> statement-breakpoint
CREATE INDEX "career_opportunity_listing_id_index" ON "career_opportunity" ("listing_id");--> statement-breakpoint
ALTER TABLE "career_opportunity" ADD CONSTRAINT "career_opportunity_listing_id_job_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "job_listing"("id") ON DELETE SET NULL;