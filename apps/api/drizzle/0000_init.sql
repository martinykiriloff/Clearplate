CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'light', 'moderate', 'active', 'very_active');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('seed', 'user', 'open_food_facts');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('lose', 'gain', 'habits');--> statement-breakpoint
CREATE TYPE "public"."meal" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."pace" AS ENUM('gentle', 'standard', 'fast');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."target_source" AS ENUM('questionnaire', 'manual', 'adaptive');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal" "meal" NOT NULL,
	"food_id" uuid,
	"recipe_id" uuid,
	"label" text NOT NULL,
	"grams" real,
	"servings" real,
	"kcal" real NOT NULL,
	"protein_g" real NOT NULL,
	"fat_g" real NOT NULL,
	"carbs_g" real NOT NULL,
	"is_estimate" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"barcode" text,
	"category" text,
	"kcal" real NOT NULL,
	"protein_g" real NOT NULL,
	"fat_g" real NOT NULL,
	"carbs_g" real NOT NULL,
	"fiber_g" real,
	"serving_g" real,
	"serving_name" text,
	"source" "food_source" DEFAULT 'seed' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "foods_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sex" "sex" NOT NULL,
	"birth_date" date NOT NULL,
	"height_cm" real NOT NULL,
	"activity" "activity_level" NOT NULL,
	"goal" "goal" NOT NULL,
	"pace" "pace" DEFAULT 'standard' NOT NULL,
	"target_weight_kg" real,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	"health_data_consent_at" timestamp with time zone NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"meal_type" "meal" NOT NULL,
	"base" text,
	"ingredients" text NOT NULL,
	"method" text NOT NULL,
	"servings" integer DEFAULT 1 NOT NULL,
	"kcal" real NOT NULL,
	"protein_g" real NOT NULL,
	"fat_g" real NOT NULL,
	"carbs_g" real NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"source" "target_source" NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"bmr" integer NOT NULL,
	"tdee" integer NOT NULL,
	"warnings" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_sets" ADD CONSTRAINT "target_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diary_user_date_idx" ON "diary_entries" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_provider_account_uq" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipes_meal_idx" ON "recipes" USING btree ("meal_type");--> statement-breakpoint
CREATE INDEX "recipes_owner_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "recipes_name_trgm_idx" ON "recipes" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "target_sets_user_date_idx" ON "target_sets" USING btree ("user_id","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_user_date_uq" ON "weight_entries" USING btree ("user_id","date");