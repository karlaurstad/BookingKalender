/**
 * Sparbu Vel – Gapahuk booking handler
 *
 * This script is bound to the booking Google Form. On every form
 * submission it:
 *   1. Reads the requested date/time and requester details.
 *   2. Rejects the request if it breaks the duration rules.
 *   3. Rejects the request if it overlaps an existing calendar event
 *      (this also covers admin-created "blackout" events – any event
 *      already on the calendar blocks the slot, no special tagging
 *      needed).
 *   4. Otherwise creates the event on the public calendar and emails
 *      a confirmation to the requester (with a copy to the admin).
 *
 * SETUP: see README.md in the repo root. In short — paste this file's
 * contents into Extensions > Apps Script on the booking Form, fill in
 * the constants below, then add an installable trigger:
 * Triggers (clock icon) > Add Trigger > onFormSubmit > From form > On form submit.
 */

// ---- Configuration -------------------------------------------------

// The calendar bookings get created on. Find this under the target
// calendar's Settings > "Integrate calendar" > Calendar ID.
const CALENDAR_ID = '1654a8dbfc2f85512ea57b76ab43df1069193ad56215ada3288377e473fd93e1@group.calendar.google.com';

// Who gets a copy of every booking notification (confirmed or
// rejected). Leave as '' to disable admin copies.
const ADMIN_EMAIL = 'karlkristian@gmail.com';

// Booking duration rules, in minutes.
const MIN_DURATION_MINUTES = 60;      // 1 time
const MAX_DURATION_MINUTES = 8 * 60;  // 8 timer

// These must exactly match the question titles on the Google Form.
const FIELD_NAME = 'Navn';
const FIELD_PHONE = 'Telefon';
const FIELD_EMAIL = 'E-post';
const FIELD_PURPOSE = 'Formål / arrangement';
const FIELD_DATE = 'Dato';       // Form "Date" question
const FIELD_START = 'Starttid';  // Form "Short answer", validated as HH:MM (24-hour)
const FIELD_END = 'Sluttid';     // Form "Short answer", validated as HH:MM (24-hour)

// ---- Trigger entry point -------------------------------------------

function onFormSubmit(e) {
  const data = readResponse_(e);

  const validationError = validate_(data);
  if (validationError) {
    notify_(data, 'avvist', validationError);
    return;
  }

  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    notify_(data, 'feil', 'Fant ikke kalenderen. Sjekk CALENDAR_ID i skriptet.');
    return;
  }

  const overlapping = calendar.getEvents(data.start, data.end);
  if (overlapping.length > 0) {
    notify_(data, 'avvist', 'Tidspunktet er allerede opptatt eller stengt. Velg et annet tidspunkt.');
    return;
  }

  const title = data.name + ' – ' + data.purpose;
  const description = [
    'Navn: ' + data.name,
    'Telefon: ' + data.phone,
    'E-post: ' + data.email,
    'Formål: ' + data.purpose
  ].join('\n');

  calendar.createEvent(title, data.start, data.end, { description: description });

  notify_(data, 'bekreftet', '');
}

// ---- Helpers ---------------------------------------------------------

function readResponse_(e) {
  const answers = {};
  e.response.getItemResponses().forEach(function (ir) {
    answers[ir.getItem().getTitle().trim()] = ir.getResponse();
  });

  const dateStr = answers[FIELD_DATE];   // 'yyyy-MM-dd'
  const startStr = answers[FIELD_START]; // 'HH:mm:ss'
  const endStr = answers[FIELD_END];     // 'HH:mm:ss'

  return {
    name: answers[FIELD_NAME] || '',
    phone: answers[FIELD_PHONE] || '',
    email: answers[FIELD_EMAIL] || '',
    purpose: answers[FIELD_PURPOSE] || '',
    dateStr: dateStr,
    start: (dateStr && startStr) ? new Date(dateStr + 'T' + startStr) : null,
    end: (dateStr && endStr) ? new Date(dateStr + 'T' + endStr) : null
  };
}

function validate_(data) {
  if (!data.name || !data.purpose || !data.start || !data.end) {
    return 'Skjemaet manglet nødvendige felt.';
  }
  if (!(data.end.getTime() > data.start.getTime())) {
    return 'Sluttid må være etter starttid, samme dag.';
  }
  const minutes = (data.end.getTime() - data.start.getTime()) / 60000;
  if (minutes < MIN_DURATION_MINUTES) {
    return 'Bookingen er for kort. Minimum er ' + MIN_DURATION_MINUTES + ' minutter.';
  }
  if (minutes > MAX_DURATION_MINUTES) {
    return 'Bookingen er for lang. Maksimum er ' + (MAX_DURATION_MINUTES / 60) + ' timer.';
  }
  return null; // ok
}

function notify_(data, status, reason) {
  const recipients = [];
  if (data.email) recipients.push(data.email);

  let subject, body;
  if (status === 'bekreftet') {
    subject = 'Booking bekreftet: ' + data.purpose;
    body = 'Hei ' + data.name + ',\n\n' +
      'Bookingen din av gapahuken er bekreftet:\n' +
      formatRange_(data.start, data.end) + '\n' +
      'Formål: ' + data.purpose + '\n\n' +
      'Hilsen Sparbu Vel';
  } else {
    subject = 'Booking ' + status + ': ' + data.purpose;
    body = 'Hei ' + data.name + ',\n\n' +
      'Ønsket booking kunne ikke gjennomføres:\n' +
      (data.start && data.end ? formatRange_(data.start, data.end) + '\n' : '') +
      'Årsak: ' + reason + '\n\n' +
      'Prøv gjerne et annet tidspunkt via skjemaet.\n\n' +
      'Hilsen Sparbu Vel';
  }

  if (recipients.length > 0) {
    MailApp.sendEmail(recipients.join(','), subject, body);
  }
  if (ADMIN_EMAIL) {
    MailApp.sendEmail(ADMIN_EMAIL, '[admin] ' + subject, body);
  }
}

function formatRange_(start, end) {
  const tz = Session.getScriptTimeZone();
  const datePart = Utilities.formatDate(start, tz, 'EEEE d. MMMM yyyy');
  const startPart = Utilities.formatDate(start, tz, 'HH:mm');
  const endPart = Utilities.formatDate(end, tz, 'HH:mm');
  return datePart + ', kl. ' + startPart + '–' + endPart;
}
