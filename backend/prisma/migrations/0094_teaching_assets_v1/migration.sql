CREATE TABLE "teaching_assets" (
    "id" TEXT NOT NULL,
    "stable_key" VARCHAR(160) NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "subject_code" VARCHAR(24) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teaching_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teaching_assets_type_check" CHECK ("type" IN ('concept_card','worked_example','contrast_example','guided_correction_template','interactive_demo','micro_lesson','retrieval_check','video_lesson')),
    CONSTRAINT "teaching_assets_status_check" CHECK ("status" IN ('draft','review','approved','published','retired'))
);

CREATE TABLE "teaching_asset_versions" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'draft',
    "language" VARCHAR(24) NOT NULL DEFAULT 'zh-CN',
    "difficulty_band" VARCHAR(40) NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "renderer" VARCHAR(40) NOT NULL,
    "component_key" VARCHAR(120),
    "component_version" VARCHAR(40),
    "payload_schema_version" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL,
    "fallback_payload" JSONB NOT NULL,
    "source_refs" JSONB NOT NULL DEFAULT '[]',
    "review_state" VARCHAR(40) NOT NULL,
    "reviewed_by_user_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "teaching_asset_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teaching_asset_versions_status_check" CHECK ("status" IN ('draft','review','approved','published','retired')),
    CONSTRAINT "teaching_asset_versions_renderer_check" CHECK ("renderer" IN ('rich_text','step_sequence','interactive_component','video')),
    CONSTRAINT "teaching_asset_versions_minutes_check" CHECK ("estimated_minutes" BETWEEN 1 AND 120)
);

CREATE TABLE "teaching_asset_topics" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "relationship" VARCHAR(24) NOT NULL DEFAULT 'primary',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "teaching_asset_topics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teaching_asset_topics_relationship_check" CHECK ("relationship" IN ('primary','prerequisite'))
);

CREATE TABLE "teaching_asset_exposures" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "asset_id" TEXT NOT NULL,
    "asset_version_id" TEXT NOT NULL,
    "context_key" VARCHAR(180) NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "exposure_level" VARCHAR(16) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'opened',
    "snapshot" JSONB NOT NULL,
    "first_exposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_exposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "teaching_asset_exposures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teaching_asset_exposures_status_check" CHECK ("status" IN ('opened','active_prompt_answered','completed','skipped'))
);

CREATE TABLE "teaching_interaction_events" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "asset_version_id" TEXT NOT NULL,
    "context_key" VARCHAR(180) NOT NULL,
    "client_request_id" VARCHAR(120) NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "teaching_interaction_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teaching_interaction_events_action_check" CHECK ("action" IN ('opened','parameter_changed','active_prompt_answered','completed','skipped'))
);

CREATE UNIQUE INDEX "teaching_assets_stable_key_key" ON "teaching_assets"("stable_key");
CREATE INDEX "idx_teaching_assets_subject_type_status" ON "teaching_assets"("subject_code", "type", "status");
CREATE UNIQUE INDEX "uq_teaching_asset_version" ON "teaching_asset_versions"("asset_id", "version");
CREATE INDEX "idx_teaching_asset_versions_status_published" ON "teaching_asset_versions"("status", "published_at");
CREATE UNIQUE INDEX "uq_teaching_asset_topic_binding" ON "teaching_asset_topics"("asset_id", "topic_id", "relationship");
CREATE INDEX "idx_teaching_asset_topics_topic_relationship" ON "teaching_asset_topics"("topic_id", "relationship");
CREATE UNIQUE INDEX "uq_teaching_asset_exposure_context" ON "teaching_asset_exposures"("user_id", "asset_version_id", "context_key");
CREATE INDEX "idx_teaching_asset_exposures_user_last" ON "teaching_asset_exposures"("user_id", "last_exposed_at");
CREATE UNIQUE INDEX "uq_teaching_interaction_user_request" ON "teaching_interaction_events"("user_id", "client_request_id");
CREATE INDEX "idx_teaching_interactions_user_asset_created" ON "teaching_interaction_events"("user_id", "asset_version_id", "created_at");

ALTER TABLE "teaching_asset_versions" ADD CONSTRAINT "teaching_asset_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "teaching_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_asset_topics" ADD CONSTRAINT "teaching_asset_topics_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "teaching_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_asset_topics" ADD CONSTRAINT "teaching_asset_topics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "csca_exam_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_asset_exposures" ADD CONSTRAINT "teaching_asset_exposures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_asset_exposures" ADD CONSTRAINT "teaching_asset_exposures_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "teaching_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teaching_asset_exposures" ADD CONSTRAINT "teaching_asset_exposures_asset_version_id_fkey" FOREIGN KEY ("asset_version_id") REFERENCES "teaching_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teaching_interaction_events" ADD CONSTRAINT "teaching_interaction_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teaching_interaction_events" ADD CONSTRAINT "teaching_interaction_events_asset_version_id_fkey" FOREIGN KEY ("asset_version_id") REFERENCES "teaching_asset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
