CREATE TABLE "saved_schools" (
  "user_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_schools_pkey" PRIMARY KEY ("user_id", "school_id"),
  CONSTRAINT "saved_schools_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_schools_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "school_compare_items" (
  "user_id" INTEGER NOT NULL,
  "school_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_compare_items_pkey" PRIMARY KEY ("user_id", "school_id"),
  CONSTRAINT "school_compare_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "school_compare_items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_saved_schools_school" ON "saved_schools"("school_id");
CREATE INDEX "idx_saved_schools_user_created" ON "saved_schools"("user_id", "created_at");
CREATE INDEX "idx_school_compare_items_school" ON "school_compare_items"("school_id");
CREATE INDEX "idx_school_compare_items_user_created" ON "school_compare_items"("user_id", "created_at");
