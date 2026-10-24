# GLN Google Classroom Roster Sync Setup

GLN now includes a read-only Google Classroom roster importer for Seating Chart. The website code is ready, but Google must allow the Classroom API for the Firebase/Google Cloud project before live roster sync can work.

## One-time setup

1. Open Google Cloud Console and select the same project used by GLN Firebase: `gln-karen-typing-center`.
2. Go to **APIs & Services → Library**.
3. Search for **Google Classroom API** and click **Enable**.
4. Go to **APIs & Services → OAuth consent screen**.
5. Make sure `glnkarentypingcenter.com` is listed as an authorized domain when Google asks for app domains.
6. Add/approve these read-only scopes if the consent screen requires them:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.rosters.readonly`
7. If the OAuth app is in Testing mode, add the teacher Google account as a test user. If this is a school-managed Google Workspace account, your school administrator may need to approve the app/scopes.
8. Firebase Authentication → Settings → Authorized domains should include `glnkarentypingcenter.com`.

No Google client secret is stored in the GitHub Pages site. GLN uses the existing Firebase Google sign-in popup and requests the two Classroom read-only scopes only when the teacher clicks **Connect & load classes**.

## Using it

1. Open **Classroom Tools → Seating Chart**.
2. Open **Google Classroom** in the Classes panel.
3. Click **Connect & load classes** and choose the school Google account.
4. Select the active Classroom classes to import.
5. Click **Import selected classes**.
6. Later, open a linked class and click **Sync this class roster**.

## What sync changes

- Reads active class names and student names from Google Classroom.
- Creates a GLN seating-chart class for each selected Classroom course.
- Adds newly enrolled students and removes students no longer on the Classroom roster.
- Preserves desk positions and existing seat assignments for students who remain in the class.
- Does **not** add, remove, or edit anything in Google Classroom.

## Troubleshooting

- **Access blocked / admin approval required:** the school Google Workspace administrator needs to approve the OAuth app/scopes.
- **Classroom API has not been used / API disabled:** enable Google Classroom API in the Google Cloud project.
- **No active classes found:** verify the selected Google account is a teacher in active Google Classroom courses.
- **Permission expired:** click **Connect & load classes** again. Access tokens are intentionally kept only in memory and are not saved in localStorage/Firebase.
