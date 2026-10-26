ALTER TABLE "foods" DROP CONSTRAINT "foods_barcode_unique";--> statement-breakpoint
ALTER TABLE "foods" DROP CONSTRAINT "foods_created_by_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_catalogue_barcode_uq" ON "foods" USING btree ("barcode") WHERE "foods"."created_by_id" is null and "foods"."barcode" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_user_barcode_uq" ON "foods" USING btree ("created_by_id","barcode") WHERE "foods"."created_by_id" is not null and "foods"."barcode" is not null;