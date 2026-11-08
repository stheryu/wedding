/**
 * Joohyun & Fin · RSVP confirmation email ("Invitation Card" design)
 *
 * Drop this file into the RSVP Apps Script project (File > New > Script, name it RsvpEmail).
 * It only BUILDS the email. Your existing doPost / sheet code stays as it is: where it
 * currently sends the guest email, call renderRsvpEmail(...) and pass the result to
 * MailApp.sendEmail (example at the bottom of this file).
 *
 * Works in Gmail, Apple Mail, iPhone, Outlook and Naver Mail: table layout, inline styles,
 * no web fonts required (Cormorant Garamond shows where the mail app supports it, otherwise
 * Georgia / a Korean serif).
 */

// Set these two once.
var EMAIL_SITE_URL = 'https://joohyunfin.com/';
// The small petal at the top. Upload petal-mini.png next to the website files, or leave '' to hide it.
var EMAIL_PETAL_URL = 'https://joohyunfin.com/assets/petal-mini.png';

/**
 * @param {Object} d
 *   d.lang        'en' or 'ko'
 *   d.name        the guest's name as typed in the form, e.g. 'Joohyun Vermehr' or '유주현'
 *   d.phone       optional Korean RSVP phone number
 *   d.message     optional note from the guest
 *   d.attending   true / false
 *   d.guests      array of attending names, e.g. ['Joohyun Vermehr', 'Fin Vermehr']
 *   d.afterparty  true / false / null (null = not asked, e.g. Korean site)
 *   d.brunch      true / false / null (null = not asked)
 *   d.calendarFailed  event keys whose calendar invitations failed
 * @return {{subject:string, html:string, text:string}}
 */
