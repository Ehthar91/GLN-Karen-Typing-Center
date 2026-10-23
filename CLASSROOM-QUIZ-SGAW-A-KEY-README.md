# Classroom Tools Quiz — S'gaw Karen A key change

## What's changed

- In **Classroom Tools → Quiz**, when **S'gaw Karen** is selected, the **unshifted A key** displays and inserts **ရှ** instead of **ေ**.
- The change applies to both the **on-screen keyboard** (desktop/Chromebook and mobile) and typing **A** on a physical keyboard while taking a typed-answer quiz.
- **Shift+A** stays as originally mapped (`∕`).
- The **Pwo Karen** and **English** A keys are unchanged.
- **Typing Center, practice, games, Flashcards, and other keyboards are unchanged**. The `app.js` update only adds an optional layout override used by the Classroom Tools Quiz.
- The earlier Classroom Quiz improvements, including accepting any one comma-separated typed definition and not displaying answer-based typing hints, remain in place.

## Install

Replace these three files on the existing website, keeping their names and locations:

1. `app.js`
2. `quiz.js`
3. `index.html`

Publish the website, then reload the classroom quiz on student devices. `index.html` changes the script cache versions so browsers fetch the update.

No Firebase rules changes are required.
