// Render Cloud Production Backend URL
window.RENDER_BACKEND_URL = "https://ecocar-backend-otev.onrender.com";

// Smart Auto Detect API Base URL (Local vs Render Cloud Production)
let API_BASE_URL = "http://localhost:8081/api";
if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  API_BASE_URL = `${window.RENDER_BACKEND_URL.replace(/\/$/, '')}/api`;
}

let currentUser = null;
let facilitiesData = [];
let dispositionsData = [];
let usersData = [];
let currentSettings = { photo_dir_path: "" };

let categoryChart = null;
let statusChart = null;
let modalDonutChart = null;
let cardDonutChartsMap = {};

let facilityViewMode = "card"; // "card" or "table"
let currentFacilityDetail = null;
let currentFacilityPhotos = [];
let currentPhotoIndex = 0;

// Lightbox Zoom state
let lightboxZoom = 1;
let lightboxTranslateX = 0;
let lightboxTranslateY = 0;
let isDragging = false;
let startX, startY;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "print") {
    const printItemStr = localStorage.getItem("printItemData");
    if (printItemStr) {
      try {
        const printPayload = JSON.parse(printItemStr);
        renderPrintOnly(printPayload);
        return;
      } catch (e) {
        document.body.innerHTML = "<div style='color:#000; padding:20px;'>인쇄 데이터를 불러오지 못했습니다.</div>";
        return;
      }
    }
  }

  checkLoginSession();
  setupLightboxEvents();
});

// 1. Authentication Logic (Always Show Login Screen + Remember Username)
function checkLoginSession() {
  // 항상 로그인 화면 노출 (세션 자동 바이패스 해제)
  currentUser = null;
  localStorage.removeItem("currentUser");
  showLoginScreen();
}

function showLoginScreen() {
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen) {
    loginScreen.classList.add("active");
    loginScreen.style.display = "flex";
  }

  const uInput = document.getElementById("login-username");
  const pInput = document.getElementById("login-password");
  const errorMsg = document.getElementById("login-error");

  if (errorMsg) errorMsg.innerText = "";

  // 이전 저장된 아이디 복원 (기본값 ADMIN)
  const savedUsername = localStorage.getItem("savedUsername") || "ADMIN";
  if (uInput) {
    uInput.value = savedUsername;
  }

  // 비밀번호 입력칸 초기화 및 즉시 커서 포커스
  if (pInput) {
    pInput.value = "";
    setTimeout(() => pInput.focus(), 100);
  }
}

function showMainApp() {
  try {
    const loginScreen = document.getElementById("login-screen");
    if (loginScreen) {
      loginScreen.classList.remove("active");
      loginScreen.style.display = "none";
    }
    
    const userInfoText = document.getElementById("user-display-info");
    if (userInfoText && currentUser) {
      userInfoText.innerHTML = `<i class="fa-solid fa-user-check"></i> ${currentUser.name || '최고 관리자'} (${currentUser.username || 'ADMIN'})`;
    }
    
    const adminTab = document.getElementById("tab-users");
    if (adminTab) {
      adminTab.style.display = "flex";
    }

    loadData();
    fetchSettings();
  } catch (errShow) {
    console.error("Error in showMainApp:", errShow);
  }
}

async function executeLogin() {
  try {
    const uElem = document.getElementById("login-username");
    const pElem = document.getElementById("login-password");
    const errorMsg = document.getElementById("login-error");

    const uVal = uElem ? uElem.value.trim() : "";
    const pVal = pElem ? pElem.value.trim() : "";

    if (errorMsg) errorMsg.innerText = "";

    if (!uVal || !pVal) {
      if (errorMsg) errorMsg.innerText = "아이디와 비밀번호를 모두 입력해 주세요.";
      return;
    }

    // 아이디 저장 (다음 접속 시 자동 채우기용)
    localStorage.setItem("savedUsername", uVal);

    currentUser = {
      username: uVal.toUpperCase() || "ADMIN",
      name: "최고 관리자",
      role: "ADMIN"
    };

    const loginScreen = document.getElementById("login-screen");
    if (loginScreen) {
      loginScreen.classList.remove("active");
      loginScreen.style.display = "none";
    }

    showMainApp();
  } catch (err) {
    console.error("Error in executeLogin:", err);
    showLoginScreen();
  }
}

function handleLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  executeLogin();
}

function handleLogout() {
  if (confirm("로그아웃 하시겠습니까?")) {
    localStorage.removeItem("currentUser");
    currentUser = null;
    const uInput = document.getElementById("login-username");
    const pInput = document.getElementById("login-password");
    const errInput = document.getElementById("login-error");
    if (uInput) uInput.value = "";
    if (pInput) pInput.value = "";
    if (errInput) errInput.innerText = "";
    showLoginScreen();
  }
}

// 2. Data Loading & Settings
async function loadData() {
  // 1. Instant Render from Local Cache if available for 0.0001s response
  const cachedFac = localStorage.getItem("cached_facilities");
  const cachedDisp = localStorage.getItem("cached_dispositions");
  if (cachedFac && cachedDisp) {
    try {
      facilitiesData = JSON.parse(cachedFac);
      dispositionsData = JSON.parse(cachedDisp);
      populateFilterOptions();
      updateDashboardStats();
      filterFacilities();
      filterDispositions();
    } catch(e) {}
  }

  // 2. Fetch fresh data
  await Promise.all([fetchFacilities(), fetchDispositions()]);
  if (currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN")) {
    await fetchUsers();
  }
  populateFilterOptions();
  updateDashboardStats();
  renderCategoryChart();
  renderStatusChart();
  filterFacilities();
  filterDispositions();

  // Save fresh data to local cache
  try {
    localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData));
    localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData));
  } catch(e) {}
}

async function fetchSettings() {
  try {
    const res = await fetch(`${API_BASE_URL}/settings`);
    currentSettings = await res.json();
  } catch(e) {}
}

function openSettingsModal() {
  document.getElementById("setting-photo-dir").value = currentSettings.photo_dir_path || "";
  document.getElementById("modal-settings").classList.add("active");
}

async function saveSettings(event) {
  event.preventDefault();
  const photoDir = document.getElementById("setting-photo-dir").value.trim();
  try {
    const res = await fetch(`${API_BASE_URL}/settings/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_dir_path: photoDir })
    });
    const result = await res.json();
    if (result.success) {
      currentSettings = result.settings;
      alert("설정이 성공적으로 저장되었습니다.");
      closeModal("modal-settings");
    }
  } catch(e) {
    alert("설정 저장 실패");
  }
}

// 3. Tab Navigation & View Mode
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));

  if (tabName === 'dashboard') {
    document.querySelectorAll(".tab-btn")[0].classList.add("active");
    document.getElementById("view-dashboard").classList.add("active");
  } else if (tabName === 'facilities') {
    document.querySelectorAll(".tab-btn")[1].classList.add("active");
    document.getElementById("view-facilities").classList.add("active");
  } else if (tabName === 'dispositions') {
    document.querySelectorAll(".tab-btn")[2].classList.add("active");
    document.getElementById("view-dispositions").classList.add("active");
    filterDispositions();
  } else if (tabName === 'users') {
    document.getElementById("tab-users").classList.add("active");
    document.getElementById("view-users").classList.add("active");
    fetchUsers();
  }
}

function setFacilityViewMode(mode) {
  facilityViewMode = mode;
  document.getElementById("btn-view-card").classList.toggle("active", mode === "card");
  document.getElementById("btn-view-table").classList.toggle("active", mode === "table");

  document.getElementById("facilities-card-grid").style.display = mode === "card" ? "grid" : "none";
  document.getElementById("facilities-table-card").style.display = mode === "table" ? "block" : "none";
}

// 4. Fetch Data Functions
async function fetchFacilities() {
  try {
    const res = await fetch(`${API_BASE_URL}/facilities`);
    const raw = await res.json();
    facilitiesData = Array.isArray(raw) ? raw : (raw.data || []);
  } catch (err) {
    console.error("Error fetching facilities:", err);
  }
}

async function fetchDispositions() {
  try {
    const res = await fetch(`${API_BASE_URL}/dispositions`);
    const raw = await res.json();
    dispositionsData = Array.isArray(raw) ? raw : (raw.data || []);
  } catch (err) {
    console.error("Error fetching dispositions:", err);
  }
}

async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE_URL}/users`);
    const raw = await res.json();
    usersData = Array.isArray(raw) ? raw : (raw.data || []);
    renderUsersTable(usersData);
  } catch (err) {
    console.error("Error fetching users:", err);
  }
}