function renderRsvpEmail(d) {
  var ko = d.lang === 'ko';
  var T = ko ? KO_COPY : EN_COPY;
  var guests = (d.guests && d.guests.length) ? d.guests : [d.name];
  var first = ko ? d.name : String(d.name).split(/\s+/)[0];

  var C = { ink: '#5a2e35', soft: '#86595f', rose: '#a3495a', deep: '#7d2a3c', rule: '#c98a96', rule2: '#ecd0cd' };
  var serif = ko
    ? "'Nanum Myeongjo','AppleMyungjo','Batang',Georgia,serif"
    : "'Cormorant Garamond',Georgia,'Times New Roman',serif";
  var latin = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

  function p(text, size, extra) {
    return '<p style="margin:0;font-family:' + serif + ';font-size:' + size + 'px;line-height:1.55;color:' + C.ink + ';' + (ko ? 'word-break:keep-all;' : '') + (extra || '') + '">' + text + '</p>';
  }
  function label(text, extra) {
    return '<p style="margin:0;font-family:' + serif + ';font-size:13px;font-weight:bold;letter-spacing:' + (ko ? '.16em' : '.26em') + ';color:' + C.rose + ';' + (extra || '') + '">' + text + '</p>';
  }
  function rule() {
    return '<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:30px auto"><tr><td width="36" height="1" style="width:36px;height:1px;line-height:1px;font-size:1px;background:' + C.rule + '">&nbsp;</td></tr></table>';
  }
  function event(title, when) {
    return p(title, 25, 'font-style:' + (ko ? 'normal' : 'italic') + ';margin-top:12px') + p(when, 17, 'margin-top:2px');
  }

  // ---- body blocks ----
  var blocks = [];
  if (EMAIL_PETAL_URL) {
    blocks.push('<img src="' + EMAIL_PETAL_URL + '" width="64" alt="" style="display:block;margin:0 auto;width:64px;height:auto;border:0">');
  }
  blocks.push(label(T.received, 'margin-top:18px'));
  blocks.push('<p style="margin:10px 0 0;font-family:' + latin + ';font-size:42px;font-weight:300;letter-spacing:.03em;color:' + C.ink + '">'
    + (ko ? '<span style="font-family:' + serif + '">주현</span> <i style="font-weight:400">&amp;</i> <span style="font-family:' + serif + '">핀</span>'
          : 'JOOHYUN <i style="font-weight:400">&amp;</i> FIN') + '</p>');
  blocks.push('<p style="margin:8px 0 0;font-family:' + serif + ';font-size:14px;letter-spacing:' + (ko ? '.16em' : '.3em') + ';color:' + C.soft + '">' + T.dateLine + '</p>');
  blocks.push(rule());
  blocks.push(p(T.hello(esc_(first)), 21));
  blocks.push(p(d.attending ? T.thanksYes : T.thanksNo, 19, 'margin-top:10px'));
  if (ko && d.phone) blocks.push(p(T.phone + ': ' + esc_(d.phone), 15, 'color:' + C.soft + ';margin-top:12px'));

  if (d.attending) {
    blocks.push(label(T.attendingLabel, 'margin-top:26px'));
    blocks.push(p(guests.map(esc_).join(ko ? ', ' : ' &amp; '), 20, 'font-style:' + (ko ? 'normal' : 'italic') + ';margin-top:6px'));
    blocks.push(rule());
    blocks.push(label(T.sat));
    blocks.push(event(T.ceremony, T.ceremonyWhen));
    if (d.afterparty === true) blocks.push(event(T.party, T.partyWhen));
    if (d.brunch === true) {
      blocks.push(label(T.sun, 'margin-top:28px'));
      blocks.push(event(T.brunch, T.brunchWhen));
    }
    if (T.tzNote) blocks.push(p(T.tzNote, 14, 'color:' + C.soft + ';margin-top:18px'));
    blocks.push(rule());
    blocks.push('<p style="margin:0;font-family:' + serif + ';font-size:14px;font-weight:bold;letter-spacing:' + (ko ? '.12em' : '.24em') + '">'
      + link_(EMAIL_SITE_URL, T.site, C.deep) + '</p>');
  } else {
    blocks.push(rule());
    blocks.push('<p style="margin:0;font-family:' + serif + ';font-size:14px;font-weight:bold;letter-spacing:' + (ko ? '.12em' : '.24em') + '">' + link_(EMAIL_SITE_URL, T.site, C.deep) + '</p>');
  }
  if (d.message) {
    blocks.push(label(T.noteLabel, 'margin-top:28px'));
    blocks.push(p(esc_(d.message).replace(/\r?\n/g, '<br>'), 17, 'margin-top:6px'));
  }
  if (d.calendarFailed && d.calendarFailed.length) blocks.push(p(T.calendarFailed, 15, 'color:' + C.soft + ';margin-top:18px'));
  blocks.push(p(T.close, 21, 'font-style:' + (ko ? 'normal' : 'italic') + ';margin-top:34px'));
  blocks.push(p(T.change, 15, 'color:' + C.soft + ';margin-top:10px'));

  var html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&display=swap" rel="stylesheet"></head>' +
    '<body style="margin:0;padding:0;background:#ffffff">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 12px">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border:1px solid ' + C.rule + '"><tr><td style="padding:6px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ' + C.rule2 + '"><tr><td align="center" style="padding:44px 40px 46px;text-align:center">' +
    blocks.join('') +
    '</td></tr></table></td></tr></table></td></tr></table></body></html>';

  // Plain-text version (shown by mail apps that block HTML, and used as the preview line).
  var text = [T.hello(first), '', d.attending ? T.thanksYes : T.thanksNo, ''];
  if (ko && d.phone) text.push(T.phone + ': ' + d.phone, '');
  if (d.attending) {
    text.push(T.attendingLabel + ': ' + guests.join(', '), '', T.sat, T.ceremony + ': ' + T.ceremonyWhen);
    if (d.afterparty === true) text.push(T.party + ': ' + T.partyWhen);
    if (d.brunch === true) text.push('', T.sun, T.brunch + ': ' + T.brunchWhen);
    if (T.tzNote) text.push('', T.tzNote);
  }
  if (d.message) text.push('', T.noteLabel + ': ' + d.message);
  if (d.calendarFailed && d.calendarFailed.length) text.push('', T.calendarFailed);
  text.push(T.site + ': ' + EMAIL_SITE_URL, '', T.closePlain, T.change);

  return { subject: d.attending ? T.subjectYes : T.subjectNo, html: html, text: plain_(text.join('\n')) };
}

