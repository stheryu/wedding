// Paste this file into the Apps Script project attached to your RSVP spreadsheet.
const RSVP_SHEET_NAME = 'RSVPs';
const RSVP_SHEET_ID_KEY = 'RSVP_SPREADSHEET_ID';
const RSVP_HEADERS = [
  'Submitted at', 'Name', 'Email', 'Attending', 'Total people',
  'Joining with', 'After party', 'Farewell brunch', 'Message',
  'Language', 'Confirmation email'
];

// Run once from the Apps Script editor while the project is attached to your sheet.
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this script from your RSVP Google Sheet.');

  const sheet = spreadsheet.getSheetByName(RSVP_SHEET_NAME) ||
    spreadsheet.insertSheet(RSVP_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RSVP_HEADERS.length).setValues([RSVP_HEADERS]);
  }
  sheet.setFrozenRows(1);
  PropertiesService.getScriptProperties().setProperty(RSVP_SHEET_ID_KEY, spreadsheet.getId());

  // Request mail permission during setup, before guests start submitting RSVPs.
  MailApp.getRemainingDailyQuota();
  return 'Ready: ' + spreadsheet.getName() + ' / ' + sheet.getName();
}

// A read-only check for the deployed /exec URL. It never includes private sheet data.
function doGet() {
  return jsonResponse_({
    result: 'ready',
    configured: Boolean(PropertiesService.getScriptProperties().getProperty(RSVP_SHEET_ID_KEY))
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
        rsvp.message, rsvp.lang, rsvp.email ? 'Pending' : 'Not requested'
      ];
      // Keep names and notes as text, including any that begin with "=".
      sheet.getRange(rowNumber, 2, 1, RSVP_HEADERS.length - 1).setNumberFormat('@');
      sheet.getRange(rowNumber, 1, 1, RSVP_HEADERS.length).setValues([row]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    let mailed = false;
    if (rsvp.email) {
      try {
        MailApp.sendEmail({
          to: rsvp.email,
          subject: rsvp.lang === 'ko' ? '주현 & 핀 결혼식 참석 확인' : 'Your RSVP for Joohyun & Fin',
          body: confirmationText_(rsvp),
          name: 'Joohyun & Fin'
        });
        mailed = true;
      } catch (mailError) {
        console.error('Confirmation email failed for row ' + rowNumber + ': ' + mailError);
      }
      try {
        sheet.getRange(rowNumber, RSVP_HEADERS.length).setValue(mailed ? 'Sent' : 'Failed');
      } catch (statusError) {
        console.error('Could not update email status for row ' + rowNumber + ': ' + statusError);
      }
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

  if (!name || !['O', 'X'].includes(attending)) throw new Error('Name or attendance missing.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email.');
  if (lang === 'en' && !email) throw new Error('Email required for English RSVP.');
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

function confirmationText_(rsvp) {
  const group = [rsvp.name].concat(rsvp.guestNames).join(', ');
  if (rsvp.lang === 'ko') {
    return rsvp.name + '님,\n\n주현 & 핀 결혼식 참석 여부를 보내주셔서 감사합니다.\n' +
      '참석 여부: ' + (rsvp.attending === 'O' ? '참석' : '불참') + '\n' +
      (rsvp.attending === 'O' ? '함께 오시는 분: ' + group + '\n' : '') +
      '\n2027년 4월 24일 · 서울\n\n주현 & 핀';
  }
  return 'Hi ' + rsvp.name + ',\n\nThank you for replying to Joohyun & Fin\'s wedding invitation.\n' +
    'RSVP: ' + (rsvp.attending === 'O' ? 'Attending' : 'Unable to attend') + '\n' +
    (rsvp.attending === 'O' ? 'Coming: ' + group + '\n' : '') +
    '\nApril 24, 2027 · Seoul\n\nJoohyun & Fin';
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
