// Paste this file into the Apps Script project attached to your RSVP spreadsheet.
const RSVP_SHEET_NAME = 'RSVPs';
const RSVP_SHEET_ID_KEY = 'RSVP_SPREADSHEET_ID';
const RSVP_CALENDAR_ID_KEY = 'RSVP_CALENDAR_ID';
const RSVP_OWNER_EMAIL = 'fin.vermehr@gmail.com';
const RSVP_HEADERS = [
  'Submitted at', 'Name', 'Email', 'Attending', 'Total people',
  'Joining with', 'After party', 'Farewell brunch', 'Message',
  'Language', 'Confirmation email', 'Calendar status', 'Calendar event IDs', 'Phone'
];
const RSVP_EVENTS = [
  {
    key: 'wedding', title: 'Joohyun & Fin — Wedding & Dinner',
    start: '2027-04-24T16:00:00+09:00', end: '2027-04-24T18:00:00+09:00',
    location: 'Ilhwadang, Samcheonggak, Seoul, South Korea',
    description: 'Ceremony 4:00–4:40 PM; dinner reception 4:45–6:00 PM. All times are Seoul time (KST).'
  },
  {
    key: 'afterparty', title: 'Joohyun & Fin — After Party',
    start: '2027-04-24T19:00:00+09:00', end: '2027-04-25T01:00:00+09:00',
    location: 'Pairing, 163-22 Hyehwa-dong, Jongno-gu, Seoul, South Korea',
    description: 'After party at Pairing. All times are Seoul time (KST).'
  },
  {
    key: 'brunch', title: 'Joohyun & Fin — Farewell Brunch',
    start: '2027-04-25T10:00:00+09:00', end: '2027-04-25T13:00:00+09:00',
    location: '',
    description: 'Farewell brunch. Venue to follow. All times are Seoul time (KST).'
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

// Run after setup() to create a separate wedding calendar in your account.
function setupCalendar() {
  setup();
  const properties = PropertiesService.getScriptProperties();
  let calendar = properties.getProperty(RSVP_CALENDAR_ID_KEY) &&
    CalendarApp.getCalendarById(properties.getProperty(RSVP_CALENDAR_ID_KEY));
  if (!calendar) {
    calendar = CalendarApp.createCalendar('Joohyun & Fin — RSVP Invitations', {
      description: 'Calendar invitations sent from the wedding RSVP form.',
      timeZone: 'Asia/Seoul'
    });
    properties.setProperty(RSVP_CALENDAR_ID_KEY, calendar.getId());
  }
  return 'Ready: ' + calendar.getName() + ' (' + calendar.getTimeZone() + ')';
}

// A read-only check for the deployed /exec URL. It never includes private sheet data.
function doGet() {
  const properties = PropertiesService.getScriptProperties();
  return jsonResponse_({
    result: 'ready',
    configured: Boolean(properties.getProperty(RSVP_SHEET_ID_KEY)),
    calendarConfigured: Boolean(properties.getProperty(RSVP_CALENDAR_ID_KEY))
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
    let previousEventIds;
    try {
      rowNumber = sheet.getLastRow() + 1;
      previousEventIds = previousEventIds_(sheet, rsvp.email, rowNumber - 1);
      const row = [
        new Date(), rsvp.name, rsvp.email, rsvp.attending, rsvp.guests,
        rsvp.guestNames.join('; '), rsvp.afterparty, rsvp.brunch,
        rsvp.message, rsvp.lang, 'Pending', 'Pending', '', rsvp.phone
      ];
      // Keep names and notes as text, including any that begin with "=".
      sheet.getRange(rowNumber, 2, 1, RSVP_HEADERS.length - 1).setNumberFormat('@');
      sheet.getRange(rowNumber, 1, 1, RSVP_HEADERS.length).setValues([row]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    const calendarResult = syncCalendar_(rsvp, previousEventIds);
    try {
      sheet.getRange(rowNumber, 12).setValue(calendarResult.failed.length ?
        'Failed: ' + calendarResult.failed.join(', ') :
        rsvp.attending === 'X' ? 'No invitations (declined)' :
          'Invited: ' + calendarResult.sent.join(', '));
      sheet.getRange(rowNumber, 13).setValue(JSON.stringify(calendarResult.eventIds));
    } catch (calendarStatusError) {
      console.error('Could not record calendar status for row ' + rowNumber + ': ' + calendarStatusError);
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
        brunch: rsvp.brunch === 'O',
        calendarFailed: calendarResult.failed
      });
      const confirmation = {
        to: rsvp.email,
        subject: mail.subject,
        body: mail.text,
        htmlBody: mail.html,
        name: 'Joohyun & Fin'
      };
      if (rsvp.email.toLowerCase() !== RSVP_OWNER_EMAIL.toLowerCase()) {
        confirmation.bcc = RSVP_OWNER_EMAIL;
      }
      MailApp.sendEmail(confirmation);
      mailed = true;
    } catch (mailError) {
      console.error('Confirmation email failed for row ' + rowNumber + ': ' + mailError);
    }
    try {
      sheet.getRange(rowNumber, 11).setValue(mailed ? 'Sent' : 'Failed');
    } catch (statusError) {
      console.error('Could not update email status for row ' + rowNumber + ': ' + statusError);
    }
    return jsonResponse_({
      result: 'success', mailed: mailed,
      calendarInvites: calendarResult.sent,
      calendarFailed: calendarResult.failed
    });
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
  if (!email) throw new Error('Email required for confirmation and calendar invitations.');
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

function previousEventIds_(sheet, email, lastRow) {
  if (lastRow < 2) return {};
  const emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  const eventIds = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
  for (let i = emails.length - 1; i >= 0; i--) {
    if (String(emails[i][0]).toLowerCase() !== email.toLowerCase() || !eventIds[i][0]) continue;
    try {
      const parsed = JSON.parse(eventIds[i][0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (error) { /* check an older row */ }
  }
  return {};
}

function selectedEventKeys_(rsvp) {
  if (rsvp.attending !== 'O') return [];
  const keys = ['wedding'];
  if (rsvp.afterparty === 'O') keys.push('afterparty');
  if (rsvp.brunch === 'O') keys.push('brunch');
  return keys;
}

function syncCalendar_(rsvp, previousIds) {
  const desired = selectedEventKeys_(rsvp);
  const result = {sent: [], failed: [], eventIds: {}};
  const calendarId = PropertiesService.getScriptProperties().getProperty(RSVP_CALENDAR_ID_KEY);
  let calendar;
  try { calendar = calendarId && CalendarApp.getCalendarById(calendarId); }
  catch (error) { console.error('Could not open RSVP calendar: ' + error); }
  if (!calendar) {
    result.failed = desired.length ? desired : Object.keys(previousIds);
    result.eventIds = previousIds;
    return result;
  }

  RSVP_EVENTS.forEach(function (spec) {
    const oldId = previousIds[spec.key];
    let oldEvent;
    try {
      oldEvent = oldId && calendar.getEventById(oldId);
      if (desired.indexOf(spec.key) !== -1) {
        if (oldEvent) {
          updateCalendarEvent_(oldEvent, spec, rsvp);
          result.eventIds[spec.key] = oldId;
        } else {
          // Include all guest-facing details before sending the first invitation.
          // Editing the event immediately afterward can send a second update email.
          const event = calendar.createEvent(spec.title, new Date(spec.start), new Date(spec.end), {
            description: eventDescription_(spec, rsvp),
            location: spec.location,
            guests: rsvp.email,
            sendInvites: true
          });
          result.eventIds[spec.key] = event.getId();
        }
        result.sent.push(spec.key);
      } else if (oldEvent) {
        oldEvent.deleteEvent();
      }
    } catch (error) {
      console.error('Calendar ' + spec.key + ' failed: ' + error);
      result.failed.push(spec.key);
      if (oldId) result.eventIds[spec.key] = oldId;
    }
  });
  return result;
}

function eventDescription_(spec, rsvp) {
  return spec.description + '\nRSVP for: ' + [rsvp.name].concat(rsvp.guestNames).join(', ');
}

function updateCalendarEvent_(event, spec, rsvp) {
  if (event.getTitle() !== spec.title) event.setTitle(spec.title);
  if (event.getStartTime().getTime() !== new Date(spec.start).getTime() ||
      event.getEndTime().getTime() !== new Date(spec.end).getTime()) {
    event.setTime(new Date(spec.start), new Date(spec.end));
  }
  if (event.getLocation() !== spec.location) event.setLocation(spec.location);
  const description = eventDescription_(spec, rsvp);
  if (event.getDescription() !== description) event.setDescription(description);
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
