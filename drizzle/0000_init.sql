CREATE TABLE "ad_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" text DEFAULT 'windsor' NOT NULL,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ad_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" text PRIMARY KEY NOT NULL,
	"ad_set_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"thumbnail_url" text,
	"body" text,
	"title" text
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text,
	"objective" text,
	"daily_budget" double precision,
	"lifetime_budget" double precision,
	"start_date" date,
	"end_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_accounts" (
	"client_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	CONSTRAINT "client_accounts_client_id_account_id_pk" PRIMARY KEY("client_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "client_campaigns" (
	"client_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	CONSTRAINT "client_campaigns_client_id_campaign_id_pk" PRIMARY KEY("client_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "client_members" (
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_members_client_id_user_id_pk" PRIMARY KEY("client_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"welcome_note" text,
	"goal" text DEFAULT 'sales' NOT NULL,
	"kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fee_type" text DEFAULT 'none' NOT NULL,
	"fee_percent" double precision DEFAULT 0 NOT NULL,
	"fee_flat_monthly" double precision DEFAULT 0 NOT NULL,
	"fee_label" text DEFAULT 'Agency fee' NOT NULL,
	"campaign_mode" text DEFAULT 'all' NOT NULL,
	"campaign_name_filter" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"date" date NOT NULL,
	"account_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_set_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"platform" text NOT NULL,
	"spend" double precision DEFAULT 0 NOT NULL,
	"impressions" double precision DEFAULT 0 NOT NULL,
	"reach" double precision DEFAULT 0 NOT NULL,
	"clicks" double precision DEFAULT 0 NOT NULL,
	"link_clicks" double precision DEFAULT 0 NOT NULL,
	"landing_page_views" double precision DEFAULT 0 NOT NULL,
	"purchases" double precision DEFAULT 0 NOT NULL,
	"purchase_value" double precision DEFAULT 0 NOT NULL,
	"add_to_cart" double precision DEFAULT 0 NOT NULL,
	"initiate_checkout" double precision DEFAULT 0 NOT NULL,
	"leads" double precision DEFAULT 0 NOT NULL,
	"video_views" double precision DEFAULT 0 NOT NULL,
	"thruplays" double precision DEFAULT 0 NOT NULL,
	"post_engagement" double precision DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"error" text,
	"triggered_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'client' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_accounts" ADD CONSTRAINT "client_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_campaigns" ADD CONSTRAINT "client_campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_members" ADD CONSTRAINT "client_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_sets_campaign_idx" ON "ad_sets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ads_campaign_idx" ON "ads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "campaigns_account_idx" ON "campaigns" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "client_members_user_idx" ON "client_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insights_grain_uq" ON "insights" USING btree ("date","ad_id","platform");--> statement-breakpoint
CREATE INDEX "insights_account_date_idx" ON "insights" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "insights_campaign_date_idx" ON "insights" USING btree ("campaign_id","date");