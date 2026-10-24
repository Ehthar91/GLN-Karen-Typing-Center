# Dedicated GLN Type Page — October 2026

This release adds a stand-alone Unicode typing studio **without other website section tabs** at:
https://glnkarentypingcenter.com/type/

## Install the patch
Upload/replace each patch file in the same relative location in the GitHub repository root.

Changed files:
- `index.html` — launcher on the previous Type view and shared layout script loaded before the original app.
- `practice.js` — Type navigation button now opens the dedicated page.
- `app.js` — original typing view now reads the shared layout (otherwise unchanged).

New files:
- `typing-layouts.js` — shared Sgaw, Pwo, English keymaps for both pages.
- `type-page.js` and `type-page.css` — new stand-alone typing editor.
- `type/index.html` — the direct static page route. You must keep the `type` folder.

**Important:** For GitHub Pages the file must be at `type/index.html`,
so `/type/` opens it. Create a folder named `type` in the repository
(or upload the `type` folder with GitHub's upload interface).

## Features
- Exact existing Sgaw, Pwo, English Unicode layouts (A = ရှ and . = . in Sgaw).
- Dedicated editor, separate saved draft for each language in this browser.
- Copy Unicode, download TXT, selection, undo, clear confirmation.
- Adjustable font size, show/hide keyboard, full-screen editor.
- Gaming RGB/Classic Light theme preference, inherited from main site.
- Dismissible creator badge (Ehthar Htain / Aung Naing), same as Flashcards.
- No Google sign-in, backend or Firebase rules changes.

Testing: JS syntax and 47-key mapping parity checks passed. A live Chrome
browser test was blocked in the build environment; after deploying, open
`/type/` directly, test Sgaw A and Period, and confirm refresh preserves text.

On Chromebook, a school administrator may need to approve website or
extension access. This page itself requires no browser extension.

## Standalone Type-only layout update
The dedicated Type page header now shows only the GLN logo/title and theme toggle.
Practice, Games, Classroom Tools, Flashcards, and even the Type tab have all
been removed from the dedicated page header. The main website navigation is
unchanged, and its Type button still opens this page. The creator badge stays.

**If your Type page is already installed:** replace only `type/index.html`.
No other files or Firebase settings need to change for this adjustment.
