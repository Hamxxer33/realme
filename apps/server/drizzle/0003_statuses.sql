CREATE TABLE "status_views" (
	"status_id" uuid NOT NULL,
	"viewer_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_views_status_id_viewer_id_pk" PRIMARY KEY("status_id","viewer_id")
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"nonce" text NOT NULL,
	"ciphertext" text NOT NULL,
	"keys" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_status_id_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_views" ADD CONSTRAINT "status_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statuses_author_idx" ON "statuses" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "statuses_expires_idx" ON "statuses" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "statuses_author_client_unique" ON "statuses" USING btree ("author_id","client_id");