// 5. Populate Filter Options
function populateFilterOptions() {
  const categorySelect = document.getElementById("facility-filter-category");
  const dongSelect = document.getElementById("facility-filter-dong");

  const categories = new Set();
  const dongs = new Set();

  facilitiesData.forEach(f => {
    if (f.facility_category) categories.add(f.facility_category);
    if (f.dong_name) dongs.add(f.dong_name);
  });

  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">시설구분 전체</option>';
    Array.from(categories).sort().forEach(c => {
      categorySelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
  }

  if (dongSelect) {
    dongSelect.innerHTML = '<option value="">행정동 전체</option>';
    Array.from(dongs).sort().forEach(d => {
      dongSelect.innerHTML += `<option value="${d}">${d}</option>`;
    });
  }

  const dispStatusSelect = document.getElementById("disposition-filter-status");
  if (dispStatusSelect) {
    const currentSelected = dispStatusSelect.value;
    const statuses = new Set();
    let hasEmptyStatus = false;

    dispositionsData.forEach(d => {
      const statusStr = (d.current_status || "").trim();
      if (statusStr) {
        statuses.add(statusStr);
      } else {
        hasEmptyStatus = true;
      }
    });

    dispStatusSelect.innerHTML = '<option value="">현상태 전체</option>';

    // '현상태 미지정' 옵션 추가 (미지정 레코드 필터링용)
    if (hasEmptyStatus) {
      dispStatusSelect.innerHTML += `<option value="UNASSIGNED_STATUS">현상태 미지정</option>`;
    }

    Array.from(statuses).sort().forEach(s => {
      dispStatusSelect.innerHTML += `<option value="${s}">${s}</option>`;
    });

    if (currentSelected && Array.from(dispStatusSelect.options).some(opt => opt.value === currentSelected)) {
      dispStatusSelect.value = currentSelected;
    }
  }
}

// 6. Dashboard Progress & Stats
function updateDashboardStats() {
  const total = facilitiesData.length;
  const completed = facilitiesData.filter(f => f.compliance_status === '이행완료').length;
  const uninstalled = facilitiesData.filter(f => f.compliance_status === '미이행').length;

  const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
  document.getElementById("overall-prog-percent").innerText = `${pct}%`;
  document.getElementById("overall-prog-fill").style.width = `${pct}%`;

  let totalParkingUninstalled = 0;
  let totalChargerUninstalled = 0;

  facilitiesData.forEach(f => {
    totalParkingUninstalled += (f.parking_uninstalled_cnt || 0);
    totalChargerUninstalled += (f.charger_uninstalled_cnt || 0);
  });

  document.getElementById("stat-total-facilities").innerText = total.toLocaleString();
  document.getElementById("stat-completed-facilities").innerText = completed.toLocaleString();
  document.getElementById("stat-uninstalled-facilities").innerText = uninstalled.toLocaleString();
  document.getElementById("stat-uninstalled-counts").innerText = `${totalParkingUninstalled}면 / ${totalChargerUninstalled}기`;
}

// Custom inline plugin for displaying values permanently on Bar Chart
const alwaysShowBarLabelsPlugin = {
  id: 'alwaysShowBarLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, index) => {
        const val = dataset.data[index];
        if (val > 0) {
          ctx.save();
          ctx.fillStyle = dataset.backgroundColor || '#0F172A';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${val}건`, bar.x, bar.y - 2);
          ctx.restore();
        }
      });
    });
  }
};

// Custom inline plugin for displaying values cleanly on Donut Chart
const alwaysShowDoughnutLabelsPlugin = {
  id: 'alwaysShowDoughnutLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    const total = dataset.data.reduce((a, b) => a + b, 0);

    meta.data.forEach((element, index) => {
      const val = dataset.data[index];
      if (val > 0) {
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        const position = element.tooltipPosition();
        const text = `${val}건 (${pct}%)`;

        ctx.save();
        ctx.font = '600 11px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const paddingX = 8;
        const paddingY = 4;
        const bgWidth = textWidth + paddingX * 2;
        const bgHeight = 18;
        const rx = position.x - bgWidth / 2;
        const ry = position.y - bgHeight / 2;

        // Draw soft dark background pill box for maximum readability without stroke border
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(rx, ry, bgWidth, bgHeight, 9);
        } else {
          ctx.rect(rx, ry, bgWidth, bgHeight);
        }
        ctx.fill();

        // Draw clean white text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, position.x, position.y + 0.5);
        ctx.restore();
      }
    });
  }
};

function renderCategoryChart() {
  const ctx = document.getElementById("chart-category").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  const categoryMap = {};
  facilitiesData.forEach(f => {
    const cat = f.facility_category || "기타";
    if (!categoryMap[cat]) categoryMap[cat] = { completed: 0, uninstalled: 0 };
    if (f.compliance_status === '이행완료') categoryMap[cat].completed++;
    else if (f.compliance_status === '미이행') categoryMap[cat].uninstalled++;
  });

  const labels = Object.keys(categoryMap);
  const completedData = labels.map(l => categoryMap[l].completed);
  const uninstalledData = labels.map(l => categoryMap[l].uninstalled);

  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: '이행완료', data: completedData, backgroundColor: '#059669' },
        { label: '미이행', data: uninstalledData, backgroundColor: '#E11D48' }
      ]
    },
    plugins: [alwaysShowBarLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#0F172A', font: { weight: 'bold' } } } },
      scales: {
        x: { ticks: { color: '#64748B' }, grid: { color: '#E2E8F0' } },
        y: { ticks: { color: '#64748B' }, grid: { color: '#E2E8F0' }, grace: '10%' }
      }
    }
  });
}

function renderStatusChart() {
  const ctx = document.getElementById("chart-status").getContext("2d");
  if (statusChart) statusChart.destroy();

  const completed = facilitiesData.filter(f => f.compliance_status === '이행완료').length;
  const uninstalled = facilitiesData.filter(f => f.compliance_status === '미이행').length;
  const exempted = facilitiesData.filter(f => f.compliance_status === '면제').length;

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['이행완료', '미이행', '면제'],
      datasets: [{
        data: [completed, uninstalled, exempted],
        backgroundColor: ['#059669', '#E11D48', '#0284C7']
      }]
    },
    plugins: [alwaysShowDoughnutLabelsPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#0F172A', font: { weight: 'bold' } } } }
    }
  });
}

// 7. Search & Filter
function filterFacilities() {
  const queryElem = document.getElementById("facility-search");
  const query = queryElem ? queryElem.value.toLowerCase().trim() : "";
  const categoryFilter = document.getElementById("facility-filter-category") ? document.getElementById("facility-filter-category").value : "";
  const statusFilter = document.getElementById("facility-filter-status") ? document.getElementById("facility-filter-status").value : "";

  const filtered = facilitiesData.filter(f => {
    const matchQuery = (f.facility_name && f.facility_name.toLowerCase().includes(query)) ||
                       (f.facility_key && f.facility_key.toLowerCase().includes(query)) ||
                       (f.address_doro && f.address_doro.toLowerCase().includes(query)) ||
                       (f.address_jibun && f.address_jibun.toLowerCase().includes(query));
                       
    const matchCat = !categoryFilter || f.facility_category === categoryFilter;
    const matchStatus = !statusFilter || f.compliance_status === statusFilter;

    return matchQuery && matchCat && matchStatus;
  });

  document.getElementById("facility-result-count").innerText = `총 ${filtered.length}건 검색`;
  
  renderFacilitiesCards(filtered);
  renderFacilitiesTable(filtered);
}

function filterDispositions() {
  const queryElem = document.getElementById("disposition-search");
  const query = queryElem ? queryElem.value.toLowerCase().trim() : "";
  const statusFilter = document.getElementById("disposition-filter-status") ? document.getElementById("disposition-filter-status").value : "";
  const targetFilter = document.getElementById("disposition-filter-target") ? document.getElementById("disposition-filter-target").value : "";

  const filtered = dispositionsData.filter(d => {
    const fac = facilitiesData.find(f => f.facility_key === d.facility_key) || {};
    const facName = (fac.facility_name || "").toLowerCase();
    const key = (d.facility_key || "").toLowerCase();
    const status = (d.current_status || "").toLowerCase();
    const targetName = (d.target_name_decrypted || "").toLowerCase();

    const matchQuery = !query || key.includes(query) || status.includes(query) || targetName.includes(query) || facName.includes(query);
    const matchStatus = !statusFilter || 
      (statusFilter === "UNASSIGNED_STATUS" ? (!d.current_status || d.current_status.trim() === "" || d.current_status === "현상태 미지정" || d.current_status === "상태미지정") : (d.current_status === statusFilter));
    const matchTarget = !targetFilter || d.target_type === targetFilter;

    return matchQuery && matchStatus && matchTarget;
  });

  const countBadge = document.getElementById("disp-result-count");
  if (countBadge) countBadge.innerText = `총 ${filtered.length}건 검색`;

  renderDispositionsCards(filtered);
  renderDispositionsTable(filtered);
}

// 8. Render Card View with Dual Donut Charts (% Text & Slash Ratios)
function createSvgDonutHtml(pct, color) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  return `
    <svg width="72" height="72" viewBox="0 0 80 80" style="transform: rotate(-90deg); display:block;">
      <circle cx="40" cy="40" r="${radius}" stroke="#E2E8F0" stroke-width="8" fill="transparent" />
      <circle cx="40" cy="40" r="${radius}" stroke="${color}" stroke-width="8" fill="transparent"
              stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" />
    </svg>
  `;
}

function renderFacilitiesCards(data) {
  const container = document.getElementById("facilities-card-grid");
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:3rem;">검색 결과가 없습니다.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  data.forEach(f => {
    const card = document.createElement("div");
    card.className = "facility-card";
    
    let badgeClass = "badge-blue";
    let borderTopColor = "#0284C7";
    if (f.compliance_status === "이행완료") { badgeClass = "badge-emerald"; borderTopColor = "#10B981"; }
    else if (f.compliance_status === "미이행") { badgeClass = "badge-rose"; borderTopColor = "#F43F5E"; }
    else if (f.compliance_status === "면제") { badgeClass = "badge-amber"; borderTopColor = "#F59E0B"; }

    card.style.background = "#FFFFFF";
    card.style.border = "1px solid #E2E8F0";
    card.style.borderTop = `4px solid ${borderTopColor}`;

    const reqP = parseInt(f.parking_required_cnt) || 0;
    const unP = parseInt(f.parking_uninstalled_cnt) || 0;
    let actP = f.parking_installed_cnt !== undefined && f.parking_installed_cnt !== null && f.parking_installed_cnt !== '' ? parseInt(f.parking_installed_cnt) : Math.max(0, reqP - unP);
    if (f.compliance_status === '이행완료' && actP === 0 && reqP > 0) actP = reqP;
    const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : (f.compliance_status === '이행완료' ? 100 : 0);

    const reqC = parseInt(f.charger_required_cnt) || 0;
    const unC = parseInt(f.charger_uninstalled_cnt) || 0;
    let actC = f.charger_installed_cnt !== undefined && f.charger_installed_cnt !== null && f.charger_installed_cnt !== '' ? parseInt(f.charger_installed_cnt) : Math.max(0, reqC - unC);
    if (f.compliance_status === '이행완료' && actC === 0 && reqC > 0) actC = reqC;
    const pctC = reqC > 0 ? Math.min(100, Math.round((actC / reqC) * 100)) : (f.compliance_status === '이행완료' ? 100 : 0);

    const reqFast = parseInt(f.charger_fast_req_cnt) || 0;
    const actFast = parseInt(f.charger_fast_cnt) || 0;
    const fastDiff = Math.max(0, reqFast - actFast);
    const isFastNonCompliant = fastDiff > 0;

    const colorP = pctP === 100 ? '#059669' : '#E11D48';
    const colorC = pctC === 100 ? '#059669' : '#E11D48';

    card.innerHTML = `
      <div>
        <div class="facility-card-header">
          <span class="facility-card-key">${f.facility_key}</span>
          <div style="display:flex; gap:0.3rem; align-items:center;">
            ${isFastNonCompliant ? `<span class="badge badge-rose" style="font-size:0.7rem; padding:0.2rem 0.4rem;"><i class="fa-solid fa-triangle-exclamation"></i> 급속미이행 ${fastDiff}기</span>` : ''}
            <span class="badge ${badgeClass}">${f.compliance_status || '-'}</span>
          </div>
        </div>
        <div class="facility-card-title">${f.facility_name}</div>
        <div class="facility-card-category">${f.facility_category || '구분 미지정'} | ${f.dong_name || '-'}</div>
        <div class="facility-card-address"><i class="fa-solid fa-location-dot"></i> ${f.address_doro || f.address_jibun || '-'}</div>
        
        <!-- Dual Donut Chart Wrapper -->
        <div class="card-chart-wrapper-dual">
          <!-- Parking Donut -->
          <div class="donut-box-item">
            <div class="donut-title-label"><i class="fa-solid fa-square-parking"></i> 주차면수</div>
            <div class="donut-chart-relative">
              ${createSvgDonutHtml(pctP, colorP)}
              <div class="donut-center-pct" style="color:${colorP}; font-size:0.82rem; font-weight:700;">${pctP}%</div>
            </div>
            <div class="donut-ratio-slash">
              <span style="font-weight:700; color:${actP >= reqP ? '#059669' : '#E11D48'};">${actP}면</span> / ${reqP}면
            </div>
          </div>

          <!-- Charger Donut -->
          <div class="donut-box-item">
            <div class="donut-title-label"><i class="fa-solid fa-bolt"></i> 충전기수</div>
            <div class="donut-chart-relative">
              ${createSvgDonutHtml(pctC, colorC)}
              <div class="donut-center-pct" style="color:${colorC}; font-size:0.82rem; font-weight:700;">${pctC}%</div>
            </div>
            <div class="donut-ratio-slash">
              <span style="font-weight:700; color:${actC >= reqC ? '#059669' : '#E11D48'};">${actC}기</span> / ${reqC}기
            </div>
            ${isFastNonCompliant ? `<div style="font-size:0.75rem; font-weight:800; color:#E11D48; margin-top:0.3rem;"><i class="fa-solid fa-triangle-exclamation"></i> 의무급속미이행 ${fastDiff}기</div>` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; align-items:center; border-top:1px solid #E2E8F0; padding-top:0.8rem; margin-top:0.4rem;">
        <button class="btn btn-secondary" style="padding:0.3rem 0.7rem; font-size:0.75rem;" onclick="event.stopPropagation(); openFacilityDetailModal('${f.facility_key}')">
          <i class="fa-solid fa-circle-info"></i> 상세 팝업
        </button>
      </div>
    `;

    card.onclick = () => openFacilityDetailModal(f.facility_key);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

function renderFacilitiesTable(data) {
  // Table view removed per requirement (Card view is default & only view)
}

// 9. Instant Opening Facility Detail Modal & Donut Chart & Async Photos
function openFacilityDetailModal(key) {
  const facility = facilitiesData.find(f => f.facility_key === key);
  if (!facility) return;

  currentFacilityDetail = facility;

  // 1. Populate Text Information Instantly (Safe Null Check)
  const safeSetText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = (val !== undefined && val !== null && val !== '') ? val : '-';
  };

  safeSetText("detail-key", facility.facility_key);
  safeSetText("detail-key-badge", facility.facility_key);
  safeSetText("detail-facility-name", facility.facility_name);
  safeSetText("detail-category", facility.facility_category);
  safeSetText("detail-address-doro", facility.address_doro);
  safeSetText("detail-address-jibun", facility.address_jibun);
  safeSetText("detail-dates", `${facility.permission_date || '-'} / ${facility.approval_date || '-'}`);
  safeSetText("detail-new-old", facility.is_new_building);
  safeSetText("detail-ownership", facility.facility_ownership_type);

  const compElem = document.getElementById("detail-compliance");
  if (compElem) {
    compElem.innerText = facility.compliance_status || '-';
    compElem.className = `badge ${facility.compliance_status === '이행완료' ? 'badge-emerald' : (facility.compliance_status === '미이행' ? 'badge-rose' : 'badge-amber')}`;
  }

  // Parking & Charger Slash Ratio Info
  const reqP = parseInt(facility.parking_required_cnt) || 0;
  const unP = parseInt(facility.parking_uninstalled_cnt) || 0;
  let actP = facility.parking_installed_cnt !== undefined && facility.parking_installed_cnt !== null && facility.parking_installed_cnt !== '' ? parseInt(facility.parking_installed_cnt) : Math.max(0, reqP - unP);
  if (facility.compliance_status === '이행완료' && actP === 0 && reqP > 0) actP = reqP;
  const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : (facility.compliance_status === '이행완료' ? 100 : 0);

  const reqC = parseInt(facility.charger_required_cnt) || 0;
  const unC = parseInt(facility.charger_uninstalled_cnt) || 0;
  let actC = facility.charger_installed_cnt !== undefined && facility.charger_installed_cnt !== null && facility.charger_installed_cnt !== '' ? parseInt(facility.charger_installed_cnt) : Math.max(0, reqC - unC);
  if (facility.compliance_status === '이행완료' && actC === 0 && reqC > 0) actC = reqC;
  const pctC = reqC > 0 ? Math.min(100, Math.round((actC / reqC) * 100)) : (facility.compliance_status === '이행완료' ? 100 : 0);

  const parkSlashElem = document.getElementById("detail-parking-slash-info");
  if (parkSlashElem) parkSlashElem.innerText = `${actP}면 / ${reqP}면 (설치/의무)`;
  
  const parkUnElem = document.getElementById("detail-parking-uninstalled");
  if (parkUnElem) parkUnElem.innerText = facility.parking_uninstalled_cnt || 0;

  const chargerSlashElem = document.getElementById("detail-charger-slash-info");
  if (chargerSlashElem) chargerSlashElem.innerText = `${actC}기 / ${reqC}기 (설치/의무)`;

  const chargerUnElem = document.getElementById("detail-charger-uninstalled");
  if (chargerUnElem) chargerUnElem.innerText = facility.charger_uninstalled_cnt || 0;

  // Fast Charger Uninstalled Count (Exact Formula: reqFast - actFast)
  const reqFast = parseInt(facility.charger_fast_req_cnt) || 0;
  const actFast = parseInt(facility.charger_fast_cnt) || 0;
  const uninstalledFast = Math.max(0, reqFast - actFast);
  const fastUnElem = document.getElementById("detail-fast-uninstalled");
  if (fastUnElem) {
    fastUnElem.innerText = `${uninstalledFast}기`;
    fastUnElem.style.color = uninstalledFast > 0 ? 'var(--danger)' : 'var(--text-main)';
  }

  const decName = (facility.manager_name_decrypted && !facility.manager_name_decrypted.startsWith("gAAAAA")) ? facility.manager_name_decrypted : (facility.manager_name || '-');
  const decContact = (facility.manager_contact_decrypted && !facility.manager_contact_decrypted.startsWith("gAAAAA")) ? facility.manager_contact_decrypted : (facility.manager_contact || '-');

  safeSetText("detail-manager-name", decName);
  safeSetText("detail-manager-contact", decContact);
  safeSetText("detail-management-body", facility.management_body);
  
  const invElem = document.getElementById("detail-investigation-status");
  if (invElem) invElem.innerText = facility.investigation_status || '-';

  const delFacBtn = document.getElementById("btn-delete-facility");
  if (delFacBtn) {
    const isAdmin = currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN");
    delFacBtn.style.display = isAdmin ? "inline-flex" : "none";
  }

  document.getElementById("btn-edit-from-detail").onclick = () => {
    closeModal("modal-facility-detail");
    openFacilityModal(key);
  };

  // 2. Open Modal Pop-up Instantly (All-in-One 3-column Layout)
  const detailModalElem = document.getElementById("modal-facility-detail");
  if (detailModalElem) {
    detailModalElem.style.display = "flex";
    detailModalElem.classList.add("active");
  }
  renderModalDetailDonutChart(facility);

  // 3. Load Photos Non-blocking in Background
  loadFacilityPhotos(facility.facility_key, facility.facility_name);
}

function switchDetailTab(tabName) {
  document.querySelectorAll(".detail-tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".detail-section").forEach(sec => sec.classList.remove("active"));

  if (tabName === 'info') {
    document.querySelectorAll(".detail-tab-btn")[0].classList.add("active");
    document.getElementById("detail-tab-info").classList.add("active");
  } else if (tabName === 'compliance') {
    document.querySelectorAll(".detail-tab-btn")[1].classList.add("active");
    document.getElementById("detail-tab-compliance").classList.add("active");
  } else if (tabName === 'photos') {
    document.querySelectorAll(".detail-tab-btn")[2].classList.add("active");
    document.getElementById("detail-tab-photos").classList.add("active");
  }
}

let modalDetailChartsMap = {};

function renderModalDetailDonutChart(f) {
  Object.values(modalDetailChartsMap).forEach(c => {
    try { c.destroy(); } catch (e) {}
  });
  modalDetailChartsMap = {};

  const reqP = parseInt(f.parking_required_cnt) || 0;
  const actP = parseInt(f.parking_installed_cnt) || 0;
  const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : 100;

  const reqC = parseInt(f.charger_required_cnt) || 0;
  const actC = parseInt(f.charger_installed_cnt) || 0;
  const pctC = reqC > 0 ? Math.min(100, Math.round((actC / reqC) * 100)) : 100;

  const pctPElem = document.getElementById("modal-detail-pct-p");
  if (pctPElem) {
    pctPElem.innerText = `${pctP}%`;
    pctPElem.style.color = pctP === 100 ? '#059669' : '#E11D48';
  }

  const slashPElem = document.getElementById("modal-detail-slash-p");
  if (slashPElem) {
    slashPElem.innerHTML = `<span style="font-weight:700; color:${actP >= reqP ? '#059669' : '#E11D48'};">${actP}면 / ${reqP}면</span> (설치/의무)`;
  }

  const pctCElem = document.getElementById("modal-detail-pct-c");
  if (pctCElem) {
    pctCElem.innerText = `${pctC}%`;
    pctCElem.style.color = pctC === 100 ? '#059669' : '#E11D48';
  }

  const slashCElem = document.getElementById("modal-detail-slash-c");
  if (slashCElem) {
    slashCElem.innerHTML = `<span style="font-weight:700; color:${actC >= reqC ? '#059669' : '#E11D48'};">${actC}기 / ${reqC}기</span> (설치/의무)`;
  }

  setTimeout(() => {
    try {
      const ctxP = document.getElementById("modal-detail-donut-p");
      if (ctxP) {
        const isOkP = pctP === 100;
        modalDetailChartsMap['p'] = new Chart(ctxP.getContext('2d'), {
          type: 'doughnut',
          data: {
            datasets: [{
              data: isOkP ? [100, 0] : [actP, Math.max(0, reqP - actP)],
              backgroundColor: isOkP ? ['#059669', '#E2E8F0'] : ['#0284C7', '#E11D48'],
              borderWidth: 0
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
        });
      }
      const ctxC = document.getElementById("modal-detail-donut-c");
      if (ctxC) {
        const isOkC = pctC === 100;
        modalDetailChartsMap['c'] = new Chart(ctxC.getContext('2d'), {
          type: 'doughnut',
          data: {
            datasets: [{
              data: isOkC ? [100, 0] : [actC, Math.max(0, reqC - actC)],
              backgroundColor: isOkC ? ['#059669', '#E2E8F0'] : ['#0284C7', '#E11D48'],
              borderWidth: 0
            }]
          },
          options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
        });
      }
    } catch (e) {}
  }, 10);
}

// 10. Photos Carousel Slider & Lightbox Navigation Controls
async function loadFacilityPhotos(key, name) {
  const mainImg = document.getElementById("current-photo-img");
  const noPhotoMsg = document.getElementById("no-photo-msg");
  const badge = document.getElementById("photo-counter-badge");

  if (badge) badge.innerText = "0 / 0";
  currentFacilityPhotos = [];
  currentPhotoIndex = 0;
  
  if (mainImg) {
    mainImg.removeAttribute("src");
    mainImg.style.display = "none";
  }

  // Show Loading Spinner while fetching API (0.001s)
  if (noPhotoMsg) {
    noPhotoMsg.style.display = "block";
    noPhotoMsg.innerHTML = `
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem; margin-bottom:0.6rem; color:#0284C7; display:block;"></i>
      <span style="font-size:0.9rem; color:#94A3B8;">현장 사진 목록을 확인하는 중입니다...</span>
    `;
  }

  try {
    const cleanKey = (key || '').trim();
    const cleanName = (name || '').trim();
    const res = await fetch(`${API_BASE_URL}/photos?key=${encodeURIComponent(cleanKey)}&name=${encodeURIComponent(cleanName)}`);
    const data = await res.json();
    
    // Only update if key matches current detail modal
    if (currentFacilityDetail && currentFacilityDetail.facility_key === key) {
      let fetchedPhotos = data.photos || [];
      
      // Smart Fallback for real photos if backend returns empty list
      if (fetchedPhotos.length === 0 && cleanKey) {
        const cloudBase = API_BASE_URL.replace(/\/api$/, '');
        fetchedPhotos = [
          { filename: `${cleanKey}_01.jpg`, thumb_url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_01.jpg&thumb=1`, url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_01.jpg` },
          { filename: `${cleanKey}_02.jpg`, thumb_url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_02.jpg&thumb=1`, url: `${cloudBase}/api/photo_file?path=사진/${cleanKey}_02.jpg` }
        ];
      }

      currentFacilityPhotos = fetchedPhotos;
      currentPhotoIndex = 0;

      if (currentFacilityPhotos.length > 0) {
        setTimeout(() => {
          updatePhotoSliderDisplay();
        }, 0);
      } else {
        if (noPhotoMsg) {
          noPhotoMsg.style.display = "block";
          noPhotoMsg.innerHTML = `
            <i class="fa-regular fa-image" style="font-size:3rem; margin-bottom:0.6rem; color:#64748B; display:block;"></i>
            <span style="font-size:0.95rem; font-weight:600; color:#94A3B8;">지정된 폴더에 시설 관련 사진이 없습니다.</span>
          `;
        }
        if (mainImg) {
          mainImg.removeAttribute("src");
          mainImg.style.display = "none";
        }
      }
    }
  } catch (err) {
    console.error("Error loading photos:", err);
    if (noPhotoMsg) {
      noPhotoMsg.style.display = "block";
      noPhotoMsg.innerHTML = `
        <i class="fa-regular fa-image" style="font-size:3rem; margin-bottom:0.6rem; color:#64748B; display:block;"></i>
        <span style="font-size:0.95rem; font-weight:600; color:#94A3B8;">지정된 폴더에 시설 관련 사진이 없습니다.</span>
      `;
    }
    if (mainImg) {
      mainImg.removeAttribute("src");
      mainImg.style.display = "none";
    }
  }
}

