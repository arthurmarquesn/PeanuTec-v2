-- CreateTable
CREATE TABLE "analysis_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "field_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "city" TEXT,
    "disease" TEXT NOT NULL,
    "pathogen" TEXT,
    "generated_at" TEXT,
    "climate_risk_index" REAL,
    "agronomic_risk_index" REAL,
    "classification" TEXT,
    "management_relevance" TEXT,
    "main_action" TEXT,
    "result_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_history_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "analysis_history_field_id_idx" ON "analysis_history"("field_id");

-- CreateIndex
CREATE INDEX "analysis_history_disease_idx" ON "analysis_history"("disease");
