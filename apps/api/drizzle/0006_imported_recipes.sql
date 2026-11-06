ALTER TABLE "recipes" ADD COLUMN "cuisine" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_name" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "estimate_coverage" real;--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_source_url_uq" ON "recipes" USING btree ("source_url") WHERE "recipes"."source_url" is not null;