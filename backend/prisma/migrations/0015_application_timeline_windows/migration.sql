CREATE TABLE "application_timeline_windows" (
  "id" SERIAL NOT NULL,
  "month" VARCHAR(20) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "application_window" VARCHAR(240) NOT NULL,
  "csca_window" VARCHAR(240) NOT NULL,
  "status" "SchoolStatus" NOT NULL DEFAULT 'published',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "application_timeline_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_application_timeline_windows_status_sort" ON "application_timeline_windows"("status", "sort_order");
