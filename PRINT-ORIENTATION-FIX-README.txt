GLN Karen Typing Center — Print Orientation Fix
================================================
Problem
-------
seating.css included a global @page declaration forcing LANDSCAPE. Because this
stylesheet is loaded site-wide, Chrome could lock or override its Portrait /
Landscape control for EVERY printable view (Seating Chart, quizzes, grouping,
results, etc.).

Fix
---
* seating.css — removes @page{size:landscape;margin:.35in} so paper orientation
  (and margins) are selected through the browser's Print dialog.
* index.html — bumps seating.css cache version so GitHub Pages visitors and
  Chromebooks load the updated stylesheet immediately after deployment.

Install
-------
1. Upload ONLY seating.css and index.html to the ROOT of the GitHub Pages repo.
2. Commit changes and allow GitHub Pages to publish.
3. Reload the site. If necessary, hard refresh (Ctrl+Shift+R on Chromebook,
   Command+Shift+R on Mac).
4. Open Seating Chart or Automatic Grouping -> Print. In Chrome choose
   Destination (printer/PDF), More settings -> Layout -> Portrait/Landscape.

Note
----
Portrait may require smaller scale for wide seating charts. The other print
layout styles are preserved. This change does not affect Firebase, JavaScript,
or the regular site appearance.
