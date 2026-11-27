-- New bell type (learning-hub#131): an admin gave, changed or removed a mentee's mentor.
-- The mentee, the new mentor and the previous mentor each get a row. DATABASE §3.16c.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_chk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_chk"
    CHECK ("type" IN ('review_completed', 'review_requested', 'track_published',
                      'review_message', 'review_thanks', 'content_report',
                      'mentor_assignment'));
