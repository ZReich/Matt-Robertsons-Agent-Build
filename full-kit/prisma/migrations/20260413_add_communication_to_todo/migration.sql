-- AlterTable: add communication_id foreign key to todos
ALTER TABLE "todos" ADD COLUMN "communication_id" TEXT;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "todos_communication_id_idx" ON "todos"("communication_id");
