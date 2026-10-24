# Print Blank-Page Fix — GLN Karen Typing Center

Problem
-------
Automatic Grouping used an unscoped `@media print` rule that made all site contents invisible without removing their printed layout boxes. This could hide other tools' printouts and leave empty trailing sheets. The application's full-viewport shell could also use extra printable height.

Changes
-------
- `grouping.css`: the Automatic Grouping print layout now applies only when that tool is being printed. Unrelated tools are not hidden. Nonprinted sections are removed from document flow rather than merely made invisible. The app shell no longer retains full-viewport minimum height during printing.
- `grouping.js`: the grouping Print button adds and removes the `print-grouping` class during printing.
- `index.html`: new cache identifiers for those two files.

Installation (GitHub Pages)
---------------------------
Upload only `index.html`, `grouping.js`, and `grouping.css` from the PATCH-ONLY ZIP to the root of the existing repository, replacing the older files. Commit and refresh the site (on Chromebooks: Ctrl+Shift+R; Macs: Cmd+Shift+R).

Print orientation is still controlled by Chrome's Print dialog. Printing long lists of groups legitimately requires more than one sheet; this change removes unintended blank sheets, not necessary content pages.

Verification
------------
- JavaScript syntax check passed.
- A Chromium print-style regression test with six groups produced four pages before (three blank) and one page after.
- A print-style test confirmed previously hidden quiz results become visible.
- Real-world Chrome/Chromebook print dialogue still needs testing on the deployed website.
- No Firebase rules changes.
