-- Progressive hints and reference solutions (PRD F11, CONTENT-SPECIFICATION §3.7–3.8, learning-hub#46).
-- exercises.hints: [{position, cost, bodyMd}] from hints/NN.md; members only get the ones they opened.
-- exercises.solution_md: from the private checker repo; members only get it after their first attempt.
-- hint_unlocks: who opened which hint, for statistics (never lowers a score).

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "hints" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "solution_md" TEXT;

-- CreateTable
CREATE TABLE "hint_unlocks" (
    "user_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_unlocks_pkey" PRIMARY KEY ("user_id","exercise_id","position")
);

-- CreateIndex
CREATE INDEX "hint_unlocks_exercise_id_idx" ON "hint_unlocks"("exercise_id");

-- AddForeignKey
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Positions are 1-based like hints/01.md.
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_position_check" CHECK ("position" >= 1);
