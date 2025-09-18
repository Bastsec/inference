CREATE TABLE "monitoring_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar(50) NOT NULL,
	"check_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"response_time_ms" integer,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"resolved" boolean DEFAULT false,
	"resolved_at" timestamp,
	"resolved_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"virtual_key_id" uuid,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"cache_read_input_tokens" integer DEFAULT 0,
	"cache_creation_input_tokens" integer DEFAULT 0,
	"cost_in_cents" integer NOT NULL,
	"litellm_model_id" text,
	"provider" text,
	"request_duration_ms" integer,
	"status" varchar(20) DEFAULT 'success',
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "litellm_key_id" text;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "rpm_limit" integer;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "tpm_limit" integer;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "max_budget" integer;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "budget_duration" text;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "model_restrictions" text;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "guardrails" text;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD COLUMN "sync_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "system_alerts" ADD CONSTRAINT "system_alerts_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_virtual_key_id_virtual_keys_id_fk" FOREIGN KEY ("virtual_key_id") REFERENCES "public"."virtual_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_keys" ADD CONSTRAINT "virtual_keys_litellm_key_id_unique" UNIQUE("litellm_key_id");