CREATE TABLE "campaign_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_settings" (
	"client_id" uuid NOT NULL,
	"campaign_id" text NOT NULL,
	"display_name" text,
	"group_id" uuid,
	"goal" text,
	CONSTRAINT "campaign_settings_client_id_campaign_id_pk" PRIMARY KEY("client_id","campaign_id")
);
--> statement-breakpoint
CREATE TABLE "member_groups" (
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	CONSTRAINT "member_groups_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "client_members" ADD COLUMN "restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_groups" ADD CONSTRAINT "campaign_groups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_group_id_campaign_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."campaign_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_groups" ADD CONSTRAINT "member_groups_group_id_campaign_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."campaign_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_groups_client_idx" ON "campaign_groups" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "member_groups_client_user_idx" ON "member_groups" USING btree ("client_id","user_id");--> statement-breakpoint
ALTER TABLE "campaign_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaign_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "member_groups" ENABLE ROW LEVEL SECURITY;