var EN_COPY = {
  subjectYes: 'RSVP received · Joohyun & Fin’s wedding',
  subjectNo: 'Thank you for your RSVP · Joohyun & Fin',
  received: 'RSVP RECEIVED',
  dateLine: 'APRIL 24, 2027 · SEOUL',
  hello: function (n) { return 'Hi ' + n + ','; },
  thanksYes: 'Thank you for your RSVP.<br>We can’t wait to celebrate with you!',
  thanksNo: 'Thank you for letting us know.<br>We’ll miss you, and we’re grateful for your love.',
  attendingLabel: 'ATTENDING',
  sat: 'SATURDAY, APRIL 24',
  ceremony: 'Ceremony &amp; dinner',
  ceremonyWhen: '4:00 to 6:00 PM · Ilhwadang, Samcheonggak',
  party: 'After party',
  partyWhen: '7:00 PM to 1:00 AM · Pairing, Hyehwa-dong',
  sun: 'SUNDAY, APRIL 25',
  brunch: 'Farewell brunch',
  brunchWhen: '10:00 AM to 1:00 PM · Venue to follow',
  tzNote: 'All times are Seoul time.',
  site: 'OUR WEBSITE',
  noteLabel: 'YOUR NOTE',
  calendarFailed: 'Some calendar invitations could not be completed. Please check your calendar against the schedule above.',
  close: 'With love, Joohyun &amp; Fin',
  closePlain: 'With love, Joohyun & Fin',
  change: 'Need to change something? Just reply to this email.'
};

var KO_COPY = {
  subjectYes: '참석 회신 확인 · 주현 & 핀 결혼식',
  subjectNo: '회신 확인 · 주현 & 핀 결혼식',
  received: '회신 확인',
  dateLine: '2027. 4. 24 · 서울',
  hello: function (n) { return n + '님, 안녕하세요.'; },
  thanksYes: '결혼식 참석 여부를 알려 주셔서 감사합니다.<br>그날 뵙기를 기다리겠습니다.',
  thanksNo: '참석 여부를 알려 주셔서 감사합니다.<br>함께하지 못해 아쉽지만, 보내 주신 마음에 감사드립니다.',
  attendingLabel: '참석하시는 분(들)',
  sat: '2027년 4월 24일 토요일',
  ceremony: '예식 및 피로연',
  ceremonyWhen: '오후 4:00 ~ 6:00 · 삼청각 일화당',
  party: '애프터 파티',
  partyWhen: '오후 7:00 ~ 새벽 1:00 · 페어링, 혜화동',
  sun: '2027년 4월 25일 일요일',
  brunch: '브런치',
  brunchWhen: '오전 10:00 ~ 오후 1:00 · 장소 추후 안내',
  tzNote: '',
  site: '웹사이트 보기',
  phone: '연락처',
  noteLabel: '남겨 주신 말씀',
  calendarFailed: '일부 캘린더 일정 변경을 완료하지 못했습니다. 일정을 확인해 주세요.',
  close: '주현 &amp; 핀 드림',
  closePlain: '주현 & 핀 드림',
  change: '변경 사항이 있으시면 이 메일에 회신해 주세요.'
};

function link_(href, text, color) {
  return '<a href="' + href + '" style="color:' + color + ';text-decoration:underline">' + text + '</a>';
}

// Turns the HTML bits of the copy into plain text for the text-only version.
function plain_(s) {
  return String(s).replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------
 * How to send it (replace the current guest email call with this):
 *
 *   var mail = renderRsvpEmail({
 *     lang: 'en',                                  // or 'ko'
 *     name: 'Joohyun Vermehr',
 *     attending: true,
 *     guests: ['Joohyun Vermehr', 'Fin Vermehr'],
 *     afterparty: true,                            // null on the Korean site
 *     brunch: true                                 // null on the Korean site
 *   });
 *   MailApp.sendEmail(guestEmail, mail.subject, mail.text, { htmlBody: mail.html, name: 'Joohyun & Fin' });
 *
 * Try it: pick previewRsvpEmail in the editor and press Run. It emails all four versions to you.
 * ------------------------------------------------------------------ */
function previewRsvpEmail() {
  var me = Session.getEffectiveUser().getEmail();
  [
    { lang: 'en', name: 'Joohyun Vermehr', attending: true, guests: ['Joohyun Vermehr', 'Fin Vermehr'], afterparty: true, brunch: true },
    { lang: 'en', name: 'Joohyun Vermehr', attending: false },
    { lang: 'ko', name: '유주현', attending: true, guests: ['유주현'], afterparty: null, brunch: null },
    { lang: 'ko', name: '유주현', attending: false }
  ].forEach(function (d) {
    var m = renderRsvpEmail(d);
    MailApp.sendEmail(me, '[Preview] ' + m.subject, m.text, { htmlBody: m.html, name: 'Joohyun & Fin' });
  });
}
