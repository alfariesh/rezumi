CREATE TABLE "job_listing_hidden" (
	"user_id" text,
	"listing_id" text,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_listing_hidden_pkey" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE INDEX "job_listing_hidden_listing_id_index" ON "job_listing_hidden" ("listing_id");--> statement-breakpoint
ALTER TABLE "job_listing_hidden" ADD CONSTRAINT "job_listing_hidden_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_listing_hidden" ADD CONSTRAINT "job_listing_hidden_listing_id_job_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "job_listing"("id") ON DELETE CASCADE;