CREATE TYPE "public"."entitlement_source" AS ENUM('stripe', 'grant');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."module" AS ENUM('barcode', 'insights', 'recipes', 'data', 'all');--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module" "module" NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"status" "entitlement_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"stripe_subscription_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "fiber_g" real;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "sugar_g" real;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "sat_fat_g" real;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "sodium_mg" real;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "sugar_g" real;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "sat_fat_g" real;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "sodium_mg" real;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "fiber_g" real;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "sugar_g" real;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "sat_fat_g" real;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "sodium_mg" real;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_subscription_module_uq" ON "entitlements" USING btree ("stripe_subscription_id","module") WHERE "entitlements"."stripe_subscription_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_grant_uq" ON "entitlements" USING btree ("user_id","module") WHERE "entitlements"."source" = 'grant';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id");