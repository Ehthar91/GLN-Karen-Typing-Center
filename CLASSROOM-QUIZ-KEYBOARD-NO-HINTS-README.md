# Classroom Tools Quiz — No Answer Hints on Keyboard

## What changed
- Disabled answer-dependent highlighted keys, next-letter hints, and automatic Shift recommendations in student typed-answer quiz questions.
- Students can toggle the on-screen **Shift** or **Caps** keys manually to access the alternate Karen/English characters on desktop or mobile.
- A new question starts in the normal (unshifted) keyboard layout.
- This change only applies to the Classroom Tools Quiz keyboard. Typing practice and other games keep their own keyboard guidance.
- Existing Type Answer grading still accepts any ONE comma-separated definition (e.g., `Play = ဂဲၤ, ဂဲၤလိာ်ကွဲ`). Multiple Choice still shows and scores the full combined answer.

## Install patch only
Replace these three files in the website root:
1. `quiz.js`
2. `quiz.css`
3. `index.html` (updates the asset version strings to refresh student browsers)

Publish and refresh the website. For old/open student tabs, reload them before beginning a new quiz. No Firebase rules update is needed.

## Checks
- JavaScript syntax check passes.
- Desktop and mobile keyboards no longer receive any answer-based key hints.
- Manual Shift toggle and original multiple-answer grading checks pass.
- Live classroom session should still be checked in your deployed Firebase environment.
