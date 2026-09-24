# Remove Learner setup

This update adds an owner-only **Remove** action in the Flashcards **Learners** tab.

## Required Firestore Rules update

Because removing a learner must delete that learner's class membership and class progress, publish the included `flashcards-firestore.rules` file to the Flashcards Firebase project.

1. Open Firebase Console.
2. Select project `flashcards-8390f`.
3. Open **Firestore Database → Rules**.
4. Replace the rules with the contents of `flashcards-firestore.rules`.
5. Click **Publish**.

## What Remove Learner does

- Removes that class from the learner's Flashcards library.
- Deletes that learner's saved study/quiz progress for that class.
- Removes the learner from the owner's Learners table.
- Does not affect the learner's Google account or other classes.
- If class sharing is still enabled and the learner has the class link, they can join the class again later.
