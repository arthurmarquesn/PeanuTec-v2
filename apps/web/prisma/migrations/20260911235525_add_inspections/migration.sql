-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "field_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "disease" TEXT NOT NULL,
    "symptoms_found" BOOLEAN NOT NULL,
    "visual_severity" TEXT NOT NULL,
    "defoliation_level" TEXT NOT NULL,
    "action_taken" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "inspected_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "general_status" TEXT,
    "problem_distribution" TEXT,
    "pests_found" BOOLEAN,
    "pest_notes" TEXT,
    "weeds_found" BOOLEAN,
    "weed_pressure" TEXT,
    "soil_condition" TEXT,
    "return_needed" BOOLEAN,
    "return_days" INTEGER,
    "observed_area" TEXT,
    "responsible" TEXT,
    CONSTRAINT "inspections_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "inspections_field_id_idx" ON "inspections"("field_id");

-- CreateIndex
CREATE INDEX "inspections_inspected_at_idx" ON "inspections"("inspected_at");
