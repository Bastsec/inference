ALTER TABLE "profiles" ADD COLUMN "alias" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "blocked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "max_budget" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "budget_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "allowed_model_region" varchar(10);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "default_model" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "budget_duration" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "tpm_limit" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "rpm_limit" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "model_max_budget" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "max_parallel_requests" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "soft_budget" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "spend" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "budget_reset_at" timestamp;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "litellm_customer_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_litellm_customer_id_unique" UNIQUE("litellm_customer_id");