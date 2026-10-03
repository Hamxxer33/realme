CREATE TABLE "couples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"partner_id" uuid,
	"invite_code" text,
	"invite_expires_at" timestamp with time zone,
	"settings_nonce" text,
	"settings_ciphertext" text,
	"settings_updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"nonce" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"auth_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"public_key" text NOT NULL,
	"key_backup_nonce" text NOT NULL,
	"key_backup_ciphertext" text NOT NULL,
	"couple_id" uuid,
	"push_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "couples" ADD CONSTRAINT "couples_partner_id_users_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "couples_invite_code_unique" ON "couples" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "memories_couple_created_idx" ON "memories" USING btree ("couple_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_couple_created_idx" ON "messages" USING btree ("couple_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_sender_client_unique" ON "messages" USING btree ("sender_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));