# Classroom Tools Quiz — Multiple Accepted Typed Answers

This patch builds on the most recent **Classroom Tools Quiz with question timers**.
It does not modify the Flashcards quiz.

## Install
Copy `quiz.js` and `index.html` into the same directory of your existing website, replacing the corresponding files. Keep your other files as they are.

If the site is served from a cache, refresh the browser. The index page uses a new version parameter for `quiz.js` to invalidate older cached JavaScript.

## Vocabulary format (no change required)

Play = ဂဲၤ, ဂဲၤလိာ်ကွဲ

The comma separates valid typed responses. In **Type Answer**, a student receives full credit by submitting **either** `ဂဲၤ` **or** `ဂဲၤလိာ်ကွဲ`.
The student does *not* have to type both together. Submitting the complete comma-separated list in a typed question does not count as one answer.

In **Multiple Choice**, the full answer `ဂဲၤ, ဂဲၤလိာ်ကွဲ` stays together as one choice. The correct answer is graded as the complete choice, just as before.
**Mixed** quizzes use the respective rule for each question.

## Scope and compatibility
- Works in solo practice and live Classroom Tools quiz rooms (both pacing modes, with or without timer).
- Trims leading/trailing spaces, collapses repeated spaces, performs Unicode NFC normalization and case-insensitive matching, as the existing quiz did.
- Accepts three or more comma-separated alternatives.
- The teacher preview, correct-answer explanations, and multiple-choice answer choices still display the original full definition.
- In reverse direction, students answer the first item (for example, "Play"); the prompt can still display the complete Karen definitions.
- The on-screen keyboard's next-key hint does not force only the first definition when multiple answers are acceptable.
- Exported Google Forms quizzes remain multiple-choice, with the full answer choice intact.
- No Firebase Rules, database migration, or Flashcards file changes are needed.

## Files in patch
- `quiz.js` — typed-answer grading and keyboard hinting
- `index.html` — teacher-facing guidance and updated script cache version
