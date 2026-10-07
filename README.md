KLGA Student Rejoin / Stale Firebase UID Fix

Replace:
- app.js
- firestore.rules

IMPORTANT:
Updating firestore.rules in your website files is not enough by itself.
Publish/deploy the updated Firestore rules in Firebase Console:

Firebase Console → Firestore Database → Rules
Paste the contents of firestore.rules → Publish

What this fix does:
- Lets an assigned student reclaim a stale session record after changing Chromebook/browser when the old status is Waiting, Paused, or Terminated.
- Preserves saved progress when reclaiming a Paused attempt.
- Does NOT allow a new browser UID to take over an Approved, Testing, Speed Review, or Finished attempt.
- Shows a visible student-facing error if Continue cannot complete, instead of silently doing nothing.

If a student's old attempt is still Approved/Testing/Speed Review:
Teacher should End Test or Terminate & Restart first, then have the student join again.
