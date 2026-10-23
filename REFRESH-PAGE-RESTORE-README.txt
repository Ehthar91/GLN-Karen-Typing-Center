GLN KAREN TYPING CENTER — REMEMBER PAGE AFTER REFRESH

What changed:
- The website restores the open section after refresh in the same browser tab.
- Classroom Tools remembers the active tool, including Automatic Grouping,
  Seating Chart, Quiz, Schedule Timer, Name Picker, Flashcards, and more.
- Long pages also attempt to restore their scroll position.
- Dedicated student quiz kiosk and public conference signup/editor links
  retain their existing special startup behavior.

INSTALL THE PATCH ONLY
1. Upload index.html to the root of your existing GitHub Pages repository.
2. Upload navigation-state.js to the same repository root.
3. Commit your changes and reload your website (hard refresh if needed).

Nothing else needs changing. No Firebase rules or account changes are required.

Behavior notes:
- This uses browser sessionStorage: it remembers navigation while refreshing
  the SAME browser tab, not necessarily when opening a new tab or a new session.
- It preserves which tool was open, but not an in-progress live quiz attempt
  or a running game. Those activities still use their own existing logic.
- Browsers blocking site storage may return to the default Type view.

Validation: JavaScript syntax checked and isolated route, scroll-save,
plus special-link tests passed. Live browser navigation with a served local
website could not be verified in this environment.
