# Flashcards inside GLN Classroom Tools

Flashcards is embedded as a separate Classroom Tools panel. Its files are stored in the `flashcards/` folder so the existing Flashcards CSS and JavaScript do not conflict with the main GLN Karen Typing Center.

## Where to open it

1. Open GLN Karen Typing Center.
2. Choose **Classroom Tools**.
3. Choose **Flashcards** from the Classroom Tools tab row, or select **Flashcards** from Dashboard Quick Actions.

## Existing Flashcards features preserved

- Google sign-in
- Classes with multiple decks
- Shared classes / study-only access
- Progressive or random study order
- Quiz mode and custom `{term}` questions
- Google Forms `.gs` download export
- Copy cards between decks/classes
- Archive classes and decks
- Study progress and mastery

## Important: Google sign-in domain

The Flashcards app uses the Firebase project configured in `flashcards/firebase-config.js`. When the Flashcards app is hosted inside the GLN site, Firebase Authentication must allow the GLN website domain.

In the Flashcards Firebase project:

1. Open **Firebase Console → Authentication → Settings → Authorized domains**.
2. Add the exact domain where GLN Karen Typing Center is hosted, for example `glnkarentypingcenter.com`.
3. Keep any existing Flashcards authorized domains.

You do not need to merge the Flashcards Firestore rules with the GLN Realtime Database rules. They are separate Firebase projects. The Flashcards Firestore rules remain in `flashcards/firestore.rules`.

## Share links

Class share links created from the embedded Flashcards app point to `flashcards/index.html?class=...` on the GLN domain. Students can open those links directly and sign in to add the shared class.
