// Generate the downloadable calendar files from the event details in Code.gs.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), context);
const events = vm.runInContext('RSVP_EVENTS', context);

function utc(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
    .replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldLine(line) {
  const parts = [];
  let part = '';
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 75) {
      parts.push(part);
      part = ' ';
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join('\r\n');
}

for (const lang of ['en', 'ko']) {
  const directory = path.join(root, 'assets/calendar', lang);
  fs.mkdirSync(directory, {recursive: true});
  for (const event of events) {
    const korean = lang === 'ko';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Joohyun and Fin//Wedding Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + event.key + '-20270424@joohyunfin.com',
      'DTSTAMP:20261108T000000Z',
      'DTSTART:' + utc(event.start),
      'DTEND:' + utc(event.end),
      'SUMMARY:' + escapeText(korean ? event.titleKo : event.title),
      'DESCRIPTION:' + escapeText((korean ? event.descriptionKo : event.description) + '\nhttps://joohyunfin.com/'),
      'URL:https://joohyunfin.com/',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    const location = korean ? event.locationKo : event.location;
    if (location) lines.splice(lines.indexOf('URL:https://joohyunfin.com/'), 0, 'LOCATION:' + escapeText(location));
    fs.writeFileSync(path.join(directory, event.key + '.ics'),
      lines.map(foldLine).join('\r\n') + '\r\n');
  }
}
