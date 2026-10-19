# Anglers Acre Website

A new website for **Anglers Acre**, a riverfront vacation rental on the Alsea River at 4633 East Alsea Highway, Waldport, Oregon. It replaces the 2018 GoDaddy single-page site at anglersacre.com.

It's a static site (plain HTML, CSS and JavaScript) with no build step, ready for Netlify.

## Pages

Each menu item has its own page, and each inner page ends with a link to the next one.

| Page | File | What's on it |
|---|---|---|
| Home | `index.html` | The sunset hero, quick facts (sleeps 6, 1,500 sq ft, beds, dock and ramp), a preview card for each page, and a "Ready to plan a trip?" panel. |
| The house | `house.html` | The rooms, plus an 11-photo gallery: living room, kitchen, dining, both bedrooms, back deck, bathroom, vanity, half bath, front, and yard. |
| The river | `river.html` | The private dock and ramp, wildlife from the deck, and the "From the dock" strip of the owner's 2024–2026 river photos. |
| Seasons | `seasons.html` | Month-by-month chart of what's running, with the current month highlighted, and five guest catch photos. The catch photos show past guests, including kids, so check the owner is happy to keep them public. |
| Nearby | `nearby.html` | Downriver, upriver, and on-the-water activities, with the Alsea Bay Bridge and beach photos. |
| Availability | `availability.html` | Calendar of open and booked nights from the Google Calendar. "Request these dates" opens the booking form with the dates filled in. |
| Request a stay | `book.html` | Netlify Forms request (dates, guests, boat, name, email, notes). It goes to `thanks.html`. |

## Logo

`images/logo.png` is the fish-in-a-rowboat logo from `../Pics/logo.png`, with its white background removed. It appears in the header, the footer, the booking section, the 404 and thank-you pages, and as the browser tab icon (`favicon-64.png`) and phone home-screen icon (`apple-touch-icon.png`). The original is only 124×145px, so a larger version would help it look sharp at bigger sizes.

## How the availability calendar works

`netlify/functions/availability.js` (served at `/api/availability`) downloads the calendar's public iCal feed. It sends the page only the booked date ranges, never event names, notes or guest details. Results are cached for 10 minutes.

If the feed can't be read, the page still works: every night shows as open, with a note asking guests to send their dates anyway. The calendar only works on Netlify. The local Python preview has no `/api` route, so it always shows that note.

### One-time setup for the owner (Google Calendar)

1. Sign in to [Google Calendar](https://calendar.google.com) as **anglersacre@gmail.com**.
2. Open **Settings**, then under **Settings for my calendars** pick **Anglers Acre Bookings**.
3. Under **Access permissions for events**, keep **Make available to public** ticked with **See only free/busy (hide details)**. The public sees only that a night is taken, never who booked it.

The site already reads the public address of **Anglers Acre Bookings** (the default in `netlify/functions/availability.js`), and this setup was confirmed working on 2026-10-19. To switch to a different calendar, set the Netlify environment variable `CALENDAR_ICS_URL` to that calendar's **Public address in iCal format**. Never use the **Secret address**: it exposes every event's details.

### Adding a booking

- **All-day event:** start it on the arrival day and end it on the **last night they stay**, which is the day before they leave. That way the leaving day stays open for the next guests to arrive.
- **Timed event:** from check-in time on the arrival day to check-out time on the leaving day, for example 4:00 PM Oct 24 to 11:00 AM Oct 27.
- Events marked **Free**, and cancelled events, don't block nights.
- Changes usually show on the site within minutes. Google sometimes takes a few hours to refresh its public feed.

## Going live on anglersacre.com

The domain stays registered at GoDaddy. Only its website records change to point at Netlify. Email records (MX) and everything else stay as they are.

### 1. Deploy to Netlify with the CLI

Drag-and-drop deploys skip the calendar function, so use the CLI. Run these from this folder:

```
npx netlify-cli login
npx netlify-cli deploy --prod
```

When asked, choose **Create & configure a new project** and name it, for example `anglers-acre`. The publish folder comes from `netlify.toml`. When it finishes, open `https://<name>.netlify.app` and check that every page loads.

### 2. Add the domain in Netlify

In the project, open **Domain management**, choose **Add a domain**, and enter `anglersacre.com`. When Netlify offers Netlify DNS, skip it: the DNS stays at GoDaddy. Set `anglersacre.com` as the **primary domain** so `www` redirects to it.

### 3. Change two records at GoDaddy

In GoDaddy, go to **My Products**, then **anglersacre.com**, then **DNS**.

| Type | Name | Was (GoDaddy Website Builder) | Change to |
|---|---|---|---|
| A | @ | 76.223.105.230 and 13.248.243.5 | **one** A record: `75.2.60.5`. Delete the other. |
| CNAME | www | `anglersacre.com` | `<name>.netlify.app` |

Leave the MX, NS and TXT records alone. If GoDaddy won't let you edit the A records, unpublish or disconnect the Website Builder site from the domain first.

### 4. Wait for HTTPS

The change takes from a few minutes to a few hours. Netlify then confirms the domain and issues a free HTTPS certificate automatically, under **Domain management** in the **HTTPS** section.

### 5. After it's live

- Send a test date request, and turn on email notifications for the "booking" form to anglersacre@gmail.com.
- Add a test booking to the Google Calendar and confirm those nights show as booked on the Availability page.
- Optional: add the site to Google Search Console and submit `https://anglersacre.com/sitemap.xml`.
- Cancel the GoDaddy **Website Builder** plan, but **keep the domain registration** and its auto-renew.

## Before going live

1. **Photos:** room photos come from the old GoDaddy gallery (circa 2015). River photos are the owner's own, from `../Pics`. Newer room photos, especially the bunk room and the master shower, would help most. Web copies live in `images/photos/` at 900px and 1600px.
2. **Season board:** have the owner confirm the month ratings (`data-s` on each row, one digit per month: 0 off, 1 fair, 2 good, 3 peak).
3. **Calendar:** sharing is set up (2026-10-19). After the first Netlify deploy, add a test booking and confirm those nights show as booked on the Availability page.
4. **Form notifications:** in Netlify, go to Forms, open "booking", and add an email notification to anglersacre@gmail.com.
