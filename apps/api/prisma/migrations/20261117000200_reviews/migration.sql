-- E7 mentor review. The status CHECK (reviews_status_chk) and the "one open review per
-- submission" index (reviews_one_open_uq) already exist since 20261116000100_constraints;
-- the review flow relies on that index to turn a double claim into a 409.

-- Rubric scores of a finished review: [{ "criterion", "weight", "score" }, ...].
-- The weight is copied in, so the total stays the same if the rubric changes later.
ALTER TABLE reviews ADD COLUMN rubric_scores JSONB NULL;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rubric_scores_chk CHECK (rubric_scores IS NULL OR jsonb_typeof(rubric_scores) = 'array'),
  -- A finished review always has its completion time; an open one never does.
  ADD CONSTRAINT reviews_submitted_at_chk CHECK ((status = 'in_progress') = (submitted_at IS NULL));

-- "Reviews I am doing" and audit lookups by reviewer.
CREATE INDEX reviews_reviewer_idx ON reviews (reviewer_id, status);
