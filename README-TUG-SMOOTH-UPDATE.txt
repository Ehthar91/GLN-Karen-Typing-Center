GLN TYPING TUG OF WAR — SMOOTHER GAME UPDATE (2026-10-24)

WHAT CHANGED
- Stable live arena: Firebase updates modify existing player avatars and scoreboard rows instead of tearing them down and re-creating them.
- New lightweight WebP avatars (8 images), with the original PNGs retained as fallback.
- Cleaner rope placement and smooth movement in Classic Light + Gaming RGB.
- Phone-friendly arena, team scores and compact scoreboard.
- Teachers can use one sentence per line with commas preserved; a single-line comma-separated word list still works.
- Original Firebase room codes, team assignment, scores, winning rules, normal/shift keyboard and creator badge remain unchanged.

DEPLOY THE PATCH
Open the ZIP's UPLOAD-ROOT folder. Upload all 11 files INSIDE this folder to the TOP LEVEL of your GitHub website repository (alongside app.js).
IMPORTANT: don't upload the UPLOAD-ROOT folder itself.
Commit changes. Open the website, refresh hard (Mac Chrome: Command + Shift + R), and test Games > Typing Tug of War.

FILES
index.html
custom-games.js
tug-polish.css
8 tug-avatar-*.webp files

NOTE: The new WebP images are separate files. Upload all eight, or avatars will fall back to the existing PNGs.
No Firebase schema/rules change is required.

TESTED
- JS syntax
- Original tug score, rope and win calculation
- Comma-preserving lesson input
- Isolated Chromium DOM render at desktop + mobile widths with incremental avatar and score updates
- New WebP image decoding and size
- ZIP integrity and preserved non-game site files

NOT YET TESTED
- Real multi-device Firebase room session, concurrent users, or live GitHub Pages publishing. Validate with a teacher host and two student devices before classroom use.

ROLLBACK
To undo, restore index.html and custom-games.js from your prior build. The new tug-polish.css and WebP files can be left unused or deleted.
