CREATE TABLE "answer_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"media_ref" text,
	"mime_type" text,
	"duration_ms" integer,
	"recorded_at" timestamp with time zone,
	"upload_status" text DEFAULT 'pending' NOT NULL,
	"analysis_status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_attempts_session_question_key" UNIQUE("session_id","question_id"),
	CONSTRAINT "answer_attempts_mode_check" CHECK ("answer_attempts"."mode" in ('technical', 'behavioral')),
	CONSTRAINT "answer_attempts_duration_ms_check" CHECK ("answer_attempts"."duration_ms" is null or "answer_attempts"."duration_ms" >= 0),
	CONSTRAINT "answer_attempts_upload_status_check" CHECK ("answer_attempts"."upload_status" in ('pending', 'uploading', 'uploaded', 'failed')),
	CONSTRAINT "answer_attempts_analysis_status_check" CHECK ("answer_attempts"."analysis_status" in ('not_started', 'queued', 'processing', 'completed', 'failed')),
	CONSTRAINT "answer_attempts_uploaded_media_check" CHECK ("answer_attempts"."upload_status" <> 'uploaded' or "answer_attempts"."media_ref" is not null)
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "interview_sessions_id_mode_key" UNIQUE("id","mode"),
	CONSTRAINT "interview_sessions_mode_check" CHECK ("interview_sessions"."mode" in ('technical', 'behavioral')),
	CONSTRAINT "interview_sessions_status_check" CHECK ("interview_sessions"."status" in ('in_progress', 'completed', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"prompt" text NOT NULL,
	"sequence" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_mode_sequence_key" UNIQUE("mode","sequence"),
	CONSTRAINT "questions_id_mode_key" UNIQUE("id","mode"),
	CONSTRAINT "questions_mode_check" CHECK ("questions"."mode" in ('technical', 'behavioral')),
	CONSTRAINT "questions_sequence_check" CHECK ("questions"."sequence" >= 0)
);
--> statement-breakpoint
ALTER TABLE "answer_attempts" ADD CONSTRAINT "answer_attempts_session_mode_fkey" FOREIGN KEY ("session_id","mode") REFERENCES "public"."interview_sessions"("id","mode") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_attempts" ADD CONSTRAINT "answer_attempts_question_mode_fkey" FOREIGN KEY ("question_id","mode") REFERENCES "public"."questions"("id","mode") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_answer_attempts_question_id" ON "answer_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_interview_sessions_clerk_user_id" ON "interview_sessions" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_interview_sessions_updated_at
    BEFORE UPDATE ON interview_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER trg_answer_attempts_updated_at
    BEFORE UPDATE ON answer_attempts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