function updatePhotoSliderDisplay() {
  const mainImg = document.getElementById("current-photo-img");
  const noPhotoMsg = document.getElementById("no-photo-msg");
  const badge = document.getElementById("photo-counter-badge");
  const btnDelete = document.getElementById("btn-delete-photo");

  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) {
    if (mainImg) {
      mainImg.removeAttribute("src");
      mainImg.style.display = "none";
    }
    if (noPhotoMsg) {
      noPhotoMsg.style.display = "block";
      noPhotoMsg.innerHTML = `
        <i class="fa-regular fa-image" style="font-size:3rem; margin-bottom:0.6rem; color:#64748B; display:block;"></i>
        <span style="font-size:0.95rem; font-weight:600; color:#94A3B8;">지정된 폴더에 시설 관련 사진이 없습니다.</span>
      `;
    }
    if (badge) badge.innerText = "0 / 0";
    if (btnDelete) btnDelete.style.display = "none";
    return;
  }

  // Use 20KB ultra-fast thumbnail for slide view with smart Cloud Production URL fix
  const photo = currentFacilityPhotos[currentPhotoIndex];
  let targetUrl = photo.thumb_url || photo.url || "";

  if (targetUrl.includes("localhost:8081")) {
    const cloudBase = API_BASE_URL.replace(/\/api$/, '');
    targetUrl = targetUrl.replace(/http:\/\/localhost:8081/g, cloudBase);
  }

  if (mainImg) {
    mainImg.onerror = function() {
      this.style.display = "none";
      if (noPhotoMsg) {
        noPhotoMsg.style.display = "block";
        noPhotoMsg.innerHTML = `
          <i class="fa-regular fa-image" style="font-size:2.5rem; margin-bottom:0.4rem; color:#64748B; display:block;"></i>
          <span style="font-size:0.9rem; font-weight:600; color:#94A3B8;">지정된 폴더에 시설 관련 사진이 없습니다.</span>
        `;
      }
    };
    mainImg.src = targetUrl;
    mainImg.style.display = "block";
    mainImg.style.visibility = "visible";
    mainImg.style.opacity = "1";
    if (noPhotoMsg) noPhotoMsg.style.display = "none";
  }

  if (badge) {
    badge.innerText = `${currentPhotoIndex + 1} / ${currentFacilityPhotos.length}`;
  }

  if (btnDelete) {
    btnDelete.style.display = "inline-flex";
  }
}

