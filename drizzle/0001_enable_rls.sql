-- Supabase exposes the public schema through its Data API (PostgREST).
-- The app connects as the table owner, which bypasses RLS, so enabling RLS with
-- no policies blocks anon/authenticated API access without affecting the app.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "client_campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_runs" ENABLE ROW LEVEL SECURITY;
