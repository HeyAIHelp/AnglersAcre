// Reads the "AA Rates" Google Calendar and returns a price for each night.
// Each all-day event's title is its nightly price, for example "$200".
// Weekly or daily repeating events, skipped dates and edited single dates are
// all understood.
//
// Set RATES_ICS_URL in Netlify (Project configuration > Environment variables)
// to the calendar's "Secret address in iCal format". Keep it out of this repo.
// The public address won't work: Google hides event titles in free/busy view.

const ZONE = "America/Los_Angeles";
const HORIZON_DAYS = 550;
const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function lines(ics) {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function localDate(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function toDate(value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h && z) return localDate(new Date(Date.UTC(+y, mo - 1, +d, +h, +mi, +s)));
  return `${y}-${mo}-${d}`;
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekday(iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); }
function daysBetween(a, b) { return Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5); }

// "$200", "200", "$1,250.00 / night" -> 200, 200, 1250
function price(summary) {
  const m = (summary || "").replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

function parseEvents(ics) {
  const events = [];
  let ev = null;
  for (const line of lines(ics)) {
    if (line === "BEGIN:VEVENT") { ev = { exdates: [] }; continue; }
    if (line === "END:VEVENT") { if (ev && ev.start) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const name = line.slice(0, i).split(";")[0];
    const value = line.slice(i + 1).trim();
    if (name === "DTSTART") ev.start = toDate(value);
    else if (name === "DTEND") ev.end = toDate(value);
    else if (name === "SUMMARY") ev.summary = value.replace(/\\,/g, ",");
    else if (name === "STATUS") ev.status = value.toUpperCase();
    else if (name === "UID") ev.uid = value;
    else if (name === "RRULE") ev.rrule = value;
    else if (name === "RECURRENCE-ID") ev.recurrenceId = toDate(value);
    else if (name === "EXDATE") value.split(",").forEach((v) => { const d = toDate(v); if (d) ev.exdates.push(d); });
  }
  return events;
}

// Start dates of every occurrence of a repeating event, up to the horizon
function occurrences(ev, horizon) {
  if (!ev.rrule) return [ev.start];
  const r = {};
  ev.rrule.split(";").forEach((p) => { const [k, v] = p.split("="); r[k] = v; });
  const until = r.UNTIL ? toDate(r.UNTIL) : null;
  const count = r.COUNT ? +r.COUNT : Infinity;
  const interval = r.INTERVAL ? +r.INTERVAL : 1;
  const byday = r.BYDAY ? r.BYDAY.split(",").map((d) => DAYS.indexOf(d.slice(-2))) : null;
  const out = [];
  for (let d = ev.start, n = 0; d <= horizon && out.length < count; d = addDays(d, 1), n++) {
    if (until && d > until) break;
    let hit = false;
    if (r.FREQ === "DAILY") hit = n % interval === 0;
    else if (r.FREQ === "WEEKLY") {
      const week = Math.floor((daysBetween(ev.start, d) + weekday(ev.start)) / 7);
      hit = week % interval === 0 && (byday ? byday.includes(weekday(d)) : weekday(d) === weekday(ev.start));
    } else if (r.FREQ === "MONTHLY") hit = d.slice(8) === ev.start.slice(8);
    else if (r.FREQ === "YEARLY") hit = d.slice(5) === ev.start.slice(5);
    else { out.push(ev.start); break; }
    if (hit && !ev.exdates.includes(d)) out.push(d);
  }
  return out;
}

function nightlyPrices(ics, today) {
  const horizon = addDays(today, HORIZON_DAYS);
  const events = parseEvents(ics);
  // edited single dates of a repeating event replace that occurrence
  const overridden = new Set(events.filter((e) => e.recurrenceId).map((e) => e.uid + "|" + e.recurrenceId));
  const nights = {};
  const put = (start, length, amount, single) => {
    for (let i = 0; i < length; i++) {
      const d = addDays(start, i);
      if (d < today || d > horizon) continue;
      // a one-off event beats a repeating one on the same night
      if (nights[d] && nights[d].single && !single) continue;
      nights[d] = { amount, single };
    }
  };
  for (const ev of events) {
    if (ev.status === "CANCELLED") continue;
    const amount = price(ev.summary);
    if (amount == null) continue;
    const length = Math.max(1, ev.end ? daysBetween(ev.start, ev.end) : 1);
    for (const start of occurrences(ev, horizon)) {
      if (ev.rrule && overridden.has(ev.uid + "|" + start)) continue;
      put(start, length, amount, !ev.rrule);
    }
  }
  const out = {};
  Object.keys(nights).sort().forEach((d) => { out[d] = nights[d].amount; });
  return out;
}

exports.handler = async () => {
  const url = process.env.RATES_ICS_URL;
  if (!url) {
    return { statusCode: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ error: "rates_not_configured" }) };
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AnglersAcre-Rates/1.0" } });
    const text = await res.text();
    if (!res.ok || !text.includes("BEGIN:VCALENDAR")) throw new Error(`Rates feed returned ${res.status}`);
    const today = localDate(new Date());
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
      body: JSON.stringify({ updated: new Date().toISOString(), today, nightly: nightlyPrices(text, today) }),
    };
  } catch (err) {
    console.error(err.message);
    return { statusCode: 502, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ error: "rates_unavailable" }) };
  }
};

exports._test = { nightlyPrices, price, occurrences };