async function handlePhotoUploadSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!currentFacilityDetail || !currentFacilityDetail.facility_key) {
    alert("선택된 시설이 없습니다.");
    return;
  }

  const facilityKey = currentFacilityDetail.facility_key;
  const fileName = `${facilityKey}_${Date.now()}.${file.name.split('.').pop()}`;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const base64Data = e.target.result;
    try {
      const res = await fetch(`${API_BASE_URL}/photos/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_key: facilityKey,
          filename: fileName,
          file_data: base64Data
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Supabase Storage 클라우드에 사진이 성공적으로 업로드되었습니다.");
        loadFacilityPhotos(facilityKey, currentFacilityDetail.facility_name);
      } else {
        alert("업로드 실패: " + (data.message || "오류가 발생했습니다."));
      }
    } catch (err) {
      console.error(err);
      alert("사진 업로드 중 네트워크 오류가 발생했습니다.");
    }
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

async function deleteCurrentFacilityPhoto() {
  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) return;
  const currentPhoto = currentFacilityPhotos[currentPhotoIndex];
  if (!currentPhoto || !currentPhoto.filename) return;

  if (!confirm(`정말 사진 (${currentPhoto.filename})을 Supabase Storage 클라우드에서 삭제하시겠습니까?`)) return;

  const facilityKey = currentFacilityDetail ? currentFacilityDetail.facility_key : "";
  try {
    const res = await fetch(`${API_BASE_URL}/photos/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facility_key: facilityKey,
        filename: currentPhoto.filename
      })
    });
    const data = await res.json();
    if (data.success) {
      alert("사진이 삭제되었습니다.");
      loadFacilityPhotos(facilityKey, currentFacilityDetail ? currentFacilityDetail.facility_name : "");
    } else {
      alert("삭제 실패: " + (data.message || "오류가 발생했습니다."));
    }
  } catch (err) {
    console.error(err);
    alert("사진 삭제 중 오류가 발생했습니다.");
  }
}

function prevFacilityPhoto() {
  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + currentFacilityPhotos.length) % currentFacilityPhotos.length;
  updatePhotoSliderDisplay();
}

function nextFacilityPhoto() {
  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % currentFacilityPhotos.length;
  updatePhotoSliderDisplay();
}

function prevLightboxPhoto() {
  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + currentFacilityPhotos.length) % currentFacilityPhotos.length;
  updatePhotoSliderDisplay();
  const lbImg = document.getElementById("lightboxImage");
  if (lbImg) lbImg.src = currentFacilityPhotos[currentPhotoIndex].url;
  resetLightbox();
}

function nextLightboxPhoto() {
  if (!currentFacilityPhotos || currentFacilityPhotos.length === 0) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % currentFacilityPhotos.length;
  updatePhotoSliderDisplay();
  const lbImg = document.getElementById("lightboxImage");
  if (lbImg) lbImg.src = currentFacilityPhotos[currentPhotoIndex].url;
  resetLightbox();
}

function openLightboxCurrent() {
  if (currentFacilityPhotos.length === 0) return;
  const lbImg = document.getElementById("lightboxImage");
  lbImg.src = currentFacilityPhotos[currentPhotoIndex].url;
  resetLightbox();
  document.getElementById("lightboxOverlay").classList.add("active");
}

function zoomLightbox(delta) {
  lightboxZoom += delta;
  if (lightboxZoom < 0.5) lightboxZoom = 0.5;
  if (lightboxZoom > 5) lightboxZoom = 5;
  updateLightboxTransform();
}

function resetLightbox() {
  lightboxZoom = 1;
  lightboxTranslateX = 0;
  lightboxTranslateY = 0;
  updateLightboxTransform();
}

function updateLightboxTransform() {
  const lbImg = document.getElementById("lightboxImage");
  if (lbImg) {
    lbImg.style.transform = `translate(${lightboxTranslateX}px, ${lightboxTranslateY}px) scale(${lightboxZoom})`;
  }
}

function closeLightbox() {
  document.getElementById("lightboxOverlay").classList.remove("active");
}

function setupLightboxEvents() {
  const overlay = document.getElementById("lightboxOverlay");
  const lbImg = document.getElementById("lightboxImage");

  if (!overlay || !lbImg) return;

  window.addEventListener("keydown", (e) => {
    if (overlay.classList.contains("active")) {
      if (e.key === "ArrowLeft") prevLightboxPhoto();
      if (e.key === "ArrowRight") nextLightboxPhoto();
      if (e.key === "Escape") closeLightbox();
    } else {
      const detailModal = document.getElementById("modal-facility-detail");
      if (detailModal && detailModal.classList.contains("active")) {
        if (e.key === "ArrowLeft") prevFacilityPhoto();
        if (e.key === "ArrowRight") nextFacilityPhoto();
      }
    }
  });

  overlay.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (e.deltaY < 0) zoomLightbox(0.15);
    else zoomLightbox(-0.15);
  });

  lbImg.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX - lightboxTranslateX;
    startY = e.clientY - lightboxTranslateY;
    lbImg.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    lightboxTranslateX = e.clientX - startX;
    lightboxTranslateY = e.clientY - startY;
    updateLightboxTransform();
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
    if (lbImg) lbImg.style.cursor = "grab";
  });
}

// 11. Exact ECO-CAR Report Print Logic (Window Print Engine with Image Ready Listener)
function printReportCurrent() {
  if (!currentFacilityDetail) return;
  const f = currentFacilityDetail;
  const photos = currentFacilityPhotos.map(p => p.url);

  const printPayload = {
    facility: f,
    photos: photos,
    dispositions: dispositionsData.filter(d => d.facility_key === f.facility_key)
  };

  localStorage.setItem("printItemData", JSON.stringify(printPayload));
  const url = window.location.href.split('?')[0] + '?mode=print';
  window.open(url, '_blank', 'noopener,noreferrer');
}

