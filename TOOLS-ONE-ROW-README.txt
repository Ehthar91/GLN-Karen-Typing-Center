CLASSROOM TOOLS — SINGLE-ROW NAVIGATION PATCH
====================================================
Updated: October 22, 2026

Install on your current GitHub Pages site:
1. Open this ZIP and upload grouping.css and index.html to your GitHub repository root.
2. Confirm replacement of the existing files and commit.
3. Refresh glnkarentypingcenter.com/#tools/grouping (Ctrl+Shift+R on Chromebook/Windows or Cmd+Shift+R on Mac).

Changes:
- The 10 visible Classroom Tools navigation tabs stay in one horizontal row.
- Wide desktop screens show all 10 tabs with no sideways scrolling.
- On narrower screens the tab strip scrolls horizontally rather than wrapping to multiple rows.
- Both Classic Light and Gaming RGB use the same layout.
- No changes to navigation targets, print styles, student data, or Firebase rules.

Files changed: grouping.css, index.html (CSS cache-busting version only).

Validation: CSS navigation checked at 1600, 1366, 1024, and 390 pixel viewport widths in both themes using isolated browser tests. A full live website/browser integration test has not been run.
