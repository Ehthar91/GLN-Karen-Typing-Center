# GLN Karen Typing Center — Shareable Navigation Links

This update gives the main navigation and every Classroom Tool its own URL fragment. It works on GitHub Pages without any server redirects, and it preserves the existing special student quiz and conference sign-up links.

## Installation (patch only)

Upload **both** `index.html` and `navigation-state.js` to the **root** of your website's GitHub repository, replacing the old versions. Commit and refresh your browser (Ctrl+Shift+R on Chromebook/Windows; Cmd+Shift+R on Mac).

## Links

Append these fragments to the normal website URL (e.g. `https://glnkarentypingcenter.com/#practice`):

| Area | Link fragment |
| --- | --- |
| Type | `#type` |
| Practice | `#practice` |
| Games | `#games` |
| Classroom Tools dashboard | `#tools/dashboard` |
| Seating Chart | `#tools/seating` |
| Schedule Timer | `#tools/schedule-timer` |
| Name Picker | `#tools/wheel` |
| Automatic Grouping | `#tools/grouping` |
| Flashcards (Classroom Tools) | `#tools/flashcards` |
| Quiz | `#tools/quiz` |
| Number Generator | `#tools/number-generator` |
| Calculator (hidden tool) | `#tools/calculator` |
| Conference Sign-Up (teacher tool) | `#tools/event-signup` |
| Bus Call | `#tools/bus-call` |

Simply open a tool, then copy the browser's address bar. Navigating between sections creates browser history so Back and Forward work.

Existing public event sign-up links (`?signup=...`), shared event editor links (`?eventEditor=...`), and student quiz kiosk links (`?kiosk=quiz`) retain their original behavior. `flashcards.html` public student class links are unchanged.

**Important:** A link opens a **section**, not a teacher's private account data, a specific class, or an ongoing test session. Existing authentication and permissions remain in effect. Reloading a section does not resume gameplay/quiz progress.

No Firebase rules changes or extra hosting configuration required.
