// Paste this file into the Apps Script project attached to your RSVP spreadsheet.
const RSVP_SHEET_NAME = 'RSVPs';
const RSVP_SHEET_ID_KEY = 'RSVP_SPREADSHEET_ID';
const RSVP_OWNER_EMAILS = ['fin.vermehr@gmail.com', 'joohyun.vermehr@gmail.com'];
const RSVP_HEADERS = [
  'Submitted at', 'Name', 'Email', 'Attending', 'Total people',
  'Joining with', 'After party', 'Farewell brunch', 'Message',
  'Language', 'Confirmation email', 'Calendar status', 'Calendar event IDs', 'Phone',
  'Owner notification'
];
const RSVP_EVENTS = [
  {
    key: 'wedding', title: 'Joohyun & Fin — Wedding & Dinner', titleKo: '주현 & 핀 — 예식 및 피로연',
    start: '2027-04-24T16:00:00+09:00', end: '2027-04-24T18:00:00+09:00',
    location: 'Ilhwadang, Samcheonggak, Seoul, South Korea',
    locationKo: '삼청각 일화당, 서울',
    description: 'Ceremony 4:00–4:40 PM; dinner reception 4:45–6:00 PM. All times are Seoul time (KST).',
    descriptionKo: '예식 오후 4시, 피로연 오후 4시 45분. 모든 시간은 한국 시간입니다.'
  },
  {
    key: 'afterparty', title: 'Joohyun & Fin — After Party', titleKo: '주현 & 핀 — 애프터 파티',
    start: '2027-04-24T19:00:00+09:00', end: '2027-04-25T01:00:00+09:00',
    location: 'Pairing, 163-22 Hyehwa-dong, Jongno-gu, Seoul, South Korea',
    locationKo: '페어링, 서울 종로구 혜화동 163-22',
    description: 'After party at Pairing. All times are Seoul time (KST).',
    descriptionKo: '페어링에서 열리는 애프터 파티. 모든 시간은 한국 시간입니다.'
  },
  {
    key: 'brunch', title: 'Joohyun & Fin — Farewell Brunch', titleKo: '주현 & 핀 — 작별 브런치',
    start: '2027-04-25T10:00:00+09:00', end: '2027-04-25T13:00:00+09:00',
    location: '',
    locationKo: '',
    description: 'Farewell brunch. Venue to follow. All times are Seoul time (KST).',
    descriptionKo: '작별 브런치. 장소는 추후 안내드립니다. 모든 시간은 한국 시간입니다.'
  }
];

// Run once from the Apps Script editor while the project is attached to your sheet.
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from your RSVP Google Sheet.');

  const sheet = spreadsheet.getSheetByName(RSVP_SHEET_NAME) ||
    spreadsheet.insertSheet(RSVP_SHEET_NAME);
  sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
  sheet.setFrozenRows(1);
  PropertiesService.getScriptProperties().setProperty(RSVP_SHEET_ID_KEY, spreadsheet.getId());

  // Request mail permission during setup, before guests start submitting RSVPs.
  MailApp.getRemainingDailyQuota();
  return 'Ready: ' + spreadsheet.getName() + ' / ' + sheet.getName();
}

// Legacy alias for previous setup instructions; optional links need no owner calendar.
function setupCalendar() {
  return setup();
}

