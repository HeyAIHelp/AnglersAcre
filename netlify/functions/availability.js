// Reads the Anglers Acre Bookings Google Calendar and returns booked nights only.
// Event titles, descriptions and guest details never leave this function.
//
// Set CALENDAR_ICS_URL in Netlify (Project configuration > Environment variables)
// to the calendar's "Secret address in iCal format". Keep it out of this repo:
// the secret address shows full event details to anyone who has it.
//
// The public address is only a fallback. Google leaves events marked
// "Show as: Free" (the default for all-day events) out of the public
// free/busy feed, so bookings can go missing without the secret address.

const DEFAULT_ICS =
  "https://calendar.google.com/calendar/ical/224d82027c63bab221baccc8ecf3084b0222891478488e14ccc947fc3662806d%40group.calendar.google.com/public/basic.ics";
const ZONE = "America/Los_Angeles";

// Unfold ICS continuation lines, then split into lines
function lines(ics) {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

// "YYYY-MM-DD" for an instant, as the calendar date at the house
function localDate(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Turn an ICS DTSTART/DTEND value into a "YYYY-MM-DD" house date
function toDate(params, value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return `${y}-${mo}-${d}`;                 // all-day value
  if (z) return localDate(new Date(Date.UTC(+y, mo - 1, +d, +h, +mi, +s)));
  return `${y}-${mo}-${d}`;                          // floating or TZID: already wall-clock time
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function parse(ics) {
  const busy = [];
  let ev = null;
  for (const line of lines(ics)) {
    if (line === "BEGIN:VEVENT") { ev = {}; continue; }
    if (line === "END:VEVENT") {
      if (ev && ev.start && ev.status !== "CANCELLED") {
        let end = ev.end || addDays(ev.start, 1);
        if (end <= ev.start) end = addDays(ev.start, 1);
        busy.push({ start: ev.start, end });
      }
      ev = null;
      continue;
    }
    if (!ev) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(";");
    const value = line.slice(i + 1).trim();
    if (name === "DTSTART") ev.start = toDate(params, value);
    else if (name === "DTEND") ev.end = toDate(params, value);
    else if (name === "STATUS") ev.status = value.toUpperCase();
  }
  return busy;
}

// Merge overlapping or touching ranges; keep the next 18 months
function tidy(ranges, today) {
  const horizon = addDays(today, 550);
  const sorted = ranges
    .filter((r) => r.end > today && r.start < horizon)
    .sort((a, b) => a.start.localeCompare(b.start));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) { if (r.end > last.end) last.end = r.end; }
    else out.push({ ...r });
  }
  return out;
}

exports.handler = async () => {
  const url = process.env.CALENDAR_ICS_URL || DEFAULT_ICS;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AnglersAcre-Availability/1.0" } });
    const text = await res.text();
    if (!res.ok || !text.includes("BEGIN:VCALENDAR")) {
      throw new Error(`Calendar feed returned ${res.status}. Is the calendar shared publicly?`);
    }
    const today = localDate(new Date());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      },
      body: JSON.stringify({ updated: new Date().toISOString(), today, booked: tidy(parse(text), today) }),
    };
  } catch (err) {
    console.error(err.message);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ error: "calendar_unavailable" }),
    };
  }
};

exports._test = { parse, tidy };
