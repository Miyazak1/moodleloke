ALTER TABLE "special_practice_topics"
ADD COLUMN "overview" TEXT,
ADD COLUMN "focus_items" JSONB,
ADD COLUMN "study_advice" TEXT,
ADD COLUMN "difficulty_label" VARCHAR(80),
ADD COLUMN "frequency_label" VARCHAR(80),
ADD COLUMN "related_resources" JSONB,
ADD COLUMN "related_visualizer_slug" VARCHAR(140);
