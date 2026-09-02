# GLN Karen Typing Center — GitHub Pages Classroom Race Fix

This patch keeps your existing site design and replaces only the Classroom Car Race backend.

## Files to upload to your GitHub repository

1. Replace your existing `race.js` with the new `race.js` in this folder.
2. Add `firebase-config.js` to the same folder as `index.html`.
3. Keep your existing `index.html`, `race.css`, `app.js`, `games.js`, and all other files unchanged.

## One-time Firebase setup

1. Go to Firebase Console and create a project.
2. Add a Web App to the project.
3. In Authentication, enable **Anonymous** sign-in.
4. Create a **Realtime Database**.
5. Open Realtime Database → Rules and replace the rules with the contents of `firebase-rules.json`, then Publish.
6. In Project settings → Your apps → SDK setup and configuration, copy your Firebase config.
7. Open `firebase-config.js` and replace every `PASTE_...` value with your actual Firebase values.
8. Upload the updated `firebase-config.js` and `race.js` to your GitHub repository.
9. Wait a minute or two for GitHub Pages to redeploy, then hard-refresh the site.

## Test

Teacher:
- Games → Classroom Car Race → Create a race
- Share the 5-character room code
- Wait for students, then Start race

Students:
- Games → Classroom Car Race
- Enter room code + name
- Join race
- Type when the teacher starts

The cars update live through Firebase Realtime Database, so students can use separate Chromebooks/computers.

## Important

Your Firebase web config is designed to be used in client-side web apps. Access control is enforced by the Realtime Database rules. Do not replace the provided rules with fully-public read/write rules.
