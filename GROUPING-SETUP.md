# Automatic Grouping — Classroom Tools

Open Classroom Tools > Automatic Grouping (or use the Classroom Dashboard shortcut).

1. Choose a Seating Chart class. If you previously synced the class from Google Classroom, it is available in the same list. Alternatively select Custom roster and paste one student name per line.
2. Remove absent students from the tool’s copy of the roster if needed. Use Reload class roster to restore the original list.
3. Choose Students per group (e.g., 4) or Number of groups (e.g., 5), then Create Groups.
4. Reshuffle, Copy, Export CSV, Print, or Full Screen for the projector.

Groups are made as evenly as possible: 10 students with four per group produces 4, 3, 3. Every student is included once. Up to 100 names.

Saved group settings/results are stored in the browser and included with the existing Classroom Tools Google account sync (when enabled). The original Seating Chart roster is never modified by the grouping tool.

### PATCH INSTALL
Upload these four files at your GitHub repository root:
- index.html (updated navigation, dashboard and layout)
- calculator.js (navigation and cloud-sync connection)
- grouping.js (new tool)
- grouping.css (new tool styles)

No Firebase rules changes are needed. Clear the browser cache if you don't see the new tab immediately. The previous Sgaw Karen A/period mapping is preserved.

### Validation
JavaScript syntax, static HTML wiring and the balancing algorithm were checked. A real hosted-site classroom test is recommended, as the local browser preview was restricted by the environment.
