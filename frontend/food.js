(function () {
  'use strict';

  const API = window.API_BASE || '';
  let currentDate = todayStr();
  let weekChart = null;

  function todayStr() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  }

  function fmtDate(str) {
    const [y, m, d] = str.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    const today = todayStr();
    if (str === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (str === yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })) return 'Yesterday';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const dt = new Date(iso);
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function shiftDate(str, days) {
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  }

  function renderTotals(entries) {
    const cal = entries.reduce(function (s, e) { return s + (e.calories || 0); }, 0);
    const pro = entries.reduce(function (s, e) { return s + (e.protein || 0); }, 0);
    const carb = entries.reduce(function (s, e) { return s + (e.carbs || 0); }, 0);
    const fat = entries.reduce(function (s, e) { return s + (e.fat || 0); }, 0);
    document.getElementById('totalCalories').textContent = cal ? cal + ' kcal' : '—';
    document.getElementById('totalProtein').textContent = pro ? pro + 'g' : '—';
    document.getElementById('totalCarbs').textContent = carb ? carb + 'g' : '—';
    document.getElementById('totalFat').textContent = fat ? fat + 'g' : '—';
  }

  function renderMealCards(entries) {
    const container = document.getElementById('mealCards');
    if (!entries || entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><p>No entries for this day</p></div>';
      return;
    }

    entries.sort(function (a, b) {
      const order = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
      return (order[a.meal] || 0) - (order[b.meal] || 0);
    });

    container.innerHTML = entries.map(function (e) {
      return '<div class="meal-card">' +
        '<div class="meal-header">' +
        '<span class="meal-tag ' + (e.meal || 'snack') + '">' + (e.meal || 'snack') + '</span>' +
        '<span class="meal-time">' + fmtTime(e.timestamp) + '</span>' +
        '</div>' +
        '<div class="meal-description">' + escHtml(e.description || '') + '</div>' +
        '<div class="macro-pills">' +
        '<span class="pill cals">' + (e.calories || 0) + ' kcal</span>' +
        '<span class="pill protein">P ' + (e.protein || 0) + 'g</span>' +
        '<span class="pill carbs">C ' + (e.carbs || 0) + 'g</span>' +
        '<span class="pill fat">F ' + (e.fat || 0) + 'g</span>' +
        '</div>' +
        (e.notes ? '<div class="meal-notes">' + escHtml(e.notes) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function loadDay(date) {
    document.getElementById('currentDate').textContent = fmtDate(date);
    const container = document.getElementById('mealCards');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';

    fetch(API + '/entries?date=' + date)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderTotals(data.entries || []);
        renderMealCards(data.entries || []);
      })
      .catch(function () {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load entries</p></div>';
      });
  }

  function loadWeek() {
    fetch(API + '/summary?days=7')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        const summaries = (data.summaries || []).reverse();
        renderWeekChart(summaries);
        renderWeekDays(summaries);
      });
  }

  function renderWeekChart(summaries) {
    const labels = summaries.map(function (s) { return fmtDate(s.date); });
    const calories = summaries.map(function (s) { return s.totalCalories || 0; });

    if (weekChart) weekChart.destroy();
    const ctx = document.getElementById('weekChart').getContext('2d');
    weekChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Calories',
          data: calories,
          backgroundColor: 'rgba(108,99,255,0.7)',
          borderColor: '#6c63ff',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (c) { return c.parsed.y + ' kcal'; }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#888', font: { size: 11 } },
            grid: { color: '#2a2a2a' }
          },
          y: {
            ticks: { color: '#888', font: { size: 11 } },
            grid: { color: '#2a2a2a' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  function renderWeekDays(summaries) {
    const container = document.getElementById('weekDays');
    // summaries is oldest→newest after .reverse() in loadWeek; show newest first
    const rows = summaries.slice().reverse();
    container.innerHTML = rows.map(function (s) {
      const cal = s.totalCalories || 0;
      const pro = s.totalProtein || 0;
      const carb = s.totalCarbs || 0;
      const fat = s.totalFat || 0;
      const total = pro + carb + fat || 1;
      const pPct = Math.round(pro / total * 100);
      const cPct = Math.round(carb / total * 100);
      const fPct = 100 - pPct - cPct;
      const isToday = s.date === todayStr();
      return '<div class="week-day-row' + (isToday ? ' is-today' : '') + '" data-date="' + s.date + '">' +
        '<div class="week-day-left">' +
        '<div class="week-day-label">' + fmtDate(s.date) + (isToday ? ' <span class="today-badge">Today</span>' : '') + '</div>' +
        '<div class="week-day-sub">' + s.date + '</div>' +
        (cal > 0
          ? '<div class="macro-bar"><div class="macro-bar-p" style="width:' + pPct + '%"></div><div class="macro-bar-c" style="width:' + cPct + '%"></div><div class="macro-bar-f" style="width:' + fPct + '%"></div></div>'
          : '<div class="week-day-empty">No entries</div>') +
        (cal > 0 ? '<div class="week-day-macros">P ' + pro + 'g · C ' + carb + 'g · F ' + fat + 'g</div>' : '') +
        '</div>' +
        '<div class="week-day-right">' +
        (cal > 0 ? '<span class="week-day-cals">' + cal + '</span><span class="week-day-kcal">kcal</span>' : '<span class="week-day-zero">—</span>') +
        '<span class="week-day-arrow">›</span>' +
        '</div>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.week-day-row').forEach(function (row) {
      row.addEventListener('click', function () {
        currentDate = row.dataset.date;
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.add('hidden'); });
        document.querySelector('[data-tab="today"]').classList.add('active');
        document.getElementById('tab-today').classList.remove('hidden');
        loadDay(currentDate);
      });
    });
  }

  // Touch swipe support
  let touchStartX = 0;
  document.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 60) {
      const tab = document.querySelector('.tab-btn.active');
      if (tab && tab.dataset.tab === 'today') {
        currentDate = shiftDate(currentDate, dx < 0 ? 1 : -1);
        const today = todayStr();
        if (currentDate > today) currentDate = today;
        loadDay(currentDate);
      }
    }
  }, { passive: true });

  // Nav buttons
  document.getElementById('prevDay').addEventListener('click', function () {
    currentDate = shiftDate(currentDate, -1);
    loadDay(currentDate);
  });
  document.getElementById('nextDay').addEventListener('click', function () {
    const next = shiftDate(currentDate, 1);
    const today = todayStr();
    if (next <= today) { currentDate = next; loadDay(currentDate); }
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.add('hidden'); });
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('tab-' + tab).classList.remove('hidden');
      if (tab === 'week') loadWeek();
    });
  });

  // Init
  loadDay(currentDate);
})();
