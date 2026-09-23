# GLN Karen Typing Center

An online Karen Unicode keyboard, typing practice center, classroom games, and teaching tools.

## Included features

- Karen Unicode keyboard with physical and on-screen keys
- Guided typing lessons with highlighting, WPM, and accuracy
- Word Sprint and Falling Words games
- Typing Adventure with teacher-created word or sentence lists
- Classroom Car Race with a shared room code and live player progress
- Classroom Typing Tug of War with custom host lists, Red/Blue teams, player avatars, live rope movement, WPM, accuracy, and team awards
- Classroom Tools Flashcards with classes, decks, study modes, quizzes, sharing, archiving, card copying, and Google Forms `.gs` export

## Classroom Tug of War

The host pastes one word or sentence per line, chooses a difficulty, challenge count, and team setup, then shares the five-character room code. Players join from their own devices and choose an avatar.

Team setup options:

- Random teams
- Students choose
- Host assigns

Each correctly completed prompt earns one pull point. Fast, error-free typing earns one bonus pull point. Team strength is based on average player contribution so slightly uneven teams remain fair.

## Firebase

Live classroom games use Firebase Realtime Database with anonymous authentication. Publish the included `firebase-rules.json` after updating the site so the `rooms`, `quizRooms`, and `tugRooms` paths have the required permissions.

## Build

Run `npm run build` for the Worker build used by the project tooling. For GitHub Pages, upload the static project files to the repository root.

## Google Classroom roster sync
Seating Chart can import active Google Classroom classes and read-only student rosters. See `GOOGLE-CLASSROOM-SETUP.md` for the one-time Google Cloud / school-admin setup.

## Flashcards inside Classroom Tools

Flashcards now appears as its own Classroom Tools tab and Dashboard quick action. The Flashcards app is stored under `flashcards/` so its styles, JavaScript, and Firebase project remain isolated from the main GLN site. This preserves the existing Flashcards features while letting teachers use it inside the Classroom Tools workspace.

Flashcards uses its existing Firebase/Firestore project and its own Google sign-in. If Google sign-in is used from the GLN site, add the deployed GLN domain to the Flashcards Firebase Authentication authorized domains. See `FLASHCARDS-INTEGRATION-SETUP.md`.
