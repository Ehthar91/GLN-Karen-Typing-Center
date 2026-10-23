GLN Karen Typing Center — Classroom Quiz Shift Display Fix
October 23, 2026

WHAT WAS WRONG
Hardware Shift already typed the correct Karen shifted character, but the quiz on-screen keyboard did not redraw its visible labels when Shift was pressed or released.

WHAT THIS PATCH CHANGES
- Physical Shift down displays the Shift layer on the quiz keyboard.
- Physical Shift up restores the normal layer.
- The virtual Shift key still works independently as a toggle.
- Reset physical Shift when the browser loses focus.
- Does not reveal quiz answers, suggest shift, change mappings, or change grading.
- Supports the existing Sgaw, Pwo, and English layouts and classroom quiz.

INSTALL VIA GITHUB WEBSITE
1. Extract this ZIP.
2. Upload/replace quiz.js in the ROOT of your GLN Karen Typing Center repository.
3. Upload/replace index.html in that same ROOT. It includes a new quiz.js version query so student browsers get the updated file.
4. Click Commit changes. Do NOT overwrite type/index.html (the separate dedicated Type page), or delete your type/ folder.
5. Test a typed-response question in Classroom Quiz on a Chromebook: hold physical Shift (visual symbols change), type shifted letter (correct character appears), release Shift (normal symbols return), then click virtual Shift to verify its toggle.
6. If a student sees the old version, reload the page.

NOTE
This patch is based on the latest standalone Type-only site project available in this chat. If your live root index.html has newer custom changes, merge its quiz.js script version change instead of replacing those custom changes.

TESTS
- node --check quiz.js: passed
- keyboard event simulation: passed (normal, Shift down/up, physical typed glyph, double Shift, visual toggle, blur reset)
- full browser navigation: blocked by local environment policy; please test after GitHub Pages publishes.