// Render Only for Print Window Mode
function renderPrintOnly(payload) {
  const f = payload.facility || {};
  const photos = payload.photos || [];
  const disps = payload.dispositions || [];

  const reqPark = parseInt(f.parking_required_cnt) || 0;
  const unPark = parseInt(f.parking_uninstalled_cnt) || 0;
  const actPark = Math.max(0, reqPark - unPark);

  const reqCharge = parseInt(f.charger_required_cnt) || 0;
  const unCharge = parseInt(f.charger_uninstalled_cnt) || 0;
  const actCharge = Math.max(0, reqCharge - unCharge);

  let dispRowsHtml = "";
  if (disps.length > 0) {
    disps.forEach((d, idx) => {
      dispRowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td>${d.target_type || '시설'}</td>
          <td>${d.current_status || '-'}</td>
          <td>${d.target_name_decrypted || d.target_name_encrypted || '-'}</td>
          <td>${d.advance_notice_date || '-'}</td>
          <td>${d.opinion_submitted === 'O' ? '제출' : '미제출'}</td>
          <td>${d.correction_order_date || '-'}</td>
        </tr>
      `;
    });
  } else {
    dispRowsHtml = `<tr><td colspan="7" style="text-align:center; color:#666;">등록된 행정처분 및 시정명령 이력이 없습니다.</td></tr>`;
  }

  let photosHtml = "";
  const printPhotos = photos.slice(0, 8);
  if (printPhotos.length > 0) {
    photosHtml = `<div class="print-section-title">현장 실태조사 사진 목록 (총 ${printPhotos.length}장)</div><div class="print-photos">`;
    printPhotos.forEach(url => {
      photosHtml += `<div class="photo-item-print"><img src="${url}" onload="window.imgLoadCount = (window.imgLoadCount||0)+1;" /></div>`;
    });
    photosHtml += `</div>`;
  }

  const totalImgs = printPhotos.length;

  const htmlContent = `
    <div class="print-wrapper">
      <div class="print-header">환경친화적 자동차 전용구역 및 충전시설 현장조사 리포트</div>
      
      <div class="print-section-title">1. 기본 시설 정보</div>
      <table class="print-table">
        <colgroup><col style="width: 18%;"><col style="width: 32%;"><col style="width: 18%;"><col style="width: 32%;"></colgroup>
        <tr><th>시설명</th><td><strong>${f.facility_name || ''}</strong></td><th>행정동</th><td>${f.dong_name || ''}</td></tr>
        <tr><th>시설구분</th><td>${f.facility_category || ''}</td><th>신축/기축</th><td>${f.is_new_building || '-'}</td></tr>
        <tr><th>소재지 주소</th><td colspan="3">${f.address_doro || '-'} ${f.address_jibun ? `<span style="color:#64748B; font-weight:normal; margin-left:0.5rem;">(지번: ${f.address_jibun})</span>` : ''}</td></tr>
        <tr><th>건축허가일</th><td>${f.permission_date || '-'}</td><th>사용승인일</th><td>${f.approval_date || '-'}</td></tr>
        <tr><th>공공시설 구분</th><td colspan="3">${f.facility_ownership_type || '-'}</td></tr>
      </table>

      <div class="print-section-title">2. 의무설치 및 미설치 현황</div>
      <table class="print-table">
        <colgroup><col style="width: 20%;"><col style="width: 80%;"></colgroup>
        <tr><th>이행여부 상태</th><td><strong style="color:${f.compliance_status === '이행완료' ? '#059669' : '#dc2626'};">${f.compliance_status || '-'}</strong></td></tr>
        <tr><th>주차구역 현황</th><td>의무 설치: ${reqPark}면 | 현재 설치: ${actPark}면 | <strong>미설치: ${unPark}면</strong></td></tr>
        <tr><th>충전시설 현황</th><td>의무 설치: ${reqCharge}기 | 현재 설치: ${actCharge}기 | <strong>미설치: ${unCharge}기</strong></td></tr>
      </table>

      <div class="print-section-title">3. 관리 및 담당자 정보</div>
      <table class="print-table">
        <colgroup><col style="width: 20%;"><col style="width: 30%;"><col style="width: 20%;"><col style="width: 30%;"></colgroup>
        <tr><th>관리주체</th><td>${f.management_body || '-'}</td><th>시설 관리자</th><td>${f.manager_name_decrypted || '보안'}</td></tr>
        <tr><th>관리자 연락처</th><td>${f.manager_contact_decrypted || '보안'}</td><th>실태조사 상태</th><td>${f.investigation_status || '-'}</td></tr>
      </table>

      <div class="print-section-title">4. 행정처분 및 시정명령 이력</div>
      <table class="print-table">
        <colgroup>
          <col style="width: 8%;">
          <col style="width: 12%;">
          <col style="width: 15%;">
          <col style="width: 20%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
        </colgroup>
        <thead>
          <tr>
            <th>순번</th>
            <th>구분</th>
            <th>현상태</th>
            <th>대상자/소유자명</th>
            <th>사전통지일</th>
            <th>의견제출</th>
            <th>시정명령일</th>
          </tr>
        </thead>
        <tbody>
          ${dispRowsHtml}
        </tbody>
      </table>

      ${photosHtml}

      <div style="margin-top:25px; text-align:right; font-size:11px; color:#444;">
        발행일자: ${new Date().toLocaleDateString()} | 친환경자동차 전용주차구역 통합 관리 시스템
      </div>
    </div>
  `;

  const printCss = `
    body { font-family: 'Pretendard', sans-serif; background: #f0f0f0; color: #000; margin: 0; padding: 20px; line-height: 90%; }
    .print-wrapper { background: #fff; max-width: 800px; margin: 0 auto; padding: 30px; box-shadow: 0 0 15px rgba(0,0,0,0.1); box-sizing: border-box; }
    .print-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; box-sizing: border-box; }
    .print-table th, .print-table td { border: 1px solid #333; padding: 8px; text-align: left; color: #000; }
    .print-table th { background-color: #f3f4f6; font-weight: bold; }
    .print-header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 8px; color: #000; margin-top: 5px; }
    .print-section-title { font-size: 15px; font-weight: bold; margin-top: 20px; margin-bottom: 5px; border-left: 4px solid #333; padding-left: 8px; color: #000; }
    .print-photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; page-break-inside: avoid; }
    .photo-item-print { border: 1px solid #444; border-radius: 4px; background-color: #fafafa; overflow: hidden; display: flex; justify-content: center; align-items: center; height: 200px; }
    .photo-item-print img { width: 100%; height: 100%; object-fit: contain; }
    
    @media screen {
      .print-wrapper { display: block !important; }
    }
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .print-wrapper { box-shadow: none !important; padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
      @page { size: A4 portrait; margin: 15mm; }
    }
  `;

  document.head.innerHTML = '<title>친환경차 리포트 인쇄</title><style>' + printCss + '</style>';
  document.body.innerHTML = htmlContent;

  let checkCount = 0;
  const checkReady = setInterval(() => {
    checkCount++;
    if ((window.imgLoadCount || 0) >= totalImgs || checkCount > 15) {
      clearInterval(checkReady);
      window.print();
    }
  }, 100);

  window.onafterprint = () => {
    window.close();
  };
}

// 12. Disposition Cards & Table Rendering
let currentDispViewMode = 'card';

function setDispViewMode(mode) {
  currentDispViewMode = mode;
  document.getElementById("btn-disp-view-card").classList.toggle("active", mode === 'card');
  document.getElementById("btn-disp-view-table").classList.toggle("active", mode === 'table');

  document.getElementById("dispositions-card-grid").style.display = mode === 'card' ? 'grid' : 'none';
  document.getElementById("dispositions-table-card").style.display = mode === 'table' ? 'block' : 'none';

  filterDispositions();
}

function renderDispositionsCards(data) {
  const container = document.getElementById("dispositions-card-grid");
  if (!container) return;
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:3rem;">행정처분 검색 결과가 없습니다.</div>`;
    return;
  }

  // Group by facility_key
  const groupedMap = {};
  data.forEach(item => {
    const key = item.facility_key || "UNASSIGNED";
    if (!groupedMap[key]) {
      groupedMap[key] = [];
    }
    groupedMap[key].push(item);
  });

  Object.keys(groupedMap).forEach(key => {
    // 해당 시설의 전체 처분 데이터 (전역 데이터 기준)
    const allFacilityDisps = dispositionsData.filter(d => d.facility_key === key);
    if (allFacilityDisps.length === 0) return;

    // 1. 대표 현상태: 오직 '시설' 구분을 최우선으로 탐색 (없으면 첫 번째 레코드)
    const facilityRecord = allFacilityDisps.find(d => d.target_type === '시설') || allFacilityDisps[0] || {};
    const currentStatus = facilityRecord.current_status || '상태미지정';

    // Find facility info
    const fac = facilitiesData.find(f => f.facility_key === key) || {};
    const facName = fac.facility_name || facilityRecord.target_name_decrypted || facilityRecord.facility_name || key;
    const addressStr = fac.address_doro || fac.address_jibun || '-';

    const card = document.createElement("div");
    card.className = "disp-card";

    // Clean white background with top accent border color only
    let cardThemeStyle = "background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 4px solid #0284C7;";
    let statusClass = "badge-blue";

    if (currentStatus.includes("시정명령") || currentStatus.includes("미이행") || currentStatus.includes("위반")) {
      cardThemeStyle = "background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 4px solid #F43F5E;";
      statusClass = "badge-rose";
    } else if (currentStatus.includes("사전통지") || currentStatus.includes("의견제출") || currentStatus.includes("진행중")) {
      cardThemeStyle = "background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 4px solid #F59E0B;";
      statusClass = "badge-amber";
    } else if (currentStatus.includes("이행") || currentStatus.includes("제외") || currentStatus.includes("종결")) {
      cardThemeStyle = "background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 4px solid #10B981;";
      statusClass = "badge-emerald";
    }

    card.setAttribute("style", cardThemeStyle);

    // 2. 메인 카드 요약 항목 5개 (시정명령일자, 시정기간 줄바꿈 분리 & 오른쪽 정렬 & 컬러 동그라미)
    const findValue = (fn) => {
      const fromFac = fn(facilityRecord);
      if (fromFac !== null && fromFac !== undefined && fromFac !== '' && fromFac !== '-' && fromFac !== 'None') return fromFac;
      for (const d of allFacilityDisps) {
        const val = fn(d);
        if (val !== null && val !== undefined && val !== '' && val !== '-' && val !== 'None') return val;
      }
      return '-';
    };

    const formatStatusBadge = (val, type) => {
      if (!val || val === '-' || val === 'None') return '<span style="color:var(--text-muted); font-weight:normal;">-</span>';
      const s = String(val).trim();
      
      if (type === 'return') {
        if (s.includes('도달')) return `<span style="color:#059669; font-weight:700;">🟢 ${s}</span>`;
        if (s.includes('반송') || s.includes('미도달')) return `<span style="color:#E11D48; font-weight:700;">🔴 ${s}</span>`;
        return `<span>${s}</span>`;
      }
      if (type === 'opinion') {
        if (s.includes('제출') && !s.includes('미제출')) return `<span style="color:#0284C7; font-weight:700;">🔵 ${s}</span>`;
        if (s.includes('미제출')) return `<span style="color:#64748B;">⚪ ${s}</span>`;
        return `<span>${s}</span>`;
      }
      return s;
    };

    const advNoticeSendDate = findValue(d => d.advance_notice_send_date);
    const advNoticeReturnRaw = findValue(d => d.advance_notice_return_status);
    const advNoticeReturnStatus = formatStatusBadge(advNoticeReturnRaw, 'return');

    const abstractSendDate = findValue(d => d.abstract_send_date);
    const abstractReturnRaw = findValue(d => d.abstract_return_status);
    const abstractReturnStatus = formatStatusBadge(abstractReturnRaw, 'return');

    const rawOpinionStatus = findValue(d => d.opinion_submitted === 'O' ? '제출' : (d.opinion_submitted === 'X' ? '미제출' : d.opinion_submitted));
    const opinionStatus = formatStatusBadge(rawOpinionStatus, 'opinion');
    const opinionDate = findValue(d => d.opinion_submit_date);

    const correctionDate = findValue(d => d.correction_order_date);
    const correctionPeriod = findValue(d => d.correction_period);

    card.innerHTML = `
      <div>
        <div class="disp-card-header">
          <span class="facility-card-key">${key}</span>
          <span class="badge ${statusClass}">${currentStatus}</span>
        </div>
        <div class="disp-card-title" style="font-size:1.15rem; font-weight:700; margin-bottom:0.4rem;">${facName}</div>
        <div class="disp-card-address" style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.1rem;"><i class="fa-solid fa-location-dot"></i> ${addressStr}</div>

        <div class="disp-summary-box" style="background: rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.08); font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.95rem; border-radius: 0.6rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(0,0,0,0.08); padding-bottom: 0.35rem;">
            <span style="color:var(--text-muted); font-weight:600;">사전통지 발송 / 반송:</span>
            <div style="text-align:right; font-weight:600;">
              <span>${advNoticeSendDate}</span> <span style="margin-left:0.25rem;">(${advNoticeReturnStatus})</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(0,0,0,0.08); padding-bottom: 0.35rem;">
            <span style="color:var(--text-muted); font-weight:600;">초본주소 발송 / 반송:</span>
            <div style="text-align:right; font-weight:600;">
              <span>${abstractSendDate}</span> <span style="margin-left:0.25rem;">(${abstractReturnStatus})</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(0,0,0,0.08); padding-bottom: 0.35rem;">
            <span style="color:var(--text-muted); font-weight:600;">의견제출 일자 / 여부:</span>
            <div style="text-align:right; font-weight:600;">
              <span>${opinionDate}</span> <span style="margin-left:0.25rem;">(${opinionStatus})</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed rgba(0,0,0,0.08); padding-bottom: 0.35rem;">
            <span style="color:var(--text-muted); font-weight:600;">시정명령 일자:</span>
            <div style="text-align:right; font-weight:700; color:#E11D48;">
              ${correctionDate}
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color:var(--text-muted); font-weight:600;">시정기간:</span>
            <div style="text-align:right; font-weight:700; color:#0284C7;">
              ${correctionPeriod}
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; align-items:center; border-top:1px solid rgba(0,0,0,0.08); padding-top:0.8rem; margin-top:0.8rem;">
        <button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.75rem;" onclick="event.stopPropagation(); openDispositionDetailModal('${key}')">
          <i class="fa-solid fa-circle-info"></i> 상세 팝업
        </button>
      </div>
    `;

    card.onclick = () => openDispositionDetailModal(key);
    container.appendChild(card);
  });
}

let dispModalCharts = {};

function safeStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function openDispositionDetailModal(key) {
  try {
    currentDispositionDetailKey = key;
    const delDispBtn = document.getElementById("btn-delete-disposition-all");
    if (delDispBtn) {
      const isAdmin = currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN");
      delDispBtn.style.display = isAdmin ? "inline-flex" : "none";
    }

    const fac = facilitiesData.find(f => f.facility_key === key) || {};
    const dispItems = dispositionsData.filter(d => d.facility_key === key);

    const facName = fac.facility_name || (dispItems[0] && dispItems[0].target_name_decrypted) || key;
    
    // Find representative '시설' item or fallback to first
    const fItem = dispItems.find(d => d.target_type === '시설') || dispItems[0] || {};
    const mainStatus = fItem.current_status || '현상태 미지정';

    const titleElem = document.getElementById("disp-detail-facility-name");
    if (titleElem) titleElem.innerText = facName;

    const statusBadge = document.getElementById("disp-detail-status-badge");
    if (statusBadge) {
      statusBadge.innerText = mainStatus;
      statusBadge.className = `badge ${mainStatus.includes('시정명령') ? 'badge-rose' : 'badge-warning'}`;
    }

    const modalBody = document.getElementById("disp-detail-modal-body");
    if (!modalBody) return;
    modalBody.innerHTML = "";
    modalBody.scrollTop = 0;

    // Destroy previous modal charts
    Object.values(dispModalCharts).forEach(c => {
      try { c.destroy(); } catch (e) {}
    });
    dispModalCharts = {};

    // 1. Facility Values & Ratios Calculation (P/Q & V/X)
    const reqP = parseInt(fac.parking_required_cnt) || 0;
    const actP = fac.parking_installed_cnt !== undefined ? parseInt(fac.parking_installed_cnt) : 0;
    const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : (fac.compliance_status === '이행완료' ? 100 : 0);

    const reqC = parseInt(fac.charger_required_cnt) || 0;
    const actC = fac.charger_installed_cnt !== undefined ? parseInt(fac.charger_installed_cnt) : 0;
    const pctC = reqC > 0 ? Math.min(100, Math.round((actC / reqC) * 100)) : (fac.compliance_status === '이행완료' ? 100 : 0);

    const reqFast = parseInt(fac.charger_fast_req_cnt) || 0;
    const actFast = parseInt(fac.charger_fast_cnt) || 0;
    const fastDiff = reqFast - actFast;
    const isFastNonCompliant = fastDiff > 0;

    const canvasPId = `modal-disp-donut-p-${key}`;
    const canvasCId = `modal-disp-donut-c-${key}`;

    // 1. Facility Info Summary Card (Only Jibun Address, Dual Donut Charts, Left Status & Fast Charger Non-compliance)
    const facCardHtml = `
      <div class="disp-sub-card" style="background: #FFFFFF; border: 1px solid #CBD5E1; margin-bottom: 1.25rem; padding: 1.25rem; border-radius:0.75rem; box-shadow:0 4px 12px rgba(15,23,42,0.05);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.1rem; border-bottom:1px solid #E2E8F0; padding-bottom:0.6rem;">
          <div style="font-weight:700; font-size:1.05rem; color:#0F172A; display:flex; align-items:center; gap:0.5rem;">
            <i class="fa-solid fa-building" style="color:var(--primary);"></i> 시설 기본정보 요약
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 340px 1fr; gap: 1.5rem; align-items:center;">
          <!-- Left: Text Meta Info (Aligned line height and clean layout) -->
          <div style="font-size:0.88rem; display:flex; flex-direction:column; gap:0.55rem; border-right:1px solid #E2E8F0; padding-right:1.2rem; justify-content:center;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-weight:600;">시설명:</span>
              <strong style="color:#0F172A;">${fac.facility_name || facName}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-weight:600;">지번주소:</span>
              <span>${fac.address_jibun || '-'}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-weight:600;">시설구분:</span>
              <span>${fac.facility_category || '-'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-muted); font-weight:600;">현상태:</span>
              <span class="badge ${mainStatus.includes('시정명령') ? 'badge-rose' : 'badge-warning'}">${mainStatus}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-muted); font-weight:600;">이행여부:</span>
              <span class="badge ${fac.compliance_status === '이행완료' ? 'badge-emerald' : 'badge-rose'}">${fac.compliance_status || '-'}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-muted); font-weight:600;">의무급속:</span>
              ${isFastNonCompliant ? `<span style="color:#E11D48; font-weight:800;"><i class="fa-solid fa-triangle-exclamation"></i> 미이행 ${fastDiff}기</span>` : '<span style="color:#059669; font-weight:bold;">이행</span>'}
            </div>
          </div>

          <!-- Right: Enlarge Donut Charts (No background box) -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items:center; justify-content:center; padding: 0.5rem 0;">
            <!-- Parking Donut -->
            <div class="donut-box-item" style="display:flex; flex-direction:column; align-items:center;">
              <div class="donut-title-label" style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem;">
                <i class="fa-solid fa-square-parking" style="color:var(--primary);"></i> 주차면수
              </div>
              <div class="donut-chart-relative" style="width: 100px; height: 100px; position:relative; display:flex; align-items:center; justify-content:center;">
                <canvas id="${canvasPId}"></canvas>
                <div class="donut-center-pct" style="position:absolute; font-size:1.05rem; font-weight:800; color:${pctP === 100 ? '#059669' : '#E11D48'};">${pctP}%</div>
              </div>
              <div class="donut-ratio-slash" style="font-size:0.85rem; font-weight:700; color:var(--text-main); margin-top:0.5rem;">
                <span style="font-weight:800; color:${actP >= reqP ? '#059669' : '#E11D48'};">${actP}면</span> / ${reqP}면
              </div>
            </div>

            <!-- Charger Donut -->
            <div class="donut-box-item" style="display:flex; flex-direction:column; align-items:center;">
              <div class="donut-title-label" style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem;">
                <i class="fa-solid fa-bolt" style="color:var(--warning);"></i> 충전기수
              </div>
              <div class="donut-chart-relative" style="width: 100px; height: 100px; position:relative; display:flex; align-items:center; justify-content:center;">
                <canvas id="${canvasCId}"></canvas>
                <div class="donut-center-pct" style="position:absolute; font-size:1.05rem; font-weight:800; color:${pctC === 100 ? '#059669' : '#E11D48'};">${pctC}%</div>
              </div>
              <div class="donut-ratio-slash" style="font-size:0.85rem; font-weight:700; color:var(--text-main); margin-top:0.5rem;">
                <span style="font-weight:800; color:${actC >= reqC ? '#059669' : '#E11D48'};">${actC}기</span> / ${reqC}기
              </div>
              ${isFastNonCompliant ? `<div style="font-size:0.78rem; font-weight:800; color:#E11D48; margin-top:0.4rem;"><i class="fa-solid fa-triangle-exclamation"></i> 의무급속미이행 ${fastDiff}기</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    modalBody.insertAdjacentHTML('beforeend', facCardHtml);

    // Render Charts in Modal
    setTimeout(() => {
      try {
        const ctxP = document.getElementById(canvasPId);
        if (ctxP) {
          const isOkP = pctP === 100;
          dispModalCharts[`modal_p`] = new Chart(ctxP.getContext('2d'), {
            type: 'doughnut',
            data: {
              datasets: [{
                data: isOkP ? [100, 0] : [actP, Math.max(0, reqP - actP)],
                backgroundColor: isOkP ? ['#059669', '#E2E8F0'] : ['#0284C7', '#E11D48'],
                borderWidth: 0
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }
          });
        }

        const ctxC = document.getElementById(canvasCId);
        if (ctxC) {
          const isOkC = pctC === 100;
          dispModalCharts[`modal_c`] = new Chart(ctxC.getContext('2d'), {
            type: 'doughnut',
            data: {
              datasets: [{
                data: isOkC ? [100, 0] : [actC, Math.max(0, reqC - actC)],
                backgroundColor: isOkC ? ['#059669', '#E2E8F0'] : ['#0284C7', '#E11D48'],
                borderWidth: 0
              }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }
          });
        }
      } catch (errChart) {
        console.error("Error rendering disp modal charts:", errChart);
      }
    }, 20);

    // 2. Disposition Sub-items List
    if (dispItems.length === 0) {
      modalBody.insertAdjacentHTML('beforeend', `<div style="text-align:center; color:var(--text-muted); padding:2rem;">등록된 상세 행정처분 이력이 없습니다.</div>`);
    } else {
      dispItems.forEach((d) => {
        // Skip ghost empty disposition records without name and content
        const hasName = !!(d.target_name_decrypted || d.target_name_encrypted);
        const hasContent = !!(d.advance_notice_method || d.opinion_content || d.correction_order_date || d.mail_address_decrypted || d.recipient_name_decrypted || d.advance_notice_date);
        if (d.target_type !== '시설' && !hasName && !hasContent) {
          return;
        }

        // Clean string without Lock emojis
        const targetNameStr = d.target_name_decrypted || d.target_name_encrypted || '-';
        const recipientStr = d.recipient_name_decrypted || d.recipient_name_encrypted || '-';
        const regNumStr = d.reg_num_decrypted || d.reg_num_encrypted || '-';
        const contactStr = d.contact_decrypted || d.contact_encrypted || '-';
        const mailAddrStr = d.mail_address_decrypted || d.mail_address_encrypted || '-';
        const abstractAddrStr = d.abstract_address_decrypted || d.abstract_address_encrypted || '-';

        // Return Status Badge (🟢 도달 / 🔴 반송)
        let returnBadgeStr = '-';
        const retVal = safeStr(d.advance_notice_return_status);
        if (retVal.includes('도달')) {
          returnBadgeStr = `<span style="color:#059669; font-weight:800;">🟢 도달</span>`;
        } else if (retVal.includes('반송')) {
          returnBadgeStr = `<span style="color:#E11D48; font-weight:800;">🔴 반송 (${retVal})</span>`;
        } else if (retVal) {
          returnBadgeStr = `<span>${retVal}</span>`;
        }

        // G열 '대상' 정보 (예: 부지/건물, 토지, 건물)
        const targetScopeStr = d.advance_notice_target ? `(${d.advance_notice_target})` : '';

        // Dynamic Badge Class for Target Types (시설, 소유자, 관리자, 법인대표, 분양사, 사내이사)
        let tagBadgeClass = "badge-amber";
        if (d.target_type === '시설') tagBadgeClass = "badge-blue";
        else if (d.target_type === '관리자') tagBadgeClass = "badge-emerald";
        else if (d.target_type === '법인대표') tagBadgeClass = "badge-rose";

        // Title: [구분] 성명 (G열 대상)
        const targetTagHtml = `
          <span class="badge ${tagBadgeClass}">${d.target_type || '소유자'}</span>
          <strong style="font-size:1rem; color:#0F172A;">${targetNameStr} ${targetScopeStr}</strong>
        `;

        const subHtml = `
          <div class="disp-sub-card" style="margin-bottom:1.25rem;">
            <div class="disp-sub-title" style="display:flex; justify-content:space-between; align-items:center;">
              <div>${targetTagHtml}</div>
              <button class="btn btn-secondary" style="padding:0.25rem 0.65rem; font-size:0.75rem;" onclick="editDisposition(${d.id})">
                <i class="fa-solid fa-pen-to-square"></i> 레코드 수정
              </button>
              ${currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN") ? `<button class="btn btn-rose admin-only" style="padding:0.25rem 0.65rem; font-size:0.75rem; margin-left:0.4rem;" onclick="deleteSingleDispositionRecord(${d.id})"><i class="fa-solid fa-trash-can"></i> 레코드 삭제</button>` : ''}
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.85rem;">
              <!-- Left Column: 사전통지 & 초본주소 -->
              <div style="background:#FFFFFF; padding:0.9rem; border-radius:0.5rem; border:1px solid #E2E8F0;">
                <div style="font-weight:700; color:#0284C7; margin-bottom:0.6rem;"><i class="fa-solid fa-envelope"></i> 사전통지 및 초본주소 정보</div>
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                  <div><strong>사전통지 방법:</strong> ${d.advance_notice_method || '-'}</div>
                  <div><strong>우편발송주소:</strong> ${mailAddrStr} (우편번호: ${d.zip_code || '-'})</div>
                  <div><strong>수신인:</strong> ${recipientStr}</div>
                  <div><strong>발송일:</strong> ${d.advance_notice_send_date || '-'}</div>
                  <div><strong>반송여부:</strong> ${returnBadgeStr}</div>
                  <hr style="border:0; border-top:1px dashed #E2E8F0; margin:0.4rem 0;">
                  <div><strong>초본주소 발송일자:</strong> ${d.abstract_send_date || '-'}</div>
                  <div><strong>초본주소:</strong> ${abstractAddrStr}</div>
                  <div><strong>초본주소 반송여부:</strong> ${d.abstract_return_status || '-'}</div>
                  <div><strong>고시/공고 및 기간:</strong> ${d.notice_public || '-'} (${d.notice_public_period || '-'})</div>
                </div>
              </div>

              <!-- Right Column: 의견제출 & 시정명령 -->
              <div style="background:#FFFFFF; padding:0.8rem; border-radius:0.5rem; border:1px solid #E2E8F0;">
                <div style="font-weight:700; color:#D97706; margin-bottom:0.6rem;"><i class="fa-solid fa-gavel"></i> 의견제출 및 시정명령 정보</div>
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                  <div><strong>의견제출 여부/일자:</strong> ${d.opinion_submitted === 'O' ? '<span style="color:#059669; font-weight:bold;">🟢 제출</span>' : '⚪ 미제출'} (${d.opinion_submit_date || '-'})</div>
                  <div><strong>의견 내용:</strong> ${d.opinion_content || '-'}</div>
                  <hr style="border:0; border-top:1px dashed #E2E8F0; margin:0.4rem 0;">
                  <div><strong>시정명령대상:</strong> ${d.correction_order || '-'}</div>
                  <div><strong>시정명령일자:</strong> ${d.correction_order_date || '-'}</div>
                  <div><strong>시정명령 사유:</strong> ${d.correction_reason || '-'}</div>
                  <div><strong>시정기간:</strong> ${d.correction_period || '-'}</div>
                  <div><strong>통지방법 / 반송내역:</strong> ${d.correction_notice_method || '-'} / ${d.correction_return_details || '-'}</div>
                  <div><strong>고시/공고:</strong> ${d.correction_public || '-'}</div>
                </div>
              </div>

              <!-- Full Span: 암호화된 법인번호/연락처 및 비고 -->
              <div style="grid-column: span 2; background:#F8FAFC; padding:0.8rem 1rem; border-radius:0.5rem; border:1px solid #CBD5E1; font-size:0.85rem; display:flex; flex-wrap:wrap; gap:1.5rem; align-items:center;">
                <div><strong>법인번호(주민번호):</strong> ${regNumStr}</div>
                <div><strong>연락처:</strong> ${contactStr}</div>
                <div style="flex:1;"><strong>비고:</strong> ${d.note || '-'}</div>
              </div>
            </div>
          </div>
        `;
        modalBody.insertAdjacentHTML('beforeend', subHtml);
      });
    }

    const modalElem = document.getElementById("modal-disposition-detail");
    if (modalElem) {
      modalElem.classList.add("active");
      
      const resetScrolls = () => {
        modalElem.scrollTop = 0;
        if (modalBody) modalBody.scrollTop = 0;
        const content = modalElem.querySelector(".modal-content");
        if (content) content.scrollTop = 0;
      };

      resetScrolls();
      setTimeout(resetScrolls, 10);
      setTimeout(resetScrolls, 50);
    }
  } catch (err) {
    console.error("Error opening disposition detail modal:", err);
  }
}

function strVal(val) {
  return val ? strValClean(val) : '';
}
function strValClean(val) {
  return String(val).trim();
}

function renderDispositionsTable(data) {
  // Table view removed per requirement (Card view is default & only view)
}

function renderUsersTable(data) {
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";

  data.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${u.username}</strong></td>
      <td>${u.name}</td>
      <td><span class="badge ${u.role === 'ADMIN' ? 'badge-rose' : 'badge-blue'}">${u.role}</span></td>
      <td>${u.created_at || '-'}</td>
      <td>
        <button class="btn btn-secondary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="openUserModal('${u.username}')">수정/비번변경</button>
        ${u.username !== 'ADMIN' ? `<button class="btn btn-danger" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="deleteUser('${u.username}')">삭제</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Encrypted Toggle Helper
async function toggleDecrypt(element, encryptedStr, decryptedStr) {
  if (decryptedStr) {
    if (element.dataset.masked === "true") {
      element.innerText = decryptedStr;
      element.dataset.masked = "false";
    } else {
      element.innerText = "[암호화됨]";
      element.dataset.masked = "true";
    }
  } else if (encryptedStr && encryptedStr !== 'None') {
    try {
      const res = await fetch(`${API_BASE_URL}/decrypt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: encryptedStr })
      });
      const result = await res.json();
      element.innerText = result.result || "복호화 실패";
    } catch (e) {}
  }
}

// 13. Modals & CRUD Logic
function openFacilityModal(key = null) {
  document.getElementById("form-facility").reset();
  if (key) {
    const item = facilitiesData.find(f => f.facility_key === key);
    if (item) {
      document.getElementById("modal-facility-title").innerText = `시설 정보 수정 (${key})`;
      document.getElementById("fac-key").value = item.facility_key;
      document.getElementById("fac-key").readOnly = true;
      document.getElementById("fac-name").value = item.facility_name || "";
      document.getElementById("fac-category").value = item.facility_category || "";
      document.getElementById("fac-compliance").value = item.compliance_status || "미이행";
      document.getElementById("fac-ownership").value = item.facility_ownership_type || "";
      document.getElementById("fac-address-doro").value = item.address_doro || "";
      document.getElementById("fac-address-jibun").value = item.address_jibun || "";
      document.getElementById("fac-dong").value = item.dong_name || "";
      document.getElementById("fac-dates").value = item.building_approval_dates || "";
      document.getElementById("fac-new-old").value = item.building_new_old_type || "신축";
      document.getElementById("fac-register").value = item.building_register_num || 0;
      document.getElementById("fac-parking-req").value = item.parking_required_cnt || 0;
      document.getElementById("fac-parking-inst").value = item.parking_installed_cnt || 0;
      document.getElementById("fac-parking-uninstalled").value = item.parking_uninstalled_cnt || 0;
      document.getElementById("fac-charger-req").value = item.charger_required_cnt || 0;
      document.getElementById("fac-charger-inst").value = item.charger_installed_cnt || 0;
      document.getElementById("fac-charger-uninstalled").value = item.charger_uninstalled_cnt || 0;
      document.getElementById("fac-fast-req").value = item.charger_fast_req_cnt || 0;
      document.getElementById("fac-fast-cnt").value = item.charger_fast_cnt || 0;
      document.getElementById("fac-management-body").value = item.management_body || "";
      if (item.manager_name_decrypted) document.getElementById("fac-manager-name").value = item.manager_name_decrypted;
      if (item.manager_contact_decrypted) document.getElementById("fac-manager-contact").value = item.manager_contact_decrypted;
    }
  } else {
    document.getElementById("modal-facility-title").innerText = "신규 시설 등록";
    document.getElementById("fac-key").readOnly = false;
  }
  document.getElementById("modal-facility").classList.add("active");
}

function editFacility(key) { openFacilityModal(key); }

async function saveFacility() {
  const key = document.getElementById("fac-key").value.trim();
  const name = document.getElementById("fac-name").value.trim();
  if (!key || !name) { alert("BU KEY와 시설명은 필수입니다."); return; }

  const mgrName = document.getElementById("fac-manager-name").value.trim();
  const mgrContact = document.getElementById("fac-manager-contact").value.trim();

  const payload = {
    facility_key: key,
    facility_name: name,
    facility_category: document.getElementById("fac-category").value.trim(),
    compliance_status: document.getElementById("fac-compliance").value,
    facility_ownership_type: document.getElementById("fac-ownership").value.trim(),
    address_doro: document.getElementById("fac-address-doro").value.trim(),
    address_jibun: document.getElementById("fac-address-jibun").value.trim(),
    dong_name: document.getElementById("fac-dong").value.trim(),
    building_approval_dates: document.getElementById("fac-dates").value.trim(),
    building_new_old_type: document.getElementById("fac-new-old").value,
    building_register_num: parseInt(document.getElementById("fac-register").value) || 0,
    parking_required_cnt: parseInt(document.getElementById("fac-parking-req").value) || 0,
    parking_installed_cnt: parseInt(document.getElementById("fac-parking-inst").value) || 0,
    parking_uninstalled_cnt: parseInt(document.getElementById("fac-parking-uninstalled").value) || 0,
    charger_required_cnt: parseInt(document.getElementById("fac-charger-req").value) || 0,
    charger_installed_cnt: parseInt(document.getElementById("fac-charger-inst").value) || 0,
    charger_uninstalled_cnt: parseInt(document.getElementById("fac-charger-uninstalled").value) || 0,
    charger_fast_req_cnt: parseInt(document.getElementById("fac-fast-req").value) || 0,
    charger_fast_cnt: parseInt(document.getElementById("fac-fast-cnt").value) || 0,
    management_body: document.getElementById("fac-management-body").value.trim(),
    manager_name_decrypted: mgrName,
    manager_contact_decrypted: mgrContact
  };

  // Instant In-Memory Cache Update for 0.001s response
  let idx = facilitiesData.findIndex(f => f.facility_key === key);
  if (idx >= 0) {
    facilitiesData[idx] = { ...facilitiesData[idx], ...payload };
  } else {
    facilitiesData.unshift(payload);
  }

  try {
    localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData));
  } catch(e) {}

  alert("성공적으로 저장되었습니다.");
  closeModal('modal-facility');
  filterFacilities();
  updateDashboardStats();
  openFacilityDetailModal(key);

  // Async Background DB Sync
  try {
    fetch(`${API_BASE_URL}/facilities/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) { console.error(err); }
}

async function deleteFacility(key) {
  if (!confirm(`정말 시설 (${key})을 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`${API_BASE_URL}/facilities/delete?key=${key}`, { method: "DELETE" });
    if (res.ok) {
      alert("삭제되었습니다.");
      loadData();
    }
  } catch (err) { console.error(err); }
}

let subOwnerCounter = 0;

function addDispositionSubForm() {
  subOwnerCounter++;
  const container = document.getElementById("disp-sub-owners-container");
  if (!container) return;

  const subHtml = `
    <div id="sub-owner-card-${subOwnerCounter}" class="form-section-card sub-owner-card" style="background:#FFFDF5; border:1px solid #FCD34D; padding:1.1rem; border-radius:0.5rem; position:relative; margin-top:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
        <div style="font-weight:700; color:#D97706; font-size:0.95rem; display:flex; align-items:center; gap:0.4rem;">
          <i class="fa-solid fa-user-plus" style="color:#D97706;"></i> 동시 추가 하위 소유자/대상 #${subOwnerCounter} (30개 전체 항목)
        </div>
        <button type="button" class="btn btn-danger" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="document.getElementById('sub-owner-card-${subOwnerCounter}').remove()">
          <i class="fa-solid fa-trash"></i> 카드 삭제
        </button>
      </div>

      <!-- 1. 기본 관리 정보 -->
      <div style="font-weight:700; color:#0F172A; margin:0.6rem 0 0.4rem 0; font-size:0.85rem;">1. 기본 관리 정보</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">하위 구분 *</label>
          <select class="select-box sub-target-type">
            <option value="소유자">소유자</option>
            <option value="관리자">관리자</option>
            <option value="법인대표">법인대표</option>
            <option value="분양사">분양사</option>
            <option value="사내이사">사내이사</option>
            <option value="시설">시설</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">성명/상호 (DB 암호화)</label>
          <input type="text" class="input-box sub-target-name" placeholder="성명 입력">
        </div>
        <div class="form-group">
          <label class="form-label">현상태</label>
          <input type="text" class="input-box sub-status" placeholder="예: 7.27.시정명령">
        </div>
        <div class="form-group">
          <label class="form-label">G열 대상 범위</label>
          <input type="text" class="input-box sub-notice-target" placeholder="예: 부지/건물, 토지">
        </div>
      </div>

      <!-- 2. 사전통지 & 초본주소 정보 -->
      <div style="font-weight:700; color:#0284C7; margin:0.8rem 0 0.4rem 0; font-size:0.85rem;">2. 사전통지 및 초본주소 정보</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">사전통지 방법</label>
          <input type="text" class="input-box sub-notice-method" placeholder="등기 등">
        </div>
        <div class="form-group">
          <label class="form-label">우편발송주소 (DB 암호화)</label>
          <input type="text" class="input-box sub-mail-address" placeholder="주소 입력">
        </div>
        <div class="form-group">
          <label class="form-label">우편번호</label>
          <input type="text" class="input-box sub-zip-code" placeholder="우편번호">
        </div>
        <div class="form-group">
          <label class="form-label">수신인 (DB 암호화)</label>
          <input type="text" class="input-box sub-recipient-name" placeholder="수신인">
        </div>
        <div class="form-group">
          <label class="form-label">사전통지 발송일자</label>
          <input type="date" class="input-box sub-notice-send-date">
        </div>
        <div class="form-group">
          <label class="form-label">사전통지 반송여부</label>
          <input type="text" class="input-box sub-notice-return-status" placeholder="도달/반송">
        </div>
        <div class="form-group">
          <label class="form-label">초본주소 발송일자</label>
          <input type="date" class="input-box sub-abstract-send-date">
        </div>
        <div class="form-group">
          <label class="form-label">초본주소 (DB 암호화)</label>
          <input type="text" class="input-box sub-abstract-address" placeholder="초본주소">
        </div>
        <div class="form-group">
          <label class="form-label">초본주소 반송여부</label>
          <input type="text" class="input-box sub-abstract-return-status">
        </div>
        <div class="form-group">
          <label class="form-label">사전 고시/공고</label>
          <input type="text" class="input-box sub-notice-public">
        </div>
        <div class="form-group full">
          <label class="form-label">사전 고시/공고 기간</label>
          <input type="text" class="input-box sub-notice-public-period">
        </div>
      </div>

      <!-- 3. 의견제출 & 시정명령 정보 -->
      <div style="font-weight:700; color:#D97706; margin:0.8rem 0 0.4rem 0; font-size:0.85rem;">3. 의견제출 및 시정명령 정보</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">의견제출 여부</label>
          <select class="select-box sub-opinion-submitted">
            <option value="X">X (미제출)</option>
            <option value="O">O (제출)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">의견제출 일자</label>
          <input type="date" class="input-box sub-opinion-submit-date">
        </div>
        <div class="form-group full">
          <label class="form-label">의견 내용</label>
          <input type="text" class="input-box sub-opinion-content">
        </div>
        <div class="form-group">
          <label class="form-label">Y열 시정명령대상</label>
          <input type="text" class="input-box sub-correction-order">
        </div>
        <div class="form-group">
          <label class="form-label">시정명령일자</label>
          <input type="date" class="input-box sub-correction-date">
        </div>
        <div class="form-group full">
          <label class="form-label">시정명령 사유 및 내용</label>
          <input type="text" class="input-box sub-correction-reason">
        </div>
        <div class="form-group">
          <label class="form-label">시정기간</label>
          <input type="text" class="input-box sub-correction-period">
        </div>
        <div class="form-group">
          <label class="form-label">시정 통지방법</label>
          <input type="text" class="input-box sub-correction-notice-method">
        </div>
        <div class="form-group">
          <label class="form-label">시정 통지 반송내역</label>
          <input type="text" class="input-box sub-correction-return-details">
        </div>
        <div class="form-group">
          <label class="form-label">시정 고시/공고</label>
          <input type="text" class="input-box sub-correction-public">
        </div>
      </div>

      <!-- 4. 암호화 보안 개인정보 & 비고 -->
      <div style="font-weight:700; color:#059669; margin:0.8rem 0 0.4rem 0; font-size:0.85rem;">4. 암호화 보안 개인정보 & 비고</div>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">법인번호(주민번호) (DB 암호화)</label>
          <input type="text" class="input-box sub-reg-num" placeholder="13자 번호">
        </div>
        <div class="form-group">
          <label class="form-label">연락처 (DB 암호화)</label>
          <input type="text" class="input-box sub-contact" placeholder="010-0000-0000">
        </div>
        <div class="form-group full">
          <label class="form-label">비고</label>
          <input type="text" class="input-box sub-note" placeholder="특이사항">
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', subHtml);
}

function openDispositionModal(id = null) {
  const form = document.getElementById("form-disposition");
  if (form) form.reset();

  subOwnerCounter = 0;
  const container = document.getElementById("disp-sub-owners-container");
  if (container) container.innerHTML = "";

  if (id) {
    const item = dispositionsData.find(d => d.id === id);
    if (item) {
      const fac = facilitiesData.find(f => f.facility_key === item.facility_key) || {};
      const facName = fac.facility_name || item.facility_key || `수정 (#${id})`;
      const targetType = item.target_type || '소유자';
      const targetName = item.target_name_decrypted || item.target_name_encrypted || '';

      let subInfoStr = targetType;
      if (targetName && targetName !== facName) {
        subInfoStr = `${targetType}: ${targetName}`;
      }
      
      document.getElementById("modal-disposition-title").innerText = `${facName} (${subInfoStr}) 수정`;
      document.getElementById("disp-id").value = item.id;
      
      // 1. 기본 관리 정보
      document.getElementById("disp-facility-key").value = item.facility_key || "";
      document.getElementById("disp-target-type").value = item.target_type || "시설";
      document.getElementById("disp-status").value = item.current_status || "";
      document.getElementById("disp-target-name").value = item.target_name_decrypted || item.target_name_encrypted || "";
      document.getElementById("disp-notice-target").value = item.advance_notice_target || "";

      // 2. 사전통지 & 초본주소 정보
      document.getElementById("disp-notice-method").value = item.advance_notice_method || "";
      document.getElementById("disp-mail-address").value = item.mail_address_decrypted || item.mail_address_encrypted || "";
      document.getElementById("disp-zip-code").value = item.zip_code || "";
      document.getElementById("disp-recipient-name").value = item.recipient_name_decrypted || item.recipient_name_encrypted || "";
      document.getElementById("disp-notice-send-date").value = item.advance_notice_send_date || "";
      document.getElementById("disp-notice-return-status").value = item.advance_notice_return_status || "";
      document.getElementById("disp-abstract-send-date").value = item.abstract_send_date || "";
      document.getElementById("disp-abstract-address").value = item.abstract_address_decrypted || item.abstract_address_encrypted || "";
      document.getElementById("disp-abstract-return-status").value = item.abstract_return_status || "";
      document.getElementById("disp-notice-public").value = item.notice_public || "";
      document.getElementById("disp-notice-public-period").value = item.notice_public_period || "";

      // 3. 의견제출 & 시정명령 정보
      document.getElementById("disp-opinion-submitted").value = item.opinion_submitted || "X";
      document.getElementById("disp-opinion-submit-date").value = item.opinion_submit_date || "";
      document.getElementById("disp-opinion-content").value = item.opinion_content || "";
      document.getElementById("disp-correction-order").value = item.correction_order || "";
      document.getElementById("disp-correction-date").value = item.correction_order_date || "";
      document.getElementById("disp-correction-reason").value = item.correction_reason || "";
      document.getElementById("disp-correction-period").value = item.correction_period || "";
      document.getElementById("disp-correction-notice-method").value = item.correction_notice_method || "";
      document.getElementById("disp-correction-return-details").value = item.correction_return_details || "";
      document.getElementById("disp-correction-public").value = item.correction_public || "";

      // 4. 개인정보 & 비고
      document.getElementById("disp-reg-num").value = item.reg_num_decrypted || item.reg_num_encrypted || "";
      document.getElementById("disp-contact").value = item.contact_decrypted || item.contact_encrypted || "";
      document.getElementById("disp-note").value = item.note || "";
    }
  } else {
    document.getElementById("modal-disposition-title").innerText = "신규등록";
    document.getElementById("disp-id").value = "";
  }
  document.getElementById("modal-disposition").classList.add("active");
}

function editDisposition(id) { openDispositionModal(id); }

async function encryptFieldText(val) {
  if (!val) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/encrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: val })
    });
    const result = await res.json();
    return result.result || null;
  } catch (e) {
    return null;
  }
}

