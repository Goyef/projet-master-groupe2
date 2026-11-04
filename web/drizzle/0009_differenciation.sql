CREATE TABLE "mood_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day" date NOT NULL,
	"mood" integer NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_entries_user_day_unique" UNIQUE("user_id","day"),
	CONSTRAINT "mood_entries_mood_check" CHECK ("mood_entries"."mood" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "session_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"appointment_id" integer NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"appointment_id" integer PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"type" text NOT NULL,
	"locale" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "waitlist_entries_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "preparation" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_actions" ADD CONSTRAINT "session_actions_appointment_id_session_notes_appointment_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."session_notes"("appointment_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_actions_appointment_idx" ON "session_actions" USING btree ("appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_type_idx" ON "waitlist_entries" USING btree ("email","type");