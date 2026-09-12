# GLN Karen Typing Center

An online Karen Unicode keyboard, typing practice center, classroom games, and teaching tools.

## Included features

- Karen Unicode keyboard with physical and on-screen keys
- Guided typing lessons with highlighting, WPM, and accuracy
- Word Sprint and Falling Words games
- Typing Adventure with teacher-created word or sentence lists
- Classroom Car Race with a shared room code and live player progress
- Classroom Typing Tug of War with custom host lists, Red/Blue teams, player avatars, live rope movement, WPM, accuracy, and team awards

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
