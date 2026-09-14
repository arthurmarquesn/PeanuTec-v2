-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "crop" TEXT NOT NULL,
    "planting_date" TEXT NOT NULL,
    "crop_status" TEXT NOT NULL,
    "monitored_diseases" TEXT NOT NULL,
    "previous_crop" TEXT,
    "crop_rotation" BOOLEAN,
    "peanut_repetition_years" INTEGER,
    "had_disease_incidence" BOOLEAN,
    "previous_diseases" TEXT,
    "disease_incidence_level" TEXT,
    "historical_pressure" TEXT,
    "agronomic_history_notes" TEXT,
    "manual_crop_stage" TEXT,
    "crop_stage_updated_at" DATETIME,
    "crop_stage_notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "fields_city_idx" ON "fields"("city");

-- CreateIndex
CREATE INDEX "fields_crop_status_idx" ON "fields"("crop_status");
