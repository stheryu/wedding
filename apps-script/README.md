# RSVP backend setup

This folder is the source copy of the RSVP Google Apps Script. The website is configured to use the owner's deployed `/exec` URL in `index.html`.

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
