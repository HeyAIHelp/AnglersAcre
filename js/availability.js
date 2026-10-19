(function () {
  // Each day cell stands for that night. A stay runs from the arrival night
  // up to (not including) the leaving day, so a guest can arrive on the day
  // someone else leaves.
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = ["S", "M", "T", "W", "T", "F", "S"];
  var EMAIL = "anglersacre@gmail.com";

  var monthsEl = document.getElementById("cal-months");
  var rangeEl = document.getElementById("cal-range");
  var statusEl = document.getElementById("cal-status");
  var pickText = document.getElementById("cal-pick-text");
  var requestBtn = document.getElementById("cal-request");
  var clearBtn = document.getElementById("cal-clear");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");

  var booked = [];           // [{start, end}] with end exclusive, "YYYY-MM-DD"
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
    wrap.appendChild(h);

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
      b.textContent = day;
      b.dataset.date = date;
      var past = date < today, taken = isBooked(date);
      var label = nice(date);
      if (past) { b.classList.add("is-past"); b.disabled = true; label += ", past"; }
      else if (taken) { b.classList.add("is-booked"); label += ", booked"; }
      else label += ", open";
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
      var n = nights(arrive, leave);
      pickText.innerHTML = "<strong>" + nice(arrive) + "</strong> to <strong>" + nice(leave) + "</strong> &middot; " + n + " night" + (n > 1 ? "s" : "");
      requestBtn.href = "book.html?arrival=" + arrive + "&departure=" + leave;
      requestBtn.removeAttribute("aria-disabled");
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
