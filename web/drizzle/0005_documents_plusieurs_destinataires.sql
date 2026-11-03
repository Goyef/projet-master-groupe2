CREATE TABLE "document_recipients" (
	"document_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "document_recipients_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "all_clients" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_recipients" ADD CONSTRAINT "document_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_recipients_user_idx" ON "document_recipients" USING btree ("user_id");--> statement-breakpoint
-- Reprise des partages existants : sans destinataire = tous les clients, sinon le client choisi.
UPDATE "documents" SET "all_clients" = true WHERE "user_id" IS NULL;--> statement-breakpoint
INSERT INTO "document_recipients" ("document_id", "user_id") SELECT "id", "user_id" FROM "documents" WHERE "user_id" IS NOT NULL;
