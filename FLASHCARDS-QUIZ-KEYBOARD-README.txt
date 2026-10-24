GLN Typing Center — Flashcards Quiz Type Answer Keyboard
October 23, 2026

New feature
- On-screen keyboard available ONLY during Flashcards > Quiz > Type Answer.
- Switch among Sgaw Karen / Pwo Karen / English.
- Shared Karen Unicode mappings from typing-layouts.js. Sgaw A = ရှ, . = . and Shift+. = ၢ်.
- Click/tap characters; Backspace, Space, Check/Enter, and Shift controls.
- Physical keyboard Karen character mapping and live Shift display update.
- English remains the default to avoid changing previously normal English typing unexpectedly.
- Language preference is saved on the device.
- No quiz answer hints: keyboard labels only describe the selected typing layout.
- Multiple-choice mode and answer scoring are unchanged.
- Previous Classroom Quiz Shift fix and main Type navigation fix stay intact in the full project.

GitHub web upload (in your repository root)
1. Unzip the PATCH ONLY archive.
2. Upload the FOUR files from the ZIP to the repository ROOT (not /type/).
3. Replace existing flashcards.html, flashcards-app.js, flashcards-styles.css and typing-layouts.js.
4. Commit the changes. Don't delete other files.
5. Open Flashcards > Quiz > Type Answer. Use the Sgaw Karen button when typing Karen.
6. Hard refresh the tab if old JavaScript is cached.

No Firestore rules, Firebase config, or /type/index.html changes required.
Verification: node --check passed and a focused Node JavaScript keyboard test passed.
Live full-site browser integration could not be completed in this environment.