// A read-only check for the deployed /exec URL. It never includes private sheet data.
function doGet() {
  const properties = PropertiesService.getScriptProperties();
  return jsonResponse_({
    result: 'ready',
    configured: Boolean(properties.getProperty(RSVP_SHEET_ID_KEY)),
    calendarMode: 'optional_links'
  });
}

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents);
    const rsvp = parseRsvp_(data);
    const spreadsheetId = PropertiesService.getScriptProperties().getProperty(RSVP_SHEET_ID_KEY);
    if (!spreadsheetId) throw new Error('Run setup() before accepting RSVPs.');

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(RSVP_SHEET_NAME);
    if (!sheet) throw new Error('RSVP sheet not found. Run setup() again.');

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let rowNumber;
    try {
      rowNumber = sheet.getLastRow() + 1;
      const row = [
        new Date(), rsvp.name, rsvp.email, rsvp.attending, rsvp.guests,
        rsvp.guestNames.join('; '), rsvp.afterparty, rsvp.brunch,
        rsvp.message, rsvp.lang, 'Pending', 'Pending', '', rsvp.phone, 'Pending'
      ];
      // Keep names and notes as text, including any that begin with "=".
      sheet.getRange(rowNumber, 2, 1, RSVP_HEADERS.length - 1).setNumberFormat('@');
      sheet.getRange(rowNumber, 1, 1, RSVP_HEADERS.length).setValues([row]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    let mailed = false;
    try {
      const mail = renderRsvpEmail({
        lang: rsvp.lang,
        name: rsvp.name,
        phone: rsvp.phone,
        message: rsvp.message,
        attending: rsvp.attending === 'O',
        guests: [rsvp.name].concat(rsvp.guestNames),
        afterparty: rsvp.afterparty === 'O',
        brunch: rsvp.brunch === 'O'
      });
      const confirmation = {
        to: rsvp.email,
        subject: mail.subject,
        body: mail.text,
        htmlBody: mail.html,
        name: 'Joohyun & Fin'
      };
      MailApp.sendEmail(confirmation);
      mailed = true;
    } catch (mailError) {
      console.error('Confirmation email failed for row ' + rowNumber + ': ' + mailError);
    }
    try {
      sheet.getRange(rowNumber, 11, 1, 2).setValues([[
        mailed ? 'Sent' : 'Failed',
        !mailed ? 'Email failed' : rsvp.attending === 'O' ? 'Links emailed' : 'No links (declined)'
      ]]);
    } catch (statusError) {
      console.error('Could not update email status for row ' + rowNumber + ': ' + statusError);
    }
    let ownerNotified = false;
    try {
      const notice = ownerNotification_(rsvp, mailed);
      MailApp.sendEmail({
        to: RSVP_OWNER_EMAILS.join(','),
        subject: notice.subject,
        body: notice.body,
        name: 'Joohyun & Fin RSVP'
      });
      ownerNotified = true;
    } catch (ownerMailError) {
      console.error('Owner notification failed for row ' + rowNumber + ': ' + ownerMailError);
    }
    try {
      sheet.getRange(rowNumber, 15).setValue(ownerNotified ? 'Sent' : 'Failed');
    } catch (ownerStatusError) {
      console.error('Could not update owner notification status for row ' + rowNumber + ': ' + ownerStatusError);
    }
    return jsonResponse_({result: 'success', mailed: mailed});
  } catch (error) {
    console.error('RSVP failed: ' + error);
    return jsonResponse_({result: 'error', message: 'Could not save RSVP.'});
  }
}

function parseRsvp_(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid RSVP data.');
  }
  const name = shortText_(data.name, 120);
  const email = shortText_(data.email, 254);
  const attending = data.attending;
  const guests = Number(data.guests);
  const guestNames = data.guestNames;
  const lang = data.lang === 'ko' ? 'ko' : 'en';
  const phone = lang === 'ko' ? shortText_(data.phone, 30) : '';

  if (!name || !['O', 'X'].includes(attending)) throw new Error('Name or attendance missing.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (!email) throw new Error('Email required for confirmation and calendar links.');
  if (!Array.isArray(guestNames)) throw new Error('Names must be a list.');
  if (attending === 'O') {
    if (!Number.isInteger(guests) || guests < 1 || guests > 4 || guestNames.length !== guests - 1) {
      throw new Error('Guest count does not match names.');
    }
  } else if (guests !== 0 || guestNames.length !== 0) {
    throw new Error('Declined RSVP must have no guests.');
  }

  const names = guestNames.map(function (value) { return shortText_(value, 120); });
  if (names.some(function (value) { return !value; })) throw new Error('Additional name missing.');

  return {
    name: name,
    email: email,
    phone: phone,
    attending: attending,
    guests: guests,
    guestNames: names,
    afterparty: choice_(data.afterparty),
    brunch: choice_(data.brunch),
    message: shortText_(data.message, 2000),
    lang: lang
  };
}

function shortText_(value, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Expected text.');
  const text = value.trim();
  if (text.length > maxLength) throw new Error('Text too long.');
  // Sheets treats values beginning with "=" as formulas. Store them as literal text.
  return text.charAt(0) === '=' ? "'" + text : text;
}

function choice_(value) {
  if (value == null || value === '') return '';
  if (value !== 'O' && value !== 'X') throw new Error('Invalid choice.');
  return value;
}

function ownerNotification_(rsvp, guestMailed) {
  const attending = rsvp.attending === 'O';
  const subject = 'RSVP: ' + rsvp.name.replace(/[\r\n]+/g, ' ') +
    (attending ? ' — Attending' : ' — Unable to attend');
  const lines = [
    rsvp.name + ' submitted an RSVP.', '',
    'Attendance: ' + (attending ? 'Attending' : 'Unable to attend'),
    'Email: ' + rsvp.email
  ];
  if (rsvp.phone) lines.push('Phone: ' + rsvp.phone);
  if (attending) {
    lines.push('Coming: ' + [rsvp.name].concat(rsvp.guestNames).join(', '));
    if (rsvp.afterparty) lines.push('After party: ' + (rsvp.afterparty === 'O' ? 'Yes' : 'No'));
    if (rsvp.brunch) lines.push('Farewell brunch: ' + (rsvp.brunch === 'O' ? 'Yes' : 'No'));
  }
  if (rsvp.message) lines.push('Message: ' + rsvp.message);
  lines.push('Guest confirmation email: ' + (guestMailed ? 'Sent' : 'Failed'));
  return {subject: subject, body: lines.join('\n')};
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
