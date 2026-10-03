ALTER TABLE "conversation_members" ADD COLUMN "muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "cleared_at" timestamp with time zone;