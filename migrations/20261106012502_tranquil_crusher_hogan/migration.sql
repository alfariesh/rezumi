CREATE TABLE "portfolio" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL CONSTRAINT "portfolio_user_unique" UNIQUE,
	"source_resume_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"show_in_search_engines" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_file" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL CONSTRAINT "portfolio_file_key_unique" UNIQUE,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"pages" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "portfolio_source_resume_id_index" ON "portfolio" ("source_resume_id");--> statement-breakpoint
CREATE INDEX "portfolio_file_user_id_index" ON "portfolio_file" ("user_id");--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "portfolio" ADD CONSTRAINT "portfolio_source_resume_id_resume_id_fkey" FOREIGN KEY ("source_resume_id") REFERENCES "resume"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "portfolio_file" ADD CONSTRAINT "portfolio_file_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;