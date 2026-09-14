-- CreateTable
CREATE TABLE "spray_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "field_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "application_date" DATETIME NOT NULL,
    "product_id" TEXT,
    "product" TEXT NOT NULL,
    "product_type" TEXT,
    "target" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "responsible" TEXT NOT NULL DEFAULT '',
    "planned_interval_days" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "generate_reapplication" BOOLEAN NOT NULL DEFAULT false,
    "reapplication_interval_days" INTEGER,
    "reapplication_date" TEXT,
    "reapplication_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spray_applications_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spray_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "field_id" TEXT,
    "field_name" TEXT,
    "date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT '',
    "product_type" TEXT,
    "target" TEXT NOT NULL DEFAULT '',
    "planned_interval_days" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "color_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source_type" TEXT,
    "source_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_events_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "spray_applications_field_id_idx" ON "spray_applications"("field_id");

-- CreateIndex
CREATE INDEX "spray_applications_product_id_idx" ON "spray_applications"("product_id");

-- CreateIndex
CREATE INDEX "spray_applications_application_date_idx" ON "spray_applications"("application_date");

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- CreateIndex
CREATE INDEX "calendar_events_field_id_idx" ON "calendar_events"("field_id");

-- CreateIndex
CREATE INDEX "calendar_events_event_type_idx" ON "calendar_events"("event_type");

-- CreateIndex
CREATE INDEX "calendar_events_source_type_source_id_idx" ON "calendar_events"("source_type", "source_id");
