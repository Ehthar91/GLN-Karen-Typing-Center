# GLN Classroom Quiz — ChromeOS Kiosk Ready

Student kiosk URL:

https://glnkarentypingcenter.com/?kiosk=quiz

## What is already built into GLN

- Dedicated student-only Classroom Quiz launch screen.
- Teacher Quiz Maker, navigation, and other Classroom Tools are hidden in kiosk mode.
- Classroom Quiz room-code joining still uses the normal live Firebase room.
- Quiz Lock remains the normal-browser fallback.
- The web app manifest launches directly into the student Classroom Quiz shell and requests fullscreen display.
- Refreshing or reopening the kiosk URL returns to the student quiz shell; the existing Classroom Quiz session restore can reconnect an active student.

## If school IT enables ChromeOS kiosk mode

In Google Admin Console, the administrator can add the GLN kiosk URL as a website/PWA under Chrome kiosk apps and optionally configure it to auto-launch for the selected devices/organizational unit.

Use the exact URL above. The room code does NOT need to be configured by IT; teachers can continue creating new Classroom Quiz rooms normally.

## Important distinction

The website cannot turn ChromeOS device-level kiosk mode on by itself. Without school administration, GLN uses its existing fullscreen lock and teacher fullscreen-status monitoring. With ChromeOS kiosk deployment, ChromeOS supplies the stronger device-level restriction around the same GLN quiz experience.
