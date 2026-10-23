# Flashcards — Bulk Remove Learners

This build adds owner-only bulk removal controls to the **Learners** tab.

## What changed
- Select individual learners with checkboxes.
- Use **Select all** to select every listed learner.
- Use **Remove Selected** to remove multiple selected learners at once.
- Use **Remove All** to remove every listed learner in the class.
- A confirmation window shows how many learners will be removed before anything is deleted.
- Existing single-learner **Remove** buttons still work.

Removing a learner deletes that class from the learner's Flashcards library and deletes that learner's saved study/quiz progress for the class. Learners can join again later if the class link is still active.

## Firebase rules
No additional rules change is required beyond the owner-removal rules from the previous Remove Learners build. If those rules have not been published yet, publish the included `flashcards-firestore.rules` in Firebase Console → Firestore Database → Rules.
