# RSVP backend setup

This folder is the source copy of the RSVP Google Apps Script. The website is configured to use the owner's deployed `/exec` URL in `index.html`.

## Dogfood before changing the live RSVP

1. Create a separate Google Sheet named **Wedding RSVP Test**. In that sheet, open **Extensions → Apps Script**. Paste [Code.gs](Code.gs) into `Code.gs`, add a second script file named `RsvpEmail`, and paste [RsvpEmail.gs](RsvpEmail.gs) there. This keeps test rows and calendar events away from the live RSVP sheet and calendar.
2. In the test copy of `RsvpEmail.gs`, temporarily set `EMAIL_PETAL_URL` to `https://raw.githubusercontent.com/stheryu/wedding/codex/korean-rsvp-phone-owner-copy/assets/petal-mini.png`. That image is available before the PR is merged.
3. Save both files and run **`setupCalendar`** once in the test project. Check that the test sheet has a **Phone** column and a new wedding calendar was created.
4. Choose **Deploy → New deployment → Web app**, set **Execute as: Me** and **Who has access: Anyone**, then copy the test URL ending in `/exec`. Send that URL to the site maintainer to point a local preview at the test backend. Keep the existing production `/exec` URL in `index.html` unchanged. The editor-only `/dev` URL is not a substitute for an end-to-end guest test.
5. Submit a Korean RSVP with a phone number using an alternate email address, then an English RSVP without a phone number, and a declined RSVP. For each, check the **Wedding RSVP Test** sheet, the guest confirmation card, the copy sent to `fin.vermehr@gmail.com`, and the selected calendar invitations. Confirm that the card has no extra **Add to calendar** link. Use only your own addresses for these tests.
6. After the test passes, merge the website PR. In the live Apps Script project, paste both updated files, run **`setupCalendar`** to add the Phone column, and update the existing web app deployment to a **new version**. Confirm with one live RSVP to an alternate address.

1. In **your Google account**, create a new Google Sheet called something like **Wedding RSVPs**.
2. In that sheet, open **Extensions → Apps Script**. Replace the contents of `Code.gs` in the editor with [Code.gs](Code.gs). Create a second script file named `RsvpEmail` and paste in [RsvpEmail.gs](RsvpEmail.gs), then save both files.
3. Select `setupCalendar` in the editor and click **Run**. Approve the permissions for Sheets, sending email, and Calendar. This creates the **RSVPs** tab, stores its sheet ID, and creates a separate **Joohyun & Fin — RSVP Invitations** calendar set to **Asia/Seoul**.
4. Select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone** so invited guests do not need to sign in. Deploy and copy the URL ending in **`/exec`**. Do not use the `/dev` test URL for guests.
5. Open the `/exec` URL in a browser. It should show `{"result":"ready","configured":true,"calendarConfigured":true}`. If you create a different deployment and the URL changes, update `SCRIPT_URL` in `index.html`.
6. Send one clearly named test RSVP with your email. Check the sheet's **Confirmation email** and **Calendar status** columns, your inbox, and the invitations for the options you selected. Delete the test row and its calendar events afterward.

## Updating the existing deployment

If the script is already deployed, paste the new [Code.gs](Code.gs) into the Apps Script editor. Create a second script file named `RsvpEmail`, paste in [RsvpEmail.gs](RsvpEmail.gs), and save both files. Run **`setupCalendar`** once to add the new **Phone** sheet column and keep the calendar configured. After the website PR is merged and `https://joohyunfin.com/assets/petal-mini.png` loads, choose **Deploy → Manage deployments → Edit → New version → Deploy**. Editing the existing deployment keeps its `/exec` URL. Open that URL again and check for `"calendarConfigured":true` before testing an RSVP.

RSVP confirmations use the Invitation Card design from `rsvp-email-invitation-card`, with a plain-text fallback. The email lists the selected events and times in Seoul time. Korean RSVPs have an optional phone field, saved in the **Phone** column and included in the confirmation when supplied. The confirmation is also BCC'd to `fin.vermehr@gmail.com` (set by `RSVP_OWNER_EMAIL` in `Code.gs`), except when that is the RSVP email itself. Calendar invitations go only to the RSVP contact email: one 4–6 PM wedding event, plus separate after-party and brunch events when selected. The card omits its original **Add to calendar** link because the Google invitations are sent automatically. The brunch invite says **venue to follow**. Google Calendar displays invitations in each recipient's local time zone. RSVPs still save to the sheet if an email or calendar invitation fails; check the status columns and Apps Script **Executions** for details. No copy of the old sheet's responses is moved automatically.

When changing either script file later, paste the updated source into Apps Script and update the existing web app deployment to a new version. Changing these GitHub files alone does not change the running script.

Google documentation: [bound scripts](https://developers.google.com/apps-script/guides/bound), [web app deployment](https://developers.google.com/apps-script/guides/web), [Calendar events](https://developers.google.com/apps-script/reference/calendar/calendar), [Calendar time zones](https://support.google.com/calendar/answer/37064), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).
