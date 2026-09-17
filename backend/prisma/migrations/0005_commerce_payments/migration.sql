CREATE TYPE "CartItemType" AS ENUM ('SCHOOL_SERVICE', 'ADVISOR_PACKAGE');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "cart_items" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "type" "CartItemType" NOT NULL,
  "school_id" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cart_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cart_items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "orders" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "items_total_cents" INTEGER NOT NULL,
  "discount_total_cents" INTEGER NOT NULL,
  "payable_total_cents" INTEGER NOT NULL,
  "pricing_breakdown" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "order_items" (
  "id" SERIAL PRIMARY KEY,
  "order_id" INTEGER NOT NULL,
  "type" "CartItemType" NOT NULL,
  "school_id" INTEGER,
  "title" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_amount_cents" INTEGER NOT NULL,
  "original_amount_cents" INTEGER NOT NULL,
  "discount_amount_cents" INTEGER NOT NULL,
  "payable_amount_cents" INTEGER NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_items_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "payments" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "order_id" INTEGER NOT NULL,
  "provider_txn_id" VARCHAR(120) NOT NULL UNIQUE,
  "amount_cents" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "payment_callback_logs" (
  "id" SERIAL PRIMARY KEY,
  "payment_id" INTEGER,
  "provider_txn_id" VARCHAR(120),
  "payload" JSONB NOT NULL,
  "signature_ok" BOOLEAN NOT NULL DEFAULT false,
  "amount_ok" BOOLEAN NOT NULL DEFAULT false,
  "result" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_callback_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "idx_cart_items_user_created" ON "cart_items"("user_id", "created_at");
CREATE INDEX "idx_cart_items_school" ON "cart_items"("school_id");
CREATE INDEX "idx_orders_user_created" ON "orders"("user_id", "created_at");
CREATE INDEX "idx_orders_status_created" ON "orders"("status", "created_at");
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");
CREATE INDEX "idx_order_items_school" ON "order_items"("school_id");
CREATE INDEX "idx_payments_user_created" ON "payments"("user_id", "created_at");
CREATE INDEX "idx_payments_order_created" ON "payments"("order_id", "created_at");
CREATE INDEX "idx_payments_status_created" ON "payments"("status", "created_at");
CREATE INDEX "idx_payment_callback_logs_payment_created" ON "payment_callback_logs"("payment_id", "created_at");
CREATE INDEX "idx_payment_callback_logs_provider_created" ON "payment_callback_logs"("provider_txn_id", "created_at");
