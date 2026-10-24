GLN Karen Typing Center — Type Tab Return Fix
================================================

WHY THE PROBLEM HAPPENED
The main website's Type tab was deliberately changed to redirect visitors to
/type/ when the standalone typing page was first added.

WHAT CHANGED
- Main website Type tab now switches back to the original embedded typing view.
- The "Open dedicated Type page" button still opens /type/ when desired.
- The standalone /type/index.html is not changed.
- The quiz physical-Shift keyboard-display fix stays intact.
- index.html updates the practice.js cache version for GitHub Pages.

INSTALLATION (PATCH ONLY)
Upload these two files to your repository root, replacing the existing ones:
  - practice.js
  - index.html

DO NOT upload these files inside the type/ folder.
DO NOT delete type/index.html or other website files.

EXPECTED RESULT
- Click Type in main GLN site -> original embedded Type section.
- Click Open dedicated Type page -> standalone /type/ page.
- Practice/Games/Classroom Tools remain accessible in the main site.

TEST
After GitHub Pages publishes, refresh the main site (Shift+Reload).
Open Classroom Tools, then click Type: the original editor should appear.
Open the standalone page with its dedicated link: it should remain tab-free.