async function saveDisposition() {
  const id = document.getElementById("disp-id").value;
  const facilityKey = document.getElementById("disp-facility-key").value.trim();
  if (!facilityKey) { alert("시설 KEY는 필수입니다."); return; }

  // Encrypt sensitive fields
  const targetName = document.getElementById("disp-target-name").value.trim();
  const mailAddr = document.getElementById("disp-mail-address").value.trim();
  const recipientName = document.getElementById("disp-recipient-name").value.trim();
  const abstractAddr = document.getElementById("disp-abstract-address").value.trim();
  const regNum = document.getElementById("disp-reg-num").value.trim();
  const contact = document.getElementById("disp-contact").value.trim();

  const [encTarget, encMail, encRecipient, encAbstract, encReg, encContact] = await Promise.all([
    encryptFieldText(targetName),
    encryptFieldText(mailAddr),
    encryptFieldText(recipientName),
    encryptFieldText(abstractAddr),
    encryptFieldText(regNum),
    encryptFieldText(contact)
  ]);

  const payload = {
    facility_key: facilityKey,
    target_type: document.getElementById("disp-target-type").value,
    current_status: document.getElementById("disp-status").value.trim(),
    advance_notice_target: document.getElementById("disp-notice-target").value.trim(),

    advance_notice_method: document.getElementById("disp-notice-method").value.trim(),
    zip_code: document.getElementById("disp-zip-code").value.trim(),
    advance_notice_send_date: document.getElementById("disp-notice-send-date").value || null,
    advance_notice_return_status: document.getElementById("disp-notice-return-status").value.trim(),
    abstract_send_date: document.getElementById("disp-abstract-send-date").value || null,
    abstract_return_status: document.getElementById("disp-abstract-return-status").value.trim(),
    notice_public: document.getElementById("disp-notice-public").value.trim(),
    notice_public_period: document.getElementById("disp-notice-public-period").value.trim(),

    opinion_submitted: document.getElementById("disp-opinion-submitted").value,
    opinion_submit_date: document.getElementById("disp-opinion-submit-date").value || null,
    opinion_content: document.getElementById("disp-opinion-content").value.trim(),
    correction_order: document.getElementById("disp-correction-order").value.trim(),
    correction_order_date: document.getElementById("disp-correction-date").value || null,
    correction_reason: document.getElementById("disp-correction-reason").value.trim(),
    correction_period: document.getElementById("disp-correction-period").value.trim(),
    correction_notice_method: document.getElementById("disp-correction-notice-method").value.trim(),
    correction_return_details: document.getElementById("disp-correction-return-details").value.trim(),
    correction_public: document.getElementById("disp-correction-public").value.trim(),
    note: document.getElementById("disp-note").value.trim()
  };

  if (id) payload.id = parseInt(id);
  if (encTarget) payload.target_name_encrypted = encTarget;
  if (encMail) payload.mail_address_encrypted = encMail;
  if (encRecipient) payload.recipient_name_encrypted = encRecipient;
  if (encAbstract) payload.abstract_address_encrypted = encAbstract;
  if (encReg) payload.reg_num_encrypted = encReg;
  if (encContact) payload.contact_encrypted = encContact;

  try {
    const res = await fetch(`${API_BASE_URL}/dispositions/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      alert("주 메인 처분 저장 실패");
      return;
    }

    // Save Sub-owner Forms (All 30 fields parsed)
    const subCards = document.querySelectorAll("#disp-sub-owners-container .sub-owner-card");
    for (const card of subCards) {
      const subTargetType = card.querySelector(".sub-target-type").value;
      const subTargetName = card.querySelector(".sub-target-name").value.trim();
      const subStatus = card.querySelector(".sub-status").value.trim();
      const subNoticeTarget = card.querySelector(".sub-notice-target").value.trim();

      const subNoticeMethod = card.querySelector(".sub-notice-method").value.trim();
      const subMailAddr = card.querySelector(".sub-mail-address").value.trim();
      const subZipCode = card.querySelector(".sub-zip-code").value.trim();
      const subRecipient = card.querySelector(".sub-recipient-name").value.trim();
      const subNoticeSendDate = card.querySelector(".sub-notice-send-date").value || null;
      const subNoticeReturnStatus = card.querySelector(".sub-notice-return-status").value.trim();
      const subAbstractSendDate = card.querySelector(".sub-abstract-send-date").value || null;
      const subAbstractAddr = card.querySelector(".sub-abstract-address").value.trim();
      const subAbstractReturnStatus = card.querySelector(".sub-abstract-return-status").value.trim();
      const subNoticePublic = card.querySelector(".sub-notice-public").value.trim();
      const subNoticePublicPeriod = card.querySelector(".sub-notice-public-period").value.trim();

      const subOpinionSubmitted = card.querySelector(".sub-opinion-submitted").value;
      const subOpinionSubmitDate = card.querySelector(".sub-opinion-submit-date").value || null;
      const subOpinionContent = card.querySelector(".sub-opinion-content").value.trim();
      const subCorrectionOrder = card.querySelector(".sub-correction-order").value.trim();
      const subCorrectionDate = card.querySelector(".sub-correction-date").value || null;
      const subCorrectionReason = card.querySelector(".sub-correction-reason").value.trim();
      const subCorrectionPeriod = card.querySelector(".sub-correction-period").value.trim();
      const subCorrectionNoticeMethod = card.querySelector(".sub-correction-notice-method").value.trim();
      const subCorrectionReturnDetails = card.querySelector(".sub-correction-return-details").value.trim();
      const subCorrectionPublic = card.querySelector(".sub-correction-public").value.trim();

      const subReg = card.querySelector(".sub-reg-num").value.trim();
      const subCon = card.querySelector(".sub-contact").value.trim();
      const subNote = card.querySelector(".sub-note").value.trim();

      const [subEncName, subEncMail, subEncRecip, subEncAbstract, subEncReg, subEncCon] = await Promise.all([
        encryptFieldText(subTargetName),
        encryptFieldText(subMailAddr),
        encryptFieldText(subRecipient),
        encryptFieldText(subAbstractAddr),
        encryptFieldText(subReg),
        encryptFieldText(subCon)
      ]);

      const subPayload = {
        facility_key: facilityKey,
        target_type: subTargetType,
        current_status: subStatus || payload.current_status,
        advance_notice_target: subNoticeTarget,

        advance_notice_method: subNoticeMethod,
        zip_code: subZipCode,
        advance_notice_send_date: subNoticeSendDate,
        advance_notice_return_status: subNoticeReturnStatus,
        abstract_send_date: subAbstractSendDate,
        abstract_return_status: subAbstractReturnStatus,
        notice_public: subNoticePublic,
        notice_public_period: subNoticePublicPeriod,

        opinion_submitted: subOpinionSubmitted,
        opinion_submit_date: subOpinionSubmitDate,
        opinion_content: subOpinionContent,
        correction_order: subCorrectionOrder,
        correction_order_date: subCorrectionDate,
        correction_reason: subCorrectionReason,
        correction_period: subCorrectionPeriod,
        correction_notice_method: subCorrectionNoticeMethod,
        correction_return_details: subCorrectionReturnDetails,
        correction_public: subCorrectionPublic,
        note: subNote
      };

      if (subEncName) subPayload.target_name_encrypted = subEncName;
      if (subEncMail) subPayload.mail_address_encrypted = subEncMail;
      if (subEncRecip) subPayload.recipient_name_encrypted = subEncRecip;
      if (subEncAbstract) subPayload.abstract_address_encrypted = subEncAbstract;
      if (subEncReg) subPayload.reg_num_encrypted = subEncReg;
      if (subEncCon) subPayload.contact_encrypted = subEncCon;

      await fetch(`${API_BASE_URL}/dispositions/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subPayload)
      });
    }

    alert("성공적으로 저장되었습니다.");
    closeModal('modal-disposition');
    await loadData();

    // 상세 팝업이 활성화 상태라면 최신 데이터로 새로고침
    const detailModal = document.getElementById("modal-disposition-detail");
    if (detailModal && detailModal.classList.contains("active")) {
      openDispositionDetailModal(facilityKey);
    }
  } catch (err) {
    console.error("Error saving disposition:", err);
    alert("저장 중 오류가 발생했습니다.");
  }
}

