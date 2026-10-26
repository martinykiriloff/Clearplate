CREATE TYPE "public"."locale" AS ENUM('en', 'bg');--> statement-breakpoint
ALTER TABLE "diary_entries" ADD COLUMN "label_bg" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "name_bg" text;--> statement-breakpoint
ALTER TABLE "foods" ADD COLUMN "serving_name_bg" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "name_bg" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "ingredients_bg" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "method_bg" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" "locale" DEFAULT 'en' NOT NULL;--> statement-breakpoint
CREATE INDEX "foods_name_bg_trgm_idx" ON "foods" USING gin ("name_bg" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "recipes_name_bg_trgm_idx" ON "recipes" USING gin ("name_bg" gin_trgm_ops);