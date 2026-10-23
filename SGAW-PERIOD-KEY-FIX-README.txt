GLN Karen Typing Center — Sgaw Period Key Update
================================================

WHAT CHANGED
For Sgaw Karen, the unshifted period (.) key now displays and types "."
instead of "ၣ်", both on-screen and on the physical keyboard.

WHAT STAYS THE SAME
- Sgaw Shift + Period = ၢ်
- Sgaw A = ရှ, Shift + A = ∕
- Sgaw Shift + O = ၣ်; Shift + I = ၢ် (verified in the current layout)
- All other Sgaw keys, Pwo Karen, and English mappings unchanged
- Classroom Tools Quiz uses the same shared Sgaw layout
- No answer hints are introduced in Classroom Quiz

PATCH INSTALLATION
Upload/replace these files at the ROOT of your existing GitHub Pages repository:
  app.js
  index.html
Don't upload the containing ZIP or a patch folder to the repository root.
Commit, confirm GitHub Pages publishes the site, and hard-refresh (Ctrl+Shift+R
on Chromebook/Windows or Cmd+Shift+R on Mac). The HTML has a new script
version so the browser requests the updated app.js.

TEST
1. Choose Sgaw Karen on the main Typing Center with Shift off.
2. The . key should show "." and type a plain period.
3. Shift + . should still show and type ၢ်.
4. In Classroom Tools -> Quiz, open a typed-answer question and select Sgaw;
   the . key should produce a plain period as well.
5. Check Pwo Karen and English: neither period-key mapping was changed.

No changes to Firebase rules, Flashcards, or quiz scoring.
