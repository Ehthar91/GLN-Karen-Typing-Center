# Flashcards deck reorder patch

Teachers can now drag deck cards into a new order from the Decks tab.

- Use the grab handle at the upper-left of a deck card.
- Drop the deck above or below another deck card.
- The order is saved to each deck's existing `order` field in Firestore.
- Students see published decks in the teacher's saved relative order.
- No Firestore rules change is required for this patch.
