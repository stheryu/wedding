# RSVP backend setup

The site posts RSVPs to the owner's Google Apps Script web app. [Code.gs](Code.gs) saves answers to the bound Google Sheet. [RsvpEmail.gs](RsvpEmail.gs) builds the invitation-card confirmation in English or Korean.

## Update the existing deployment

1. In the RSVP Google Sheet, open **Extensions → Apps Script**. Replace the existing `Code.gs` with this folder's [Code.gs](Code.gs). Keep the existing `RsvpEmail` script; replace it with [RsvpEmail.gs](RsvpEmail.gs) only if it has changed since your last deployment. Save.
2. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. This keeps the existing `/exec` URL. Its read-only check should return `{"result":"ready","configured":true,"calendarMode":"optional_links"}`. The new backend safely migrates the Sheet when its first RSVP arrives.
3. Run **`setup`** once in the editor to migrate the Sheet immediately. It reorders existing columns without losing RSVP rows and converts old `O`/`X` answers to Sheet `TRUE`/`FALSE` values. `setupCalendar` remains as an alias if you select it by habit; it no longer creates a calendar. Then merge the website change.
4. Submit one clearly named English RSVP with an alternate email address and one Korean RSVP with a phone number but no email. Check the English guest confirmation and both owners' summary emails. The Korean row should show **No email provided** under **Confirmation email** and **Calendar status**.

## Calendar behavior

The confirmation card shows **Google Calendar** and **Apple / Outlook (.ics)** links beside each event the guest chose. The wedding appears for every attending guest. After party and brunch appear only when selected. Declined RSVPs receive no event links. No new calendar invitations are sent automatically.

Event times are stored as exact UTC instants corresponding to Seoul time. The `.ics` files live under `assets/calendar/en` and `assets/calendar/ko`. If an event time or venue changes, update `RSVP_EVENTS` in `Code.gs`, run `node scripts/generate-calendar-files.js` from the repository root, and publish both the site and a new Apps Script version. Guests who already saved an event will need a follow-up message; optional calendar links do not update their calendars automatically.

The old **Calendar event IDs** column and previously sent invitations remain for historical RSVPs. New attending rows say **Links emailed** in **Calendar status** after a successful email; declined rows say **No links (declined)**, and failed mail says **Email failed**. New event ID cells stay blank. The Sheet begins with **Name**, **Email**, **Phone**, **Total people**, **Joining with**, **Attending**, **After party**, and **Farewell brunch**; the three attendance choices are stored as `TRUE` or `FALSE` (blank means the question was not asked). Korean RSVPs require a phone number and may omit email. English RSVPs require email and may include a phone number. An RSVP without email is saved and reported to both owners, with **No email provided** in the email status columns; no guest confirmation is sent. Every RSVP, including a decline, sends a separate plain-text summary to both owners with the guest's selections and guest-email status. The **Owner notification** sheet column records whether that message was sent.

Changing files in GitHub does not change the running Apps Script. Paste updated script files into the bound project and update its existing deployment to a new version.

References: [Apps Script web app deployments](https://developers.google.com/apps-script/guides/web), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app), [iCalendar format](https://www.rfc-editor.org/rfc/rfc5545).
