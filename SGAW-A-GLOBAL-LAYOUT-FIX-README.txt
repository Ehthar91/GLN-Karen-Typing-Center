GLN KAREN TYPING CENTER — SGAW KAREN A KEY FIX
================================================

WHAT WAS WRONG
The earlier Sgaw A-key patch changed the Classroom Quiz keyboard only.
The main Typing Center still had A = ေ, so the layout appeared unchanged there.

FIXED BEHAVIOR
Sgaw Karen: A = ရှ, Shift+A = ∕
Pwo Karen:  A = ေ, Shift+A = ဗ (unchanged)
English:     A = a, Shift+A = A (unchanged)

The shared Sgaw mapping now works in the main Typing Center, typing practice,
games, races, and Classroom Tools Quiz. Both the visual keyboard and physical
keyboard use the matching layout when Sgaw Karen is selected.

PATCH INSTALLATION
Upload/replace these three files at the ROOT of your existing GitHub Pages
repository (next to CNAME and the other JS/CSS files):
  app.js
  quiz.js
  index.html
Do NOT upload the patch folder itself. Commit the changes, then check the
GitHub Pages deployment has completed. Reload the page using Ctrl+Shift+R
(Chromebook/Windows) or Cmd+Shift+R (Mac). For an existing browser tab,
closing and reopening the page also helps.

TEST
1. Open Typing Center, select Sgaw Karen, and switch Shift OFF.
2. The A key on the visible keyboard should display ရှ.
3. Click A (or press the physical A key in the editor): it should type ရှ.
4. Switch to Pwo Karen: A should still display and type ေ.
5. Go to Classroom Tools -> Quiz, start a typed-answer question,
   select Sgaw Karen: A should display and type ရှ without revealing hints.

IF STILL UNCHANGED
Verify index.html, app.js, quiz.js are directly at the repository ROOT,
not nested inside 01-Website-Files or an upload batch folder. Open the deployed
site's view source to verify its app.js URL ends in
?v=20261022-sgaw-a-global-fix-2. If the old version is shown, GitHub Pages
has not yet published the new index.html or the old page is cached.

This update does not modify Firebase rules or the Flashcards application.
