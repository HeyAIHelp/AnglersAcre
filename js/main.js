(function () {
  // Sticky header once the hero scrolls away
  var head = document.querySelector(".site-head");
  var hero = document.querySelector(".hero");
  if (head && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      head.classList.toggle("is-stuck", !entries[0].isIntersecting);
    }, { rootMargin: "-80px 0px 0px 0px" }).observe(hero);
  }

  // Phone menu
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  if (nav && toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    });
    nav.querySelectorAll("ul a").forEach(function (a) {
      a.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "Menu";
      });
    });
  }

  // Season board: draw the cells and mark the current month
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var LEVEL = ["off", "fair", "good", "peak"];
  var now = new Date().getMonth();
  var peak = [], good = [];

  document.querySelectorAll(".board-row[data-s]").forEach(function (row) {
    var name = row.querySelector(".board-label").firstChild.textContent.trim();
    row.dataset.s.split("").forEach(function (d, m) {
      var c = document.createElement("span");
      c.className = "cell s" + d + (m === now ? " is-now" : "");
      c.setAttribute("role", "cell");
      c.setAttribute("aria-label", MONTHS[m] + ": " + LEVEL[+d]);
      row.appendChild(c);
      if (m === now && d === "3") peak.push(name);
      if (m === now && d === "2") good.push(name);
    });
  });

  var heads = document.querySelectorAll(".board-months span[role=columnheader]");
  if (heads[now + 1]) heads[now + 1].classList.add("is-now");

  var out = document.getElementById("board-now");
  if (out && (peak.length || good.length)) {
    var lc = function (n) { return /^Dungeness/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1); };
    var list = function (a) { a = a.map(lc); return a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0]; };
    var msg = "In " + MONTHS[now] + ": ";
    if (peak.length) msg += list(peak) + (peak.length > 1 ? " are" : " is") + " at peak";
    if (peak.length && good.length) msg += ", and ";
    if (good.length) msg += list(good) + " " + (good.length > 1 ? "are" : "is") + " good";
    out.textContent = msg + ".";
  }

  // Booking form: leaving must come after arriving
  var form = document.querySelector(".book-form");
  if (form) {
    var arr = form.elements.arrival, dep = form.elements.departure, err = document.getElementById("form-error");
    var today = new Date().toISOString().slice(0, 10);
    arr.min = today; dep.min = today;
    arr.addEventListener("change", function () { if (arr.value) dep.min = arr.value; });

    // Dates picked on the availability page arrive as ?arrival=&departure=
    var q = new URLSearchParams(location.search), okDate = /^\d{4}-\d{2}-\d{2}$/;
    if (okDate.test(q.get("arrival") || "") && q.get("arrival") >= today) { arr.value = q.get("arrival"); dep.min = arr.value; }
    if (okDate.test(q.get("departure") || "") && q.get("departure") > arr.value) dep.value = q.get("departure");
    form.addEventListener("submit", function (e) {
      if (arr.value && dep.value && dep.value <= arr.value) {
        e.preventDefault();
        err.textContent = "Your leaving date needs to be after your arrival date.";
        err.hidden = false;
        dep.focus();
      } else {
        err.hidden = true;
      }
    });
  }

  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
