# Classroom Tools Quiz — teacher dashboard improvements

This patch updates the **Classroom Tools → Quiz**, not the separate Flashcards quiz.

## Apply the patch
1. Back up your current website files.
2. Extract the ZIP and overwrite the three matching files in the website root:
   - `index.html`
   - `quiz-classroom.js`
   - `quiz-classroom.css`
3. Publish the site. Hard-refresh any open quiz/teacher pages (Ctrl+Shift+R or Cmd+Shift+R).
4. Start a **new** classroom quiz room and verify the teacher dashboard.

No Firebase rules or database migration needed. The patch retains the existing classroom room schema and student sign-in flow.

## What's new
- Teacher live totals: joined, online, and answered the current question (or finished in student-paced mode).
- Search students by name and sort the live scoreboard by score, progress, or name.
- Show/Hide answer button, hidden by default on the teacher view, for sharing/projecting a teacher display. This only conceals the displayed text; it is **not** a security boundary and does not change answer visibility in the Firebase data.
- Warn before manually advancing to the next question while **connected** students have not yet submitted. You may confirm to advance anyway.
- Export a teacher-only CSV from the live dashboard or results screen, with name, score, total, percentage, answered count, status, connection state and finish time. Data is the currently stored room snapshot; export before closing a room. UTF-8 with BOM supports Karen text in spreadsheet software. CSV formula injection protection is included.

## Unchanged
- Flashcards and Flashcards Quiz
- Existing quiz generation, Google Forms export, student input and answer scoring
- Teacher-paced vs student-paced settings, automatic advancement and screen lock
- Firebase rules (no changes required)

## Note on CSV
The existing classroom room data stores per-question completion times, not full response text, so the CSV is a student summary rather than a per-question answer report.
