CREATE TABLE "refresh_sessions" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "session_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "user_agent" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_sessions_session_hash_key" ON "refresh_sessions"("session_hash");
CREATE INDEX "idx_refresh_sessions_user_revoked" ON "refresh_sessions"("user_id", "revoked_at");
CREATE INDEX "idx_refresh_sessions_expires" ON "refresh_sessions"("expires_at");

ALTER TABLE "refresh_sessions"
ADD CONSTRAINT "refresh_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
