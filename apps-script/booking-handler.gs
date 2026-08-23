/**
 * Sparbu Vel – Gapahuk booking handler
 *
 * This script is bound to the booking Google Form. On every form
 * submission it:
 *   1. Reads the requested date/time and requester details.
 *   2. Rejects the request if it breaks the duration or date-window
 *      rules.
 *   3. Rejects the request if it overlaps an existing calendar event
 *      (this also covers admin-created "blackout" events – any event
 *      already on the calendar blocks the slot, no special tagging
 *      needed).
 *   4. Otherwise creates the event on the public calendar and emails
 *      a confirmation to the requester (with a copy to the admin).
 *
 * The form is deliberately open – no Google login required – so the
 * abuse controls live here: free text is sanitised before it reaches
 * the public calendar, and daily caps limit how much damage a spammer
 * or a bot can do before a human notices.
 *
 * SETUP: see README.md in the repo root. In short — paste this file's
 * contents into Extensions > Apps Script on the booking Form, set the
 * ADMIN_EMAIL script property, then add an installable trigger:
 * Triggers (clock icon) > Add Trigger > onFormSubmit > From form > On form submit.
 */

// ---- Configuration -------------------------------------------------

// The calendar bookings get created on. Find this under the target
// calendar's Settings > "Integrate calendar" > Calendar ID.
const CALENDAR_ID = '1654a8dbfc2f85512ea57b76ab43df1069193ad56215ada3288377e473fd93e1@group.calendar.google.com';

// Who gets a copy of every booking notification (confirmed or
// rejected). Stored as a script property rather than in the code, so
// no personal address ends up in the public GitHub repo and the value
// survives pasting a new version of this file.
// Set it under Project Settings > Script Properties: ADMIN_EMAIL.
const ADMIN_EMAIL =
  PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL') || '';

// Booking duration rules, in minutes.
const MIN_DURATION_MINUTES = 60;      // 1 time
const MAX_DURATION_MINUTES = 8 * 60;  // 8 timer

// How far ahead a booking may be made.
const MAX_ADVANCE_DAYS = 180;         // ~6 måneder

// Abuse limits. These cap the damage from an automated attack; they
// are not meant to stop a determined attacker, only to buy time for a
// human to notice and step in.
const MAX_BOOKINGS_PER_DAY = 10;           // globalt tak per døgn
const MAX_EMAILS_PER_ADDRESS_PER_DAY = 5;  // hindrer spam mot tredjepart
const MAX_ADMIN_EMAILS_PER_DAY = 50;       // beskytter Gmail-kvoten

// Length caps on free text that ends up on the public calendar.
const MAX_NAME_CHARS = 40;
const MAX_PURPOSE_CHARS = 60;
const MAX_CONTACT_CHARS = 60;

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
  prune_();

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

  const title = data.name + ' – ' + data.purpose;
  const description = [
    'Navn: ' + data.name,
    'Telefon: ' + data.phone,
    'E-post: ' + data.email,
    'Formål: ' + data.purpose
  ].join('\n');

  // The overlap check and the create must not interleave with another
  // submission, or two people can both be told a slot is free.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    notify_(data, 'avvist', 'Systemet var opptatt. Prøv igjen om et øyeblikk.');
    return;
  }

  try {
    if (calendar.getEvents(data.start, data.end).length > 0) {
      notify_(data, 'avvist', 'Tidspunktet er allerede opptatt eller stengt. Velg et annet tidspunkt.');
      return;
    }

    if (atCap_('count:' + today_(), MAX_BOOKINGS_PER_DAY)) {
      notify_(data, 'avvist',
        'Det er gjort mange bookinger i dag, og systemet har nådd dagens grense. ' +
        'Prøv igjen i morgen, eller ta kontakt med styret.');
      return;
    }

    calendar.createEvent(title, data.start, data.end, { description: description });
    bump_('count:' + today_());
  } finally {
    lock.releaseLock();
  }

  notify_(data, 'bekreftet', '');
}

// ---- Helpers ---------------------------------------------------------

function readResponse_(e) {
  const answers = {};
  e.response.getItemResponses().forEach(function (ir) {
    answers[ir.getItem().getTitle().trim()] = ir.getResponse();
  });

  const dateStr = answers[FIELD_DATE];   // 'yyyy-MM-dd'
  const startStr = answers[FIELD_START]; // 'HH:mm'
  const endStr = answers[FIELD_END];     // 'HH:mm'

  return {
    name: sanitize_(answers[FIELD_NAME], MAX_NAME_CHARS),
    phone: sanitize_(answers[FIELD_PHONE], MAX_CONTACT_CHARS),
    email: sanitize_(answers[FIELD_EMAIL], MAX_CONTACT_CHARS),
    purpose: sanitize_(answers[FIELD_PURPOSE], MAX_PURPOSE_CHARS),
    dateStr: dateStr,
    start: (dateStr && startStr) ? new Date(dateStr + 'T' + startStr) : null,
    end: (dateStr && endStr) ? new Date(dateStr + 'T' + endStr) : null
  };
}

