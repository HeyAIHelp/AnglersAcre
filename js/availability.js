(function () {
  // Each day cell stands for that night. A stay runs from the arrival night
  // up to (not including) the leaving day, so a guest can arrive on the day
  // someone else leaves.
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["S", "M", "T", "W", "T", "F", "S"];
  var EMAIL = "anglersacre@gmail.com";

  // Rates, matching rates.html. Seasons follow whole months.
  var SHORT = { name: "Short-term", months: [7, 8, 9], badge: "Short-term · 2-night min", minNights: 2, holidayMinNights: 3, fee: "$100 cleaning fee", feeAmount: 100 };
  var MONTHLY = { name: "Monthly", months: [10, 11, 12, 1, 2, 3, 4, 5, 6], badge: "Monthly · $2,300/mo", rate: "$2,300 / month" };

  var monthsEl = document.getElementById("cal-months");
  var rangeEl = document.getElementById("cal-range");
  var statusEl = document.getElementById("cal-status");
  var pickText = document.getElementById("cal-pick-text");
  var requestBtn = document.getElementById("cal-request");
  var clearBtn = document.getElementById("cal-clear");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");

  var booked = [];           // [{start, end}] with end exclusive, "YYYY-MM-DD"
  var prices = {};           // {"YYYY-MM-DD": 200} nightly prices from the AA Rates calendar
  var today = iso(new Date());
  var view = today.slice(0, 7) + "-01";  // first month shown
  var maxView = addMonths(view, 17);
  var arrive = null, leave = null;
  var loadFailed = false;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function addMonths(s, n) { var d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); }
  function nice(s) { var d = parse(s); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + ", " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
  function nights(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }

  function seasonOf(date) { return SHORT.months.indexOf(+date.slice(5, 7)) >= 0 ? SHORT : MONTHLY; }

  // Holiday weekends need 3 nights: the nights of July 3 and 4 plus any
  // Friday-Sunday night from July 2 to 6, and the Friday-Sunday nights
  // before Labor Day (the first Monday in September).
  function isHolidayNight(date) {
    var d = parse(date), m = d.getMonth() + 1, day = d.getDate(), dow = d.getDay();
    if (m === 7) return day === 3 || day === 4 || (day >= 2 && day <= 6 && (dow === 5 || dow === 6 || dow === 0));
    if (m === 9) {
      var first = new Date(d.getFullYear(), 8, 1).getDay();
      var laborDay = 1 + ((8 - first) % 7);
      return day >= laborDay - 3 && day <= laborDay - 1;
    }
    return false;
  }

  // What the chosen stay costs and whether it meets the minimum
  function stayRules(a, b) {
    var hasShort = false, hasMonthly = false, holiday = false;
    for (var d = a; d < b; d = addDays(d, 1)) {
      if (seasonOf(d) === SHORT) { hasShort = true; if (isHolidayNight(d)) holiday = true; }
      else hasMonthly = true;
    }
    var min = hasShort ? (holiday ? SHORT.holidayMinNights : SHORT.minNights) : 1;
    return { hasShort: hasShort, hasMonthly: hasMonthly, holiday: holiday, min: min, ok: nights(a, b) >= min };
  }

  function money(n) { return "$" + n.toLocaleString("en-US"); }

  // Nightly prices for the short-term nights of a stay
  function quote(a, b) {
    var total = 0, priced = 0, unpriced = 0, counts = {};
    for (var d = a; d < b; d = addDays(d, 1)) {
      if (seasonOf(d) !== SHORT) continue;
      if (prices[d] != null) { total += prices[d]; priced++; counts[prices[d]] = (counts[prices[d]] || 0) + 1; }
      else unpriced++;
    }
    var parts = Object.keys(counts).sort(function (x, y) { return y - x; }).map(function (p) {
      return counts[p] + " night" + (counts[p] > 1 ? "s" : "") + " &times; " + money(+p);
    });
    return { total: total, priced: priced, unpriced: unpriced, parts: parts };
  }

  function isBooked(night) {
    for (var i = 0; i < booked.length; i++) if (night >= booked[i].start && night < booked[i].end) return true;
    return false;
  }
  function rangeIsOpen(a, b) {
    for (var i = 0; i < booked.length; i++) if (booked[i].start < b && booked[i].end > a) return false;
    return true;
  }
  function monthsShown() { return window.matchMedia("(min-width: 760px)").matches ? 2 : 1; }

  function render() {
    var count = monthsShown();
    monthsEl.innerHTML = "";
    for (var m = 0; m < count; m++) monthsEl.appendChild(month(addMonths(view, m)));
    var first = parse(view), last = parse(addMonths(view, count - 1));
    rangeEl.textContent = count === 1 || first.getFullYear() === last.getFullYear()
      ? MONTHS[first.getMonth()] + (count > 1 ? " – " + MONTHS[last.getMonth()] : "") + " " + last.getFullYear()
      : MONTHS[first.getMonth()] + " " + first.getFullYear() + " – " + MONTHS[last.getMonth()] + " " + last.getFullYear();
    prevBtn.disabled = view <= today.slice(0, 7) + "-01";
    nextBtn.disabled = view >= maxView;
    summary();
  }

  function month(first) {
    var d0 = parse(first);
    var wrap = document.createElement("div");
    wrap.className = "cal-month";
    var h = document.createElement("h2");
    h.className = "cal-title";
    h.textContent = MONTHS[d0.getMonth()] + " " + d0.getFullYear();
    var season = seasonOf(first);
    var head = document.createElement("div");
    head.className = "cal-head";
    head.appendChild(h);
    var badge = document.createElement("a");
    badge.className = "cal-rate mono" + (season === SHORT ? " is-short" : "");
    badge.href = "rates.html";
    var lowest = null;
    for (var k in prices) if (k.slice(0, 7) === first.slice(0, 7) && k >= today && (lowest === null || prices[k] < lowest)) lowest = prices[k];
    badge.textContent = lowest !== null ? "Nightly · from " + money(lowest) : season.badge;
    badge.setAttribute("aria-label", MONTHS[d0.getMonth()] + " rates: " + season.badge.replace("·", ","));
    head.appendChild(badge);
    wrap.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "cal-grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", h.textContent);
    DOW.forEach(function (n) {
      var s = document.createElement("span");
      s.className = "cal-dow mono";
      s.textContent = n;
      s.setAttribute("aria-hidden", "true");
      grid.appendChild(s);
    });
    for (var i = 0; i < d0.getDay(); i++) grid.appendChild(document.createElement("span"));

    var days = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
    for (var day = 1; day <= days; day++) {
      var date = first.slice(0, 8) + pad(day);
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cal-day";
      var num = document.createElement("span");
      num.className = "cal-num";
      num.textContent = day;
      b.appendChild(num);
      b.dataset.date = date;
      var past = date < today, taken = isBooked(date);
      var label = nice(date);
      if (past) { b.classList.add("is-past"); b.disabled = true; label += ", past"; }
      else if (taken) { b.classList.add("is-booked"); label += ", booked"; }
      else {
        label += ", open";
        if (prices[date] != null) {
          var pr = document.createElement("span");
          pr.className = "cal-price";
          pr.textContent = money(prices[date]);
          b.appendChild(pr);
          b.classList.add("has-price");
          label += ", " + money(prices[date]) + " a night";
        }
      }
      if (date === today) b.classList.add("is-today");
      if (arrive && date === arrive) b.classList.add("is-arrive");
      if (arrive && leave && date > arrive && date < leave) b.classList.add("is-stay");
      if (leave && date === leave) b.classList.add("is-leave");
      // A booked night can still be someone's leaving day
      if (taken && !past && !(arrive && !leave && date > arrive && rangeIsOpen(arrive, date))) b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-label", label);
      b.addEventListener("click", choose);
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    return wrap;
  }

  function choose(e) {
    var date = e.currentTarget.dataset.date;
    if (date < today) return;
    if (arrive && leave && date > arrive && !stayRules(arrive, leave).ok) leave = null;
    if (arrive && !leave && date > arrive) {
      if (!rangeIsOpen(arrive, date)) {
        statusEl.textContent = "Those dates run into a booked night. Choose a leaving day before it, or pick a new arrival day.";
        return;
      }
      leave = date;
    } else {
      if (isBooked(date)) { statusEl.textContent = nice(date) + " is already booked. Choose an open night to arrive."; return; }
      arrive = date; leave = null;
    }
    if (!loadFailed) statusEl.textContent = "";
    render();
  }

  function summary() {
    clearBtn.hidden = !arrive;
    if (arrive && leave) {
      var n = nights(arrive, leave), r = stayRules(arrive, leave);
      var rates = [], q = quote(arrive, leave);
      if (r.hasShort && q.priced && !q.unpriced) {
        rates.push(q.parts.join(" + ") + " = " + money(q.total));
        rates.push("+ " + SHORT.fee + " = <strong>" + money(q.total + SHORT.feeAmount) + " total</strong>");
      } else if (r.hasShort && q.priced) {
        rates.push(q.parts.join(" + ") + " = " + money(q.total) + " &middot; we'll email the rate for the other " + q.unpriced + " night" + (q.unpriced > 1 ? "s" : ""));
        rates.push("+ " + SHORT.fee);
      } else if (r.hasShort) rates.push("Short-term stay &middot; " + SHORT.fee + " &middot; we'll email your rate");
      if (r.hasMonthly) rates.push("Monthly stay &middot; " + MONTHLY.rate);
      var html = "<strong>" + nice(arrive) + "</strong> to <strong>" + nice(leave) + "</strong> &middot; " + n + " night" + (n > 1 ? "s" : "") +
        '<span class="cal-pick-rate">' + rates.join("<br>") + "</span>";
      if (!r.ok) {
        html += '<span class="cal-pick-warn">' + (r.holiday
          ? "Independence Day and Labor Day weekends need at least 3 nights."
          : "Short-term stays need at least 2 nights.") + " Pick a later leaving day.</span>";
      }
      pickText.innerHTML = html;
      if (r.ok) {
        requestBtn.href = "book.html?arrival=" + arrive + "&departure=" + leave;
        requestBtn.removeAttribute("aria-disabled");
      } else {
        requestBtn.href = "book.html";
        requestBtn.setAttribute("aria-disabled", "true");
      }
    } else {
      pickText.textContent = arrive ? "Arriving " + nice(arrive) + ". Now tap the day you'd leave." : "Tap the day you'd arrive.";
      requestBtn.href = "book.html";
      requestBtn.setAttribute("aria-disabled", "true");
    }
  }

  requestBtn.addEventListener("click", function (e) {
    if (requestBtn.getAttribute("aria-disabled") === "true") e.preventDefault();
  });
  clearBtn.addEventListener("click", function () { arrive = leave = null; if (!loadFailed) statusEl.textContent = ""; render(); });
  prevBtn.addEventListener("click", function () { view = addMonths(view, -1); render(); });
  nextBtn.addEventListener("click", function () { view = addMonths(view, 1); render(); });
  window.matchMedia("(min-width: 760px)").addEventListener("change", render);

  // Nightly prices are optional: without them the calendar still works
  fetch("/api/rates", { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { prices = data.nightly || {}; render(); })
    .catch(function () {});

  fetch("/api/availability", { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      booked = data.booked || [];
      if (data.today) today = data.today;
      statusEl.className = "cal-status";
      statusEl.textContent = "";
      monthsEl.dataset.updated = data.updated || "";
      render();
    })
    .catch(function () {
      loadFailed = true;
      render();
      statusEl.className = "cal-status is-error";
      statusEl.innerHTML = "The calendar didn't load, so every night shows as open. Send your dates anyway and we'll check them, or email <a href=\"mailto:" + EMAIL + "\">" + EMAIL + "</a>.";
    });
})();
