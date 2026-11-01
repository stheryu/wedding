# RSVP backend setup

This folder is the source copy of the RSVP Google Apps Script. The website is configured to use the owner's deployed `/exec` URL in `index.html`.

1. In **your Google account**, create a new Google Sheet called something like **Wedding RSVPs**.
2. In that sheet, open **Extensions → Apps Script**. Replace the contents of `Code.gs` in the editor with [Code.gs](Code.gs), then save.
3. Select the `setup` function in the editor and click **Run**. Approve the permissions for Sheets and sending email. This creates an **RSVPs** tab, adds column headings, and stores the sheet ID for the web app.
4. Select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone** so invited guests do not need to sign in. Deploy and copy the URL ending in **`/exec`**. Do not use the `/dev` test URL for guests.
5. Open the `/exec` URL in a browser. It should show `{"result":"ready","configured":true}`. If you redeploy and the URL changes, update `SCRIPT_URL` in `index.html`.
6. Send one clearly named test RSVP with your email. Check the new sheet's row, its **Confirmation email** column, and your inbox. Delete the test row afterward.

RSVPs save to the sheet even if email sending fails. The response returns `mailed: false` in that case, and the sheet marks the email **Failed**. The Apps Script **Executions** page shows the error. No copy of the old sheet's responses is moved automatically.

When changing `Code.gs` later, paste the updated source into Apps Script and update the existing web app deployment to a new version. Changing this GitHub file alone does not change the running script.

Google documentation: [bound scripts](https://developers.google.com/apps-script/guides/bound), [web app deployment](https://developers.google.com/apps-script/guides/web), [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).