/**
 * Free text from an open form ends up on a calendar that is embedded
 * on the association's public website, so strip anything that could be
 * used to deface it or plant a link, and cap the length.
 */
function sanitize_(text, maxLen) {
  if (!text) return '';
  return String(text)
    .replace(/\b(?:https?:\/\/|www\.)\S*/gi, '') // lenker
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function validate_(data) {
  if (!data.name || !data.purpose || !data.start || !data.end) {
    return 'Skjemaet manglet nødvendige felt.';
  }
  if (isNaN(data.start.getTime()) || isNaN(data.end.getTime())) {
    return 'Dato eller klokkeslett kunne ikke leses. Bruk 24-timersformat, f.eks. 14:00.';
  }
  if (!(data.end.getTime() > data.start.getTime())) {
    return 'Sluttid må være etter starttid, samme dag.';
  }

  const now = new Date();
  if (data.start.getTime() < now.getTime()) {
    return 'Tidspunktet har allerede vært. Velg et tidspunkt fram i tid.';
  }
  const daysAhead = (data.start.getTime() - now.getTime()) / 86400000;
  if (daysAhead > MAX_ADVANCE_DAYS) {
    return 'Du kan booke inntil ' + MAX_ADVANCE_DAYS + ' dager fram i tid.';
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
      (data.start && data.end && !isNaN(data.start.getTime()) && !isNaN(data.end.getTime())
        ? formatRange_(data.start, data.end) + '\n' : '') +
      'Årsak: ' + reason + '\n\n' +
      'Prøv gjerne et annet tidspunkt via skjemaet.\n\n' +
      'Hilsen Sparbu Vel';
  }

  // The e-mail address is unverified user input, so the form could
  // otherwise be used to flood a third party from this account.
  let suppressed = false;
  if (data.email) {
    const key = 'mail:' + data.email.toLowerCase() + ':' + today_();
    if (atCap_(key, MAX_EMAILS_PER_ADDRESS_PER_DAY)) {
      suppressed = true;
    } else {
      bump_(key);
      sendMail_(data.email, subject, body);
    }
  }

  if (ADMIN_EMAIL) {
    const adminKey = 'mail:admin:' + today_();
    if (!atCap_(adminKey, MAX_ADMIN_EMAILS_PER_DAY)) {
      bump_(adminKey);
      sendMail_(ADMIN_EMAIL, '[admin] ' + subject,
        body + (suppressed
          ? '\n\n(Varsel til ' + data.email + ' ble ikke sendt – adressen har ' +
            'nådd dagens grense. Dette kan tyde på misbruk av skjemaet.)'
          : ''));
    } else if (!atCap_(adminKey, MAX_ADMIN_EMAILS_PER_DAY + 1)) {
      bump_(adminKey);
      sendMail_(ADMIN_EMAIL, '[admin] Mange bookingvarsler i dag',
        'Det er sendt ' + MAX_ADMIN_EMAILS_PER_DAY + ' varsler i dag, og ' +
        'flere varsler undertrykkes fram til i morgen for å spare e-postkvoten.\n' +
        'Sjekk kalenderen og skjemaets regneark – dette kan være misbruk.\n\n' +
        'Hilsen bookingsystemet');
    }
  }
}

function sendMail_(to, subject, body) {
  try {
    MailApp.sendEmail(to, subject, body);
  } catch (err) {
    // Quota exhausted or invalid address – log and carry on, so a
    // failed notification never rolls back a valid booking.
    console.error('Kunne ikke sende e-post til ' + to + ': ' + err);
  }
}

// ---- Daily counters (Script Properties, no database) -----------------

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function atCap_(key, cap) {
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  return (raw ? Number(raw) : 0) >= cap;
}

function bump_(key) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(key);
  props.setProperty(key, String((raw ? Number(raw) : 0) + 1));
}

/** Drop counter keys from previous days so the store stays small. */
function prune_() {
  const props = PropertiesService.getScriptProperties();
  const stamp = today_();
  Object.keys(props.getProperties()).forEach(function (key) {
    if ((key.indexOf('count:') === 0 || key.indexOf('mail:') === 0) &&
        key.slice(-10) !== stamp) {
      props.deleteProperty(key);
    }
  });
}

function formatRange_(start, end) {
  const tz = Session.getScriptTimeZone();
  const datePart = Utilities.formatDate(start, tz, 'EEEE d. MMMM yyyy');
  const startPart = Utilities.formatDate(start, tz, 'HH:mm');
  const endPart = Utilities.formatDate(end, tz, 'HH:mm');
  return datePart + ', kl. ' + startPart + '–' + endPart;
}
