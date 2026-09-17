ALTER TABLE "past_papers"
ADD COLUMN "source_document_id" INTEGER;

CREATE INDEX "idx_past_papers_source_document"
ON "past_papers"("source_document_id");

ALTER TABLE "past_papers"
ADD CONSTRAINT "past_papers_source_document_id_fkey"
FOREIGN KEY ("source_document_id") REFERENCES "csca_source_documents"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