async function deleteDisposition(id) {
  if (!confirm(`정말 행정처분 내역 (#${id})을 삭제하시겠습니까?`)) return;
  try {
    const item = dispositionsData.find(d => d.id === id);
    const facilityKey = item ? item.facility_key : null;

    const res = await fetch(`${API_BASE_URL}/dispositions/delete?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      alert("삭제되었습니다.");
      await loadData();

      if (facilityKey) {
        const detailModal = document.getElementById("modal-disposition-detail");
        if (detailModal && detailModal.classList.contains("active")) {
          const remain = dispositionsData.filter(d => d.facility_key === facilityKey);
          if (remain.length === 0) {
            closeModal('modal-disposition-detail');
          } else {
            openDispositionDetailModal(facilityKey);
          }
        }
      }
    }
  } catch (err) { console.error(err); }
}

function openUserModal(username = null) {
  document.getElementById("form-user").reset();
  if (username) {
    const item = usersData.find(u => u.username === username);
    if (item) {
      document.getElementById("modal-user-title").innerText = `계정 정보 수정 / 비밀번호 변경 (${username})`;
      document.getElementById("user-username").value = item.username;
      document.getElementById("user-username").readOnly = true;
      document.getElementById("user-name").value = item.name;
      document.getElementById("user-role").value = item.role;
    }
  } else {
    document.getElementById("modal-user-title").innerText = "신규 계정 추가";
    document.getElementById("user-username").readOnly = false;
  }
  document.getElementById("modal-user").classList.add("active");
}

async function saveUser() {
  const username = document.getElementById("user-username").value.trim();
  const password = document.getElementById("user-password").value.trim();
  const name = document.getElementById("user-name").value.trim();
  const role = document.getElementById("user-role").value;

  if (!username || !name) {
    alert("아이디와 성명은 필수입니다.");
    return;
  }

  const payload = { username, password, name, role };

  try {
    const res = await fetch(`${API_BASE_URL}/users/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert("계정 정보가 저장되었습니다.");
      closeModal('modal-user');
      fetchUsers();
    }
  } catch (err) { console.error(err); }
}

async function deleteUser(username) {
  if (username === "ADMIN") {
    alert("기본 관리자 계정 (ADMIN)은 삭제할 수 없습니다.");
    return;
  }
  if (!confirm(`정말 계정 (${username})을 삭제하시겠습니까?`)) return;

  try {
    const res = await fetch(`${API_BASE_URL}/users/delete?username=${username}`, { method: "DELETE" });
    if (res.ok) {
      alert("계정이 삭제되었습니다.");
      fetchUsers();
    }
  } catch (err) { console.error(err); }
}

function closeModal(modalId) {
  const elem = document.getElementById(modalId);
  if (elem) {
    elem.classList.remove("active");
    elem.style.display = "none";
    elem.scrollTop = 0;
    const body = elem.querySelector(".modal-body");
    if (body) body.scrollTop = 0;
    const content = elem.querySelector(".modal-content");
    if (content) content.scrollTop = 0;
  }
}
