# Flashcards Guest Study Setup

The class share link now supports **guest study without Google sign-in**.

## One-time Firebase setting

1. Open the Firebase Console for the project used by Flashcards.
2. Go to **Authentication** > **Sign-in method**.
3. Enable **Anonymous** as a sign-in provider.
4. Save.

## Firestore rules

Publish the updated `flashcards-firestore.rules` file. The new rules keep guest users study-only while allowing them to read visible decks and save their own progress. Anonymous guests cannot create classes.

## How it works

- Teacher copies the normal class share link.
- Student opens the link.
- The page silently creates a Firebase anonymous guest session.
- No Google account chooser or Google sign-in screen appears.
- Only published/visible decks in the shared class are available.
- Study progress is tied to that guest browser's Firebase anonymous account.
- The teacher's own editing and class-management features still require the normal Google sign-in.

If Anonymous Authentication is not enabled, the shared page will show an error explaining that the Firebase setting must be enabled.
