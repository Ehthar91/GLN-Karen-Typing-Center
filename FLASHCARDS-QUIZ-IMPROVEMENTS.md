# Flashcards Quiz Improvements

This patch improves the built-in Flashcards quiz experience.

## New features

- Feedback timing setting:
  - **After Each Question** — practice mode with immediate correct/incorrect feedback.
  - **At the End** — test mode; answers are recorded without revealing correctness until results.
- The feedback timing setting is included in **Save as My Default**.
- Test mode shows **Answered X / Y** instead of a live score.
- The progress bar advances as each answer is submitted.
- The last button changes to **See Results**.
- Results now show **Correct**, **Score**, and **Missed**.
- **Retry Missed** lets a student immediately practice only missed questions.
- **Try Full Quiz Again** restarts the full original quiz.
- Multiple-choice keyboard shortcuts:
  - A-D or 1-4 selects an answer.
  - Enter or Right Arrow advances after answering.
- Typed-answer quizzes can press Enter to submit and Enter again to continue.

## Files changed

- `flashcards-app.js`
- `flashcards.html`
- `flashcards-styles.css`

No Firebase rules changes are required for this patch.
