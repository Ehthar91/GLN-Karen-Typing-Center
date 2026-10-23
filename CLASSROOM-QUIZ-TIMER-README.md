# Classroom Tools → Quiz: Per-question countdown timer

## Install (PATCH-ONLY ZIP)
Replace only these three files at the root of your GLN Karen Typing Center website:

- `index.html`
- `quiz-classroom.js`
- `quiz-classroom.css`

Keep all other project files untouched. Publish/redeploy the site and hard-refresh the browser if you see the previous layout.

## Teacher setup
1. Open **Classroom Tools → Quiz**, build a quiz, and create a classroom quiz room.
2. In the **Waiting for students** lobby, choose **Teacher-paced**.
3. Use **Question timer** to set the default time for every question (Off, 5, 10, 15, 20, 30, 45, 60, 90, or 120 seconds).
4. Optional: expand **Set a different time for individual questions** and choose an override for a particular question. Choose **Use class default** to inherit the default, or **No limit** to disable the timer for that question.
5. Start the quiz. Teacher and student screens show the synchronized countdown.

## Behavior
- The timer uses Firebase Realtime Database server timestamp for each question's start and estimates clock offset on each device using `.info/serverTimeOffset`.
- When time expires, unanswered students are locked out of that question and receive zero points for it. The teacher host automatically moves the class to the next question after a short delay, even when **Teacher clicks next** is selected; the final question ends the quiz.
- Students who have already submitted continue to wait for the next question.
- If all students have responded and **Auto-next after everyone answers** is selected, the question may advance before the timer runs out.
- Timed-out attempts appear as **Time up** on the live teacher dashboard, and the results CSV includes a **Timed out** column.
- The default remains **Off (no time limit)**, preserving previous behavior. Timed mode applies to **teacher-paced** classroom quizzes only. Student-paced sessions remain untimed.
- Changing a question's timer is intended to happen in the lobby *before* pressing Start quiz.
- The teacher must keep the host room open and connected for automatic question advancement.
- The countdown and lockout are browser-side with a shared server start timestamp; this is appropriate for ordinary classroom use, not tamper-proof exam proctoring.

## Firebase
No Firebase rules or Authentication changes are required for this patch if Classroom Quiz rooms already work on your deployment.

## Note
This changes **Classroom Tools → Quiz**, NOT the Flashcards quiz.
