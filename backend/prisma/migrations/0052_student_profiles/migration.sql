CREATE TABLE "student_profiles" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "nationality" VARCHAR(120),
  "country" VARCHAR(120),
  "grade" VARCHAR(80),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");
