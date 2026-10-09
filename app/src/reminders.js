// Reminders that work without a server:
//  1. a daily recurring calendar event (.ics) with an alarm - works in Google
//     Calendar, Apple Calendar and Outlook, on every device the calendar syncs to;
//  2. a browser notification when the app is open or installed and cards are due.

const icsEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// RFC 5545 limits lines to 75 octets; longer lines continue after CRLF + space.
function fold(line) {
  const parts = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

// time: "HH:MM" in the learner's local time. The event uses floating local time,
// so it fires at that clock time wherever the learner is.
export function buildDailyReminderIcs({ time = "19:00", minutes = 15, url = "", startDate = new Date(), now = new Date() } = {}) {
  const [hh, mm] = time.split(":").map(Number);
  if (!(hh >= 0 && hh < 24 && mm >= 0 && mm < 60)) throw new Error(`invalid time "${time}"`);
  const start = new Date(startDate);
  const dtStart = `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(hh)}${pad(mm)}00`;
  const description = `${minutes} minutes: review due cards, then one new step. Short daily sessions beat long weekly ones (spacing effect).${url ? ` Open: ${url}` : ""}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//statLearner//daily reminder//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:statlearner-daily-review@statlearner.app",
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${dtStart}`,
    `DURATION:PT${minutes}M`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:${icsEscape("statLearner: daily review")}`,
    `DESCRIPTION:${icsEscape(description)}`,
    ...(url ? [`URL:${url}`] : []),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape("Time for statLearner")}`,
    "TRIGGER:-PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// True when the reminder time has passed today and we have not notified today.
export function shouldNotify({ time, lastNotifiedDay, today, nowMinutes, dueCount }) {
  if (!time || dueCount <= 0 || lastNotifiedDay === today) return false;
  const [hh, mm] = time.split(":").map(Number);
  return nowMinutes >= hh * 60 + mm;
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "default") return Notification.requestPermission();
  return Notification.permission;
}

export async function notify(title, body) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  const reg = typeof navigator !== "undefined" && navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null;
  if (reg) await reg.showNotification(title, { body, icon: "icon.svg", tag: "statlearner-due" });
  else new Notification(title, { body, icon: "icon.svg" });
  return true;
}
