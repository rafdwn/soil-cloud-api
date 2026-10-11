(function () {
  "use strict";

  var API_URL = "/api/soil/latest";
  var REFRESH_MS = 30000;
  var ONLINE_WINDOW_MS = 2 * 60 * 1000;
  var CHART_POINTS = 40;

  var CARD_PARAMS = [
    { key: "nitrogen", decimals: 0 },
    { key: "phosphorus", decimals: 0 },
    { key: "potassium", decimals: 0 },
    { key: "ph", decimals: 1 },
    { key: "temperature", decimals: 1 },
    { key: "moisture", decimals: 1 },
    { key: "ec", decimals: 2 }
  ];

  var SERIES = [
    { field: "nitrogen", label: "Nitrogen (N)", color: "#2F7D4A" },
    { field: "phosphorus", label: "Phosphorus (P)", color: "#C77D0A" },
    { field: "potassium", label: "Potassium (K)", color: "#2A6F97" }
  ];

  var GRID_COLOR = "#E3E9E5";
  var TICK_COLOR = "#5E6B63";

  var els = {
    statusPill: document.getElementById("statusPill"),
    statusText: document.getElementById("statusText"),
    lastUpdate: document.getElementById("lastUpdate"),
    refreshBtn: document.getElementById("refreshBtn"),
    retryBtn: document.getElementById("retryBtn"),
    errorAlert: document.getElementById("errorAlert"),
    sensorCards: document.getElementById("sensorCards"),
    chartNote: document.getElementById("chartNote"),
    historyBody: document.getElementById("historyBody"),
    historyNote: document.getElementById("historyNote"),
    fertilityBox: document.getElementById("fertilityBox"),
    fertilityValue: document.getElementById("fertilityValue"),
    fertilityScale: document.getElementById("fertilityScale"),
    recText: document.getElementById("recText"),
    canvas: document.getElementById("nutrientChart")
  };

  var scaleItems = els.fertilityScale
    ? Array.prototype.slice.call(els.fertilityScale.querySelectorAll("li"))
    : [];

  var chart = null;
  var hasRendered = false;
  var isFetching = false;
  var prevValues = {};

  function parseTimestamp(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "number") {
      return new Date(value < 1e12 ? value * 1000 : value);
    }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatClock(date) {
    if (!date) {
      return "-";
    }
    return date.toLocaleTimeString("id-ID", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function formatDateTime(date) {
    if (!date) {
      return "-";
    }
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function formatStamp(date) {
    if (!date) {
      return "-";
    }
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function formatValue(value, decimals) {
    var number = Number(value);
    if (!isFinite(number)) {
      return "--";
    }
    return String(parseFloat(number.toFixed(decimals)));
  }

  function levelFromClassification(value) {
    var text = String(value || "").toLowerCase();
    if (text.indexOf("tinggi") !== -1 || text.indexOf("high") !== -1) {
      return "high";
    }
    if (text.indexOf("rendah") !== -1 || text.indexOf("low") !== -1) {
      return "low";
    }
    if (text.indexOf("sedang") !== -1 || text.indexOf("medium") !== -1) {
      return "mid";
    }
    return "idle";
  }

  function setError(visible) {
    els.errorAlert.hidden = !visible;
  }

  function setChartNote(message) {
    if (message) {
      els.chartNote.textContent = message;
      els.chartNote.hidden = false;
    } else {
      els.chartNote.hidden = true;
    }
  }

  function setCardValue(key, text) {
    var valueEl = document.getElementById("val-" + key);
    if (!valueEl) {
      return;
    }

    var previous = prevValues[key];
    valueEl.textContent = text;

    if (previous !== undefined && previous !== text && text !== "--") {
      valueEl.classList.remove("flash");
      void valueEl.offsetWidth;
      valueEl.classList.add("flash");
    }

    prevValues[key] = text;
  }

  function setScale(level) {
    scaleItems.forEach(function (item) {
      item.classList.toggle("is-active", item.dataset.level === level);
    });
  }

  function renderStatus(latest) {
    if (!latest) {
      els.statusPill.dataset.state = "idle";
      els.statusText.textContent = "Menunggu data";
      els.lastUpdate.textContent = "-";
      return;
    }

    var date = parseTimestamp(latest.timestamp);
    var age = date ? Date.now() - date.getTime() : Infinity;
    var online = age >= 0 && age <= ONLINE_WINDOW_MS;

    els.statusPill.dataset.state = online ? "online" : "offline";
    els.statusText.textContent = online ? "Online" : "Offline";
    els.lastUpdate.textContent = formatDateTime(date);
  }

  function renderCards(latest) {
    CARD_PARAMS.forEach(function (param) {
      var metaEl = document.getElementById("meta-" + param.key);
      if (!metaEl) {
        return;
      }

      if (!latest) {
        setCardValue(param.key, "--");
        metaEl.textContent = "Belum ada data pengukuran.";
        return;
      }

      setCardValue(param.key, formatValue(latest[param.key], param.decimals));
      metaEl.textContent = "Diperbarui " + formatClock(parseTimestamp(latest.timestamp));
    });

    var fertilityMeta = document.getElementById("meta-fertility");
    if (!fertilityMeta) {
      return;
    }

    if (!latest) {
      setCardValue("fertility", "--");
      var idleEl = document.getElementById("val-fertility");
      if (idleEl) {
        idleEl.dataset.level = "idle";
      }
      fertilityMeta.textContent = "Belum ada data pengukuran.";
      return;
    }

    var classification = latest.classification || "Tidak diketahui";
    setCardValue("fertility", classification);
    var fertilityEl = document.getElementById("val-fertility");
    if (fertilityEl) {
      fertilityEl.dataset.level = levelFromClassification(classification);
    }
    fertilityMeta.textContent = "Diperbarui " + formatClock(parseTimestamp(latest.timestamp));
  }

  function renderFertility(latest) {
    if (!latest) {
      els.fertilityBox.dataset.level = "idle";
      els.fertilityValue.textContent = "--";
      els.recText.textContent = "Menunggu data pengukuran.";
      setScale("idle");
      return;
    }

    var classification = latest.classification || "Tidak diketahui";
    var level = levelFromClassification(classification);

    els.fertilityBox.dataset.level = level;
    els.fertilityValue.textContent = classification;
    els.recText.textContent = latest.recommendation
      ? String(latest.recommendation)
      : "Belum ada rekomendasi dari perangkat.";
    setScale(level);
  }

  function renderChart(rows) {
    var points = rows.slice().reverse().slice(-CHART_POINTS);

    if (!points.length) {
      destroyChart();
      setChartNote("Belum ada data pengukuran.");
      return;
    }

    if (typeof window.Chart === "undefined") {
      setChartNote("Grafik tidak dapat dimuat. Chart.js tidak tersedia.");
      return;
    }

    setChartNote(null);

    var labels = points.map(function (row) {
      return formatClock(parseTimestamp(row.timestamp));
    });

    var datasets = SERIES.map(function (series) {
      return {
        label: series.label,
        data: points.map(function (row) {
          var number = Number(row[series.field]);
          return isFinite(number) ? number : null;
        }),
        borderColor: series.color,
        backgroundColor: series.color,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true
      };
    });

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets = datasets;
      chart.update();
      return;
    }

    chart = new window.Chart(els.canvas.getContext("2d"), {
      type: "line",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: TICK_COLOR,
              usePointStyle: true,
              pointStyle: "line",
              boxHeight: 2
            }
          },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: {
            title: { display: true, text: "Waktu", color: TICK_COLOR },
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
          },
          y: {
            title: { display: true, text: "Nilai", color: TICK_COLOR },
            grid: { color: GRID_COLOR },
            ticks: { color: TICK_COLOR },
            beginAtZero: true
          }
        }
      }
    });
  }

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  function renderHistory(rows) {
    els.historyBody.innerHTML = "";

    if (!rows.length) {
      els.historyNote.hidden = false;
      els.historyNote.textContent = "Belum terdapat riwayat pengukuran.";
      return;
    }

    els.historyNote.hidden = true;

    var fragment = document.createDocumentFragment();

    rows.forEach(function (row) {
      var tr = document.createElement("tr");

      var cells = [
        { text: formatStamp(parseTimestamp(row.timestamp)) },
        { text: formatValue(row.ph, 1) },
        { text: formatValue(row.temperature, 1) },
        { text: formatValue(row.moisture, 1) },
        { text: formatValue(row.nitrogen, 0) },
        { text: formatValue(row.phosphorus, 0) },
        { text: formatValue(row.potassium, 0) },
        { text: formatValue(row.ec, 2) }
      ];

      cells.forEach(function (cell) {
        var td = document.createElement("td");
        td.textContent = cell.text;
        tr.appendChild(td);
      });

      var classification = row.classification || "-";
      var levelTd = document.createElement("td");
      levelTd.textContent = classification;
      levelTd.dataset.level = levelFromClassification(classification);
      tr.appendChild(levelTd);

      fragment.appendChild(tr);
    });

    els.historyBody.appendChild(fragment);
  }

  function render(rows) {
    var latest = rows.length ? rows[0] : null;
    renderStatus(latest);
    renderCards(latest);
    renderFertility(latest);
    renderChart(rows);
    renderHistory(rows);
    hasRendered = true;
  }

  function setLoading(active) {
    els.refreshBtn.disabled = active;
    els.refreshBtn.classList.toggle("is-loading", active);
    els.sensorCards.classList.toggle("is-loading", active && !hasRendered);

    if (active && !hasRendered) {
      setChartNote("Memuat data...");
      els.historyNote.hidden = false;
      els.historyNote.textContent = "Memuat data...";
    }
  }

  function loadData() {
    if (isFetching) {
      return;
    }
    isFetching = true;
    setLoading(true);

    fetch(API_URL, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (payload) {
        if (!payload || payload.success !== true || !Array.isArray(payload.data)) {
          throw new Error("Format data tidak dikenal");
        }
        render(payload.data);
        setError(false);
      })
      .catch(function (error) {
        console.error("Gagal memuat data:", error);
        setError(true);
        if (!hasRendered) {
          setChartNote("Gagal memuat data.");
          els.historyNote.hidden = false;
          els.historyNote.textContent = "Gagal memuat data.";
        }
      })
      .finally(function () {
        isFetching = false;
        setLoading(false);
      });
  }

  function syncHeaderHeight() {
    var topbar = document.querySelector(".topbar");
    if (topbar) {
      document.documentElement.style.setProperty("--header-h", topbar.offsetHeight + "px");
    }
  }

  var spyIds = ["ringkasan", "monitoring", "riwayat"];
  var navLinks = {};

  Array.prototype.forEach.call(document.querySelectorAll(".tabs a"), function (link) {
    var id = link.getAttribute("href").slice(1);
    navLinks[id] = link;
  });

  function updateActive() {
    var topbar = document.querySelector(".topbar");
    var nav = document.querySelector(".tabs");
    var offset = (topbar ? topbar.offsetHeight : 0) + (nav ? nav.offsetHeight : 0) + 16;
    var currentId = spyIds[0];
    var atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

    if (atBottom) {
      currentId = spyIds[spyIds.length - 1];
    } else {
      spyIds.forEach(function (id) {
        var section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= offset) {
          currentId = id;
        }
      });
    }

    Object.keys(navLinks).forEach(function (id) {
      var active = id === currentId;
      navLinks[id].classList.toggle("is-active", active);
      if (active) {
        navLinks[id].setAttribute("aria-current", "true");
      } else {
        navLinks[id].removeAttribute("aria-current");
      }
    });
  }

  els.refreshBtn.addEventListener("click", loadData);
  els.retryBtn.addEventListener("click", loadData);

  window.addEventListener("scroll", updateActive, { passive: true });

  window.addEventListener("resize", function () {
    syncHeaderHeight();
    updateActive();
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      loadData();
    }
  });

  syncHeaderHeight();
  updateActive();
  loadData();
  setInterval(loadData, REFRESH_MS);
})();
