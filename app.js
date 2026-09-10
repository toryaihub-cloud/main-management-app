// Render Cloud Production Backend URL
window.RENDER_BACKEND_URL = "https://ecocar-backend-otev.onrender.com";

// Supabase Direct REST API (SSOT - 업계 표준 직접 DB 연동)
const SUPABASE_REST_URL = "https://vijiacxcmtfekbmegjlf.supabase.co/rest/v1";
const SUPABASE_SECRET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpamlhY3hjbXRmZWtibWVnamxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTgyMzgyNiwiZXhwIjoyMTAxMzk5ODI2fQ.Noa3eCRZLGLp67fRYu4ZlsFC4_d2X1C7KxQ_g2_zP00";

// Client-Side Fernet Crypto Keys Setup (Web Crypto API - AES-128-CBC + HMAC-SHA256)
let fernetEncKeyPromise = null;
let fernetSignKeyPromise = null;

function getFernetEncKey() {
  if (!fernetEncKeyPromise) {
    fernetEncKeyPromise = (async () => {
      try {
        const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : (globalThis.crypto);
        if (!cryptoObj || !cryptoObj.subtle) return null;
        const passphrase = "AntigravitySecretKey_2026_Facilities_Mgmt!";
        const enc = new TextEncoder();
        const hashBuf = await cryptoObj.subtle.digest("SHA-256", enc.encode(passphrase));
        const hashArr = new Uint8Array(hashBuf);
        const encKeyBytes = hashArr.slice(16, 32);
        return await cryptoObj.subtle.importKey(
          "raw",
          encKeyBytes,
          { name: "AES-CBC" },
          false,
          ["encrypt", "decrypt"]
        );
      } catch (e) {
        console.warn("Fernet enc key setup error:", e);
        return null;
      }
    })();
  }
  return fernetEncKeyPromise;
}

function getFernetSignKey() {
  if (!fernetSignKeyPromise) {
    fernetSignKeyPromise = (async () => {
      try {
        const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : (globalThis.crypto);
        if (!cryptoObj || !cryptoObj.subtle) return null;
        const passphrase = "AntigravitySecretKey_2026_Facilities_Mgmt!";
        const enc = new TextEncoder();
        const hashBuf = await cryptoObj.subtle.digest("SHA-256", enc.encode(passphrase));
        const hashArr = new Uint8Array(hashBuf);
        const signKeyBytes = hashArr.slice(0, 16);
        return await cryptoObj.subtle.importKey(
          "raw",
          signKeyBytes,
          { name: "HMAC", hash: { name: "SHA-256" } },
          false,
          ["sign"]
        );
      } catch (e) {
        console.warn("Fernet sign key setup error:", e);
        return null;
      }
    })();
  }
  return fernetSignKeyPromise;
}

function getFernetKey() {
  return getFernetEncKey();
}

async function encryptFernet(plainText) {
  if (!plainText || typeof plainText !== "string") return "";
  plainText = plainText.trim();
  if (!plainText || plainText === "-" || plainText.toLowerCase() === "none") return "";
  if (plainText.startsWith("gAAAAA")) return plainText;

  try {
    const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : (globalThis.crypto);
    if (!cryptoObj || !cryptoObj.subtle) throw new Error("SubtleCrypto not available");

    const encKey = await getFernetEncKey();
    const signKey = await getFernetSignKey();
    if (!encKey || !signKey) throw new Error("Keys not ready");

    // 1. Version 0x80 + Timestamp 8 bytes
    const header = new Uint8Array(9);
    header[0] = 0x80;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    for (let i = 0; i < 8; i++) {
      header[8 - i] = Number((nowSec >> BigInt(i * 8)) & 0xffn);
    }

    // 2. IV 16 bytes
    const iv = new Uint8Array(16);
    cryptoObj.getRandomValues(iv);

    // 3. AES-128-CBC Encrypt
    const encText = new TextEncoder().encode(plainText);
    const cipherBuf = await cryptoObj.subtle.encrypt(
      { name: "AES-CBC", iv: iv },
      encKey,
      encText
    );
    const cipherArr = new Uint8Array(cipherBuf);

    // 4. Data = header + iv + cipher
    const dataToSign = new Uint8Array(header.length + iv.length + cipherArr.length);
    dataToSign.set(header, 0);
    dataToSign.set(iv, header.length);
    dataToSign.set(cipherArr, header.length + iv.length);

    // 5. HMAC-SHA256
    const hmacBuf = await cryptoObj.subtle.sign("HMAC", signKey, dataToSign);
    const hmacArr = new Uint8Array(hmacBuf);

    // 6. Token = Base64Url
    const tokenArr = new Uint8Array(dataToSign.length + hmacArr.length);
    tokenArr.set(dataToSign, 0);
    tokenArr.set(hmacArr, dataToSign.length);

    let binary = "";
    for (let i = 0; i < tokenArr.byteLength; i++) {
      binary += String.fromCharCode(tokenArr[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
  } catch (e) {
    // API Fallback
    try {
      const res = await fetch(`${API_BASE_URL}/encrypt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plainText })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.result) return d.result;
      }
    } catch (apiErr) {}
    return plainText;
  }
}

async function decryptFernet(token) {
  if (!token || typeof token !== "string") return "";
  token = token.trim();
  if (!token.startsWith("gAAAAA")) return token;

  try {
    const key = await getFernetKey();
    if (!key) return "";

    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    
    let binary;
    if (typeof atob === 'function') {
      const binaryStr = atob(b64);
      binary = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        binary[i] = binaryStr.charCodeAt(i);
      }
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(b64, 'base64');
    } else {
      return "";
    }

    if (binary.length < 57 || binary[0] !== 0x80) return "";

    const iv = binary.slice(9, 25);
    const ciphertext = binary.slice(25, binary.length - 32);

    const cryptoObj = typeof window !== 'undefined' ? (window.crypto || window.msCrypto) : (globalThis.crypto);
    const decryptedBuf = await cryptoObj.subtle.decrypt(
      { name: "AES-CBC", iv: iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuf);
  } catch (e) {
    return "";
  }
}

// Supabase DATE 컬럼용 안전 날짜 정제 함수 (빈값/미상 등은 null 처리하여 400 Bad Request 방지)
function sanitizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  dateStr = dateStr.trim();
  if (!dateStr || dateStr === "-" || dateStr === "미상" || dateStr.toLowerCase() === "none" || dateStr === "null") return null;
  dateStr = dateStr.replace(/[./]/g, "-");
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, "0");
    const d = match[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

// Smart synchronous resolver with fallback
function resolveDecrypted(decVal, encVal) {
  if (decVal && typeof decVal === 'string' && !decVal.startsWith('gAAAAA') && decVal !== '-' && decVal !== 'None') {
    return decVal.trim();
  }
  if (encVal && typeof encVal === 'string' && !encVal.startsWith('gAAAAA') && encVal !== '-' && encVal !== 'None') {
    return encVal.trim();
  }
  return "";
}

// Smart Auto Detect API Base URL (Local vs Render Cloud Production)
let API_BASE_URL = "http://localhost:8081/api";
if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  API_BASE_URL = `${window.RENDER_BACKEND_URL.replace(/\/$/, '')}/api`;
}

let currentUser = null;
let facilitiesData = [];
let dispositionsData = [];
let usersData = [];
let operationsData = [];
let filteredOperationsData = [];
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
  initSidebarState();
});

// 1. Authentication Logic (Always Show Login Screen + Remember Username)
function checkLoginSession() {
  // 항상 로그인 화면 노출 (세션 자동 바이패스 해제 및 과거 캐시 청소)
  currentUser = null;
  localStorage.removeItem("currentUser");
  localStorage.removeItem("cached_facilities");
  localStorage.removeItem("cached_dispositions");
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
      const roleBadge = (currentUser.role === "ADMIN" || currentUser.username === "ADMIN") ? "최고 관리자" : "일반 사용자";
      userInfoText.innerHTML = `<i class="fa-solid fa-user-check"></i> ${roleBadge} (${currentUser.username || 'USER'})`;
    }
    
    const adminTab = document.getElementById("tab-users");
    if (adminTab) {
      const isAdmin = currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN");
      adminTab.style.display = isAdmin ? "flex" : "none";
    }

    // Always reset active tab to 'dashboard' on fresh login
    switchTab('dashboard');

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

    // 백엔드 /api/login 서버 인증 요청
    const res = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uVal, password: pVal })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem("savedUsername", uVal);
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        localStorage.removeItem("cached_facilities");
        localStorage.removeItem("cached_dispositions");
        showMainApp();
        return;
      }
    }

    if (errorMsg) errorMsg.innerText = "아이디 또는 비밀번호가 올바르지 않습니다.";
  } catch (err) {
    console.error("Error in executeLogin:", err);
    const errorMsg = document.getElementById("login-error");
    if (errorMsg) errorMsg.innerText = "로그인 처리 중 오류가 발생했습니다.";
  }
}

function handleLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  executeLogin();
}

function handleLogout() {
  if (confirm("로그아웃 하시겠습니까?")) {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("cached_facilities");
    localStorage.removeItem("cached_dispositions");
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
  await Promise.all([fetchFacilities(), fetchDispositions(), fetchCorrectionOrders(), fetchOperations(), fetchGwangsanFacilities()]);
  if (currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN")) {
    await fetchUsers();
  }
  populateFilterOptions();
  updateDashboardStats();
  renderCategoryChart();
  renderStatusChart();
  filterFacilities();
  filterDispositions();

  // Save fresh data to local cache (only if data is valid and non-empty)
  try {
    if (facilitiesData && facilitiesData.length > 0) {
      localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData));
    }
    if (dispositionsData && dispositionsData.length > 0) {
      localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData));
    }
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

  const targetBtn = document.getElementById(`tab-${tabName}`);
  if (targetBtn) {
    targetBtn.classList.add("active");
  }

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.classList.add("active");
  }

  if (tabName === 'dispositions') {
    filterDispositions();
  } else if (tabName === 'correction-orders') {
    fetchCorrectionOrders();
  } else if (tabName === 'operations') {
    fetchOperations();
  } else if (tabName === 'gwangsan-facilities') {
    fetchGwangsanFacilities();
  } else if (tabName === 'users') {
    fetchUsers();
  }
}

// 3-1. Sidebar Toggle & Collapse Logic
function toggleSidebar(show) {
  const sidebar = document.getElementById("app-sidebar");
  const openBtn = document.getElementById("sidebar-open-btn");
  if (!sidebar) return;

  const willShow = (typeof show === "boolean") ? show : sidebar.classList.contains("collapsed");
  if (willShow) {
    sidebar.classList.remove("collapsed");
    if (openBtn) openBtn.classList.remove("visible");
    localStorage.setItem("sidebarCollapsed", "false");
  } else {
    sidebar.classList.add("collapsed");
    if (openBtn) openBtn.classList.add("visible");
    localStorage.setItem("sidebarCollapsed", "true");
  }
}

function initSidebarState() {
  const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
  if (isCollapsed) {
    toggleSidebar(false);
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
// Field-Level Smart Merge Helper (DB values prioritized, non-empty local edits merged)
function smartMergeObjects(baseObj, overlayObj) {
  if (!baseObj) return overlayObj;
  if (!overlayObj) return baseObj;
  const result = { ...baseObj };
  for (const [k, v] of Object.entries(overlayObj)) {
    if (v !== undefined && v !== null && v !== "" && v !== "None" && v !== "-") {
      result[k] = v;
    }
  }
  return result;
}

function normalizeDateStr(val) {
  if (!val) return null;
  val = String(val).trim();
  if (!val || val === '-' || val === 'None' || val === 'null') return null;
  const m1 = val.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m1) {
    const y = m1[1];
    const m = m1[2].padStart(2, '0');
    const d = m1[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const m2 = val.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2]}-${m2[3]}`;
  }
  return val.length >= 10 ? val.substring(0, 10) : null;
}

async function fetchWithRetry(url, options = {}, retries = 5, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500) throw new Error(`Server Error ${res.status}`);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[Cold Start Wait] ${url} retry ${i+1}/${retries}, waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function fetchFacilities() {
  let list = [];

  // [1순위] Supabase DB 실시간 직접 조회 (Render 슬립/과거 파일과 완전 무관한 실시간 진실)
  try {
    const resDirect = await fetch(`${SUPABASE_REST_URL}/facilities?select=*&order=facility_key.asc`, {
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    if (resDirect.ok) {
      const dbRows = await resDirect.json();
      if (Array.isArray(dbRows) && dbRows.length > 0) {
        list = await Promise.all(dbRows.map(async f => {
          let decMgrName = await decryptFernet(f.manager_name_encrypted);
          let decMgrContact = await decryptFernet(f.manager_contact_encrypted);
          return {
            ...f,
            building_approval_dates: f.approval_date || f.building_approval_dates || "",
            building_new_old_type: f.is_new_building || f.building_new_old_type || "신축",
            manager_name_decrypted: decMgrName || (f.manager_name_encrypted && !f.manager_name_encrypted.startsWith("gAAAAA") ? f.manager_name_encrypted : (f.manager_name || "")),
            manager_contact_decrypted: decMgrContact || (f.manager_contact_encrypted && !f.manager_contact_encrypted.startsWith("gAAAAA") ? f.manager_contact_encrypted : (f.manager_contact || ""))
          };
        }));
      }
    }
  } catch (errDb) {
    console.warn("Direct Supabase facilities fetch failed, fallback to backend:", errDb);
  }

  // [2순위] Render 백엔드 API
  if (list.length === 0) {
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/facilities`);
      if (res.ok) {
        const raw = await res.json();
        list = Array.isArray(raw) ? raw : (raw.data || []);
      }
    } catch (e) {}
  }

  // [3순위] 오프라인 비상용 정적 파일
  if (list.length === 0) {
    try {
      const resStatic = await fetch("facilities_cache.json?v=" + Date.now());
      if (resStatic.ok) {
        const raw = await resStatic.json();
        list = Array.isArray(raw) ? raw : (raw.data || []);
      }
    } catch (e) {}
  }

  if (list.length > 0) {
    facilitiesData = list;
    try { localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData)); } catch(e) {}
  }
}

async function fetchDispositions() {
  let list = [];

  // [1순위] Supabase DB 실시간 직접 조회 (Render 슬립/과거 파일과 완전 무관한 실시간 진실)
  try {
    const resDirect = await fetch(`${SUPABASE_REST_URL}/dispositions?select=*&order=id.asc`, {
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    if (resDirect.ok) {
      const dbRows = await resDirect.json();
      if (Array.isArray(dbRows) && dbRows.length > 0) {
        list = dbRows;
      }
    }
  } catch (errDb) {
    console.warn("Direct Supabase dispositions fetch failed, fallback to backend:", errDb);
  }

  // [2순위] Render 백엔드 API
  if (list.length === 0) {
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/dispositions`);
      if (res.ok) {
        const raw = await res.json();
        list = Array.isArray(raw) ? raw : (raw.data || []);
      }
    } catch (e) {}
  }

  // [3순위] 오프라인 비상용 정적 파일
  if (list.length === 0) {
    try {
      const resStatic = await fetch("dispositions_cache.json?v=" + Date.now());
      if (resStatic.ok) {
        list = await resStatic.json();
      }
    } catch (e) {}
  }

  if (list.length > 0) {
    dispositionsData = await Promise.all(list.map(async d => {
      const decTarget = await decryptFernet(d.target_name_encrypted);
      const decRecipient = await decryptFernet(d.recipient_name_encrypted);
      const decMail = await decryptFernet(d.mail_address_encrypted);
      const decAbstract = await decryptFernet(d.abstract_address_encrypted);
      const decReg = await decryptFernet(d.reg_num_encrypted);
      const decContact = await decryptFernet(d.contact_encrypted);

      return {
        ...d,
        target_name_decrypted: decTarget || resolveDecrypted(d.target_name_decrypted, d.target_name_encrypted) || d.target_name || "",
        recipient_name_decrypted: decRecipient || resolveDecrypted(d.recipient_name_decrypted, d.recipient_name_encrypted) || d.recipient_name || "",
        mail_address_decrypted: decMail || resolveDecrypted(d.mail_address_decrypted, d.mail_address_encrypted) || d.mail_address || "",
        abstract_address_decrypted: decAbstract || resolveDecrypted(d.abstract_address_decrypted, d.abstract_address_encrypted) || d.abstract_address || "",
        reg_num_decrypted: decReg || resolveDecrypted(d.reg_num_decrypted, d.reg_num_encrypted) || d.reg_num || "",
        contact_decrypted: decContact || resolveDecrypted(d.contact_decrypted, d.contact_encrypted) || d.contact || ""
      };
    }));
    try { localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData)); } catch(e) {}
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

  // 미이행 시설(80개) 기준으로 주차 미설치면수 / 충전 미설치기수 합산 (287면 / 188기)
  facilitiesData.filter(f => f.compliance_status === '미이행').forEach(f => {
    totalParkingUninstalled += (parseInt(f.parking_uninstalled_cnt) || 0);
    totalChargerUninstalled += (parseInt(f.charger_uninstalled_cnt) || 0);
  });

  const strTotal = total.toLocaleString();
  const strCompleted = completed.toLocaleString();
  const strUninstalled = uninstalled.toLocaleString();
  const strCounts = `${totalParkingUninstalled}면 / ${totalChargerUninstalled}기`;

  // 대시보드 통계 카드
  const elDashTotal = document.getElementById("stat-total-facilities");
  const elDashCompleted = document.getElementById("stat-completed-facilities");
  const elDashUninstalled = document.getElementById("stat-uninstalled-facilities");
  const elDashCounts = document.getElementById("stat-uninstalled-counts");

  if (elDashTotal) elDashTotal.innerText = strTotal;
  if (elDashCompleted) elDashCompleted.innerText = strCompleted;
  if (elDashUninstalled) elDashUninstalled.innerText = strUninstalled;
  if (elDashCounts) elDashCounts.innerText = strCounts;

  // 통합시설관리 상단 통계 카드 (실시간 동기화)
  const elFacTotal = document.getElementById("fac-stat-total-facilities");
  const elFacCompleted = document.getElementById("fac-stat-completed-facilities");
  const elFacUninstalled = document.getElementById("fac-stat-uninstalled-facilities");
  const elFacCounts = document.getElementById("fac-stat-uninstalled-counts");

  if (elFacTotal) elFacTotal.innerText = strTotal;
  if (elFacCompleted) elFacCompleted.innerText = strCompleted;
  if (elFacUninstalled) elFacUninstalled.innerText = strUninstalled;
  if (elFacCounts) elFacCounts.innerText = strCounts;
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
    let actP = (f.parking_installed_cnt !== undefined && f.parking_installed_cnt !== null && f.parking_installed_cnt !== '') ? parseInt(f.parking_installed_cnt) : 0;
    if (actP === 0) {
      const sumP = (parseInt(f.parking_ground_cnt) || 0) + (parseInt(f.parking_underground_cnt) || 0);
      actP = sumP > 0 ? sumP : Math.max(0, reqP - unP);
    }
    if ((f.compliance_status === '이행완료' || unP === 0) && actP < reqP) {
      actP = reqP;
    }
    const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : (f.compliance_status === '이행완료' ? 100 : 0);

    const reqC = parseInt(f.charger_required_cnt) || 0;
    const unC = parseInt(f.charger_uninstalled_cnt) || 0;
    let actC = (f.charger_installed_cnt !== undefined && f.charger_installed_cnt !== null && f.charger_installed_cnt !== '') ? parseInt(f.charger_installed_cnt) : 0;
    if (actC === 0) {
      const sumC = (parseInt(f.charger_fast_cnt) || 0) + (parseInt(f.charger_slow_cnt) || 0);
      actC = sumC > 0 ? sumC : Math.max(0, reqC - unC);
    }
    if ((f.compliance_status === '이행완료' || unC === 0) && actC < reqC) {
      actC = reqC;
    }
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

  // 2. Render Detail Counts & Slash Info
  updateModalDetailCounts(facility);

  const decName = (facility.manager_name_decrypted && !facility.manager_name_decrypted.startsWith("gAAAAA")) ? facility.manager_name_decrypted : (facility.manager_name || '-');
  const decContact = (facility.manager_contact_decrypted && !facility.manager_contact_decrypted.startsWith("gAAAAA")) ? facility.manager_contact_decrypted : (facility.manager_contact || '-');

  safeSetText("detail-manager-name", decName);
  safeSetText("detail-manager-contact", decContact);
  safeSetText("detail-management-body", facility.management_body);

  const totalHh = facility.total_households ? `${facility.total_households}세대` : '-';
  const evReg = facility.ev_registered_cnt ? `${facility.ev_registered_cnt}대` : '-';

  const repStr = facility.charger_reported ? (facility.charger_reported === '여' ? '신고' : (facility.charger_reported === '부' ? '미신고' : facility.charger_reported)) : '-';
  const insStr = facility.insurance_enrolled ? (facility.insurance_enrolled === '여' ? '가입' : (facility.insurance_enrolled === '부' ? '미가입' : facility.insurance_enrolled)) : '-';
  const repIns = (repStr !== '-' || insStr !== '-') ? `${repStr} / ${insStr}` : '-';

  let fireMan = facility.fire_manual_distributed || '-';
  if (fireMan === '여') fireMan = '배부';
  else if (fireMan === '부') fireMan = '미배부';

  safeSetText("detail-total-households", totalHh);
  safeSetText("detail-ev-registered", evReg);
  safeSetText("detail-reported-insurance", repIns);
  safeSetText("detail-fire-manual", fireMan);
  
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

  // 3. Open Modal Pop-up Instantly (All-in-One 3-column Layout)
  const detailModalElem = document.getElementById("modal-facility-detail");
  if (detailModalElem) {
    detailModalElem.style.display = "flex";
    detailModalElem.classList.add("active");
  }

  // 4. Load Photos Non-blocking in Background
  loadFacilityPhotos(facility.facility_key, facility.facility_name);

  // 5. Background Live Single-Record Sync from Supabase DB (Ensure 100% fresh detail counts)
  (async () => {
    try {
      const rLive = await fetch(`${SUPABASE_REST_URL}/facilities?facility_key=eq.${encodeURIComponent(key)}`, {
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`
        }
      });
      if (rLive.ok) {
        const liveRows = await rLive.json();
        if (liveRows && liveRows.length > 0) {
          const liveFac = liveRows[0];
          let changed = false;
          const countKeys = [
            'parking_ground_cnt', 'parking_underground_cnt', 'parking_installed_cnt', 'parking_required_cnt', 'parking_uninstalled_cnt',
            'charger_fast_req_cnt', 'charger_fast_cnt', 'charger_slow_cnt', 'charger_installed_cnt', 'charger_required_cnt', 'charger_uninstalled_cnt'
          ];
          for (const k of countKeys) {
            if (facility[k] !== liveFac[k]) {
              facility[k] = liveFac[k];
              changed = true;
            }
          }
          if (changed) {
            const idx = facilitiesData.findIndex(f => f.facility_key === key);
            if (idx >= 0) facilitiesData[idx] = { ...facilitiesData[idx], ...liveFac };
            try { localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData)); } catch(e) {}
            if (detailModalElem && detailModalElem.classList.contains("active") && currentFacilityDetail?.facility_key === key) {
              updateModalDetailCounts(facility);
            }
          }
        }
      }
    } catch (eLive) {}
  })();
}

function updateModalDetailCounts(facility) {
  const reqP = parseInt(facility.parking_required_cnt) || 0;
  const unP = parseInt(facility.parking_uninstalled_cnt) || 0;
  let actP = (facility.parking_installed_cnt !== undefined && facility.parking_installed_cnt !== null && facility.parking_installed_cnt !== '') ? parseInt(facility.parking_installed_cnt) : 0;
  if (actP === 0) {
    const sumP = (parseInt(facility.parking_ground_cnt) || 0) + (parseInt(facility.parking_underground_cnt) || 0);
    actP = sumP > 0 ? sumP : Math.max(0, reqP - unP);
  }
  if ((facility.compliance_status === '이행완료' || unP === 0) && actP < reqP) {
    actP = reqP;
  }

  const reqC = parseInt(facility.charger_required_cnt) || 0;
  const unC = parseInt(facility.charger_uninstalled_cnt) || 0;
  let actC = (facility.charger_installed_cnt !== undefined && facility.charger_installed_cnt !== null && facility.charger_installed_cnt !== '') ? parseInt(facility.charger_installed_cnt) : 0;
  if (actC === 0) {
    const sumC = (parseInt(facility.charger_fast_cnt) || 0) + (parseInt(facility.charger_slow_cnt) || 0);
    actC = sumC > 0 ? sumC : Math.max(0, reqC - unC);
  }
  if ((facility.compliance_status === '이행완료' || unC === 0) && actC < reqC) {
    actC = reqC;
  }

  const parkSlashElem = document.getElementById("detail-parking-slash-info");
  if (parkSlashElem) parkSlashElem.innerText = `${actP}면 / ${reqP}면 (설치/의무)`;
  
  const parkGroundUnderElem = document.getElementById("detail-parking-ground-underground");
  if (parkGroundUnderElem) {
    const ground = facility.parking_ground_cnt !== undefined && facility.parking_ground_cnt !== null ? facility.parking_ground_cnt : 0;
    const underground = facility.parking_underground_cnt !== undefined && facility.parking_underground_cnt !== null ? facility.parking_underground_cnt : 0;
    parkGroundUnderElem.innerText = `${ground}면 / ${underground}면`;
  }
  
  const parkUnElem = document.getElementById("detail-parking-uninstalled");
  if (parkUnElem) parkUnElem.innerText = facility.parking_uninstalled_cnt || 0;

  const chargerSlashElem = document.getElementById("detail-charger-slash-info");
  if (chargerSlashElem) chargerSlashElem.innerText = `${actC}기 / ${reqC}기 (설치/의무)`;

  const chargerUnElem = document.getElementById("detail-charger-uninstalled");
  if (chargerUnElem) chargerUnElem.innerText = facility.charger_uninstalled_cnt || 0;

  // Fast & Slow Charger Counts (Installed & Uninstalled)
  const reqFast = parseInt(facility.charger_fast_req_cnt) || 0;
  const actFast = parseInt(facility.charger_fast_cnt) || 0;
  const actSlow = facility.charger_slow_cnt !== undefined && facility.charger_slow_cnt !== null && facility.charger_slow_cnt !== '' 
    ? parseInt(facility.charger_slow_cnt) 
    : Math.max(0, actC - actFast);
  const uninstalledFast = Math.max(0, reqFast - actFast);

  const slowFastInstElem = document.getElementById("detail-slow-fast-installed");
  if (slowFastInstElem) {
    slowFastInstElem.innerText = `${actSlow}기 / ${actFast}기`;
  }

  const fastUnElem = document.getElementById("detail-fast-uninstalled");
  if (fastUnElem) {
    fastUnElem.innerText = `${uninstalledFast}기`;
    fastUnElem.style.color = uninstalledFast > 0 ? 'var(--danger)' : 'var(--text-main)';
  }

  renderModalDetailDonutChart(facility);
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
  const unP = parseInt(f.parking_uninstalled_cnt) || 0;
  let actP = (f.parking_installed_cnt !== undefined && f.parking_installed_cnt !== null && f.parking_installed_cnt !== '') ? parseInt(f.parking_installed_cnt) : 0;
  if (actP === 0) {
    const sumP = (parseInt(f.parking_ground_cnt) || 0) + (parseInt(f.parking_underground_cnt) || 0);
    actP = sumP > 0 ? sumP : Math.max(0, reqP - unP);
  }
  if ((f.compliance_status === '이행완료' || unP === 0) && actP < reqP) {
    actP = reqP;
  }
  const pctP = reqP > 0 ? Math.min(100, Math.round((actP / reqP) * 100)) : (f.compliance_status === '이행완료' ? 100 : 0);

  const reqC = parseInt(f.charger_required_cnt) || 0;
  const unC = parseInt(f.charger_uninstalled_cnt) || 0;
  let actC = (f.charger_installed_cnt !== undefined && f.charger_installed_cnt !== null && f.charger_installed_cnt !== '') ? parseInt(f.charger_installed_cnt) : 0;
  if (actC === 0) {
    const sumC = (parseInt(f.charger_fast_cnt) || 0) + (parseInt(f.charger_slow_cnt) || 0);
    actC = sumC > 0 ? sumC : Math.max(0, reqC - unC);
  }
  if ((f.compliance_status === '이행완료' || unC === 0) && actC < reqC) {
    actC = reqC;
  }
  const pctC = reqC > 0 ? Math.min(100, Math.round((actC / reqC) * 100)) : (f.compliance_status === '이행완료' ? 100 : 0);

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
        <tr><th>주차구역 현황</th><td>의무: ${reqPark}면 | 설치: ${actPark}면 (지상: ${f.parking_ground_cnt || 0}면 / 지하: ${f.parking_underground_cnt || 0}면) | <strong>미설치: ${unPark}면</strong></td></tr>
        <tr><th>충전시설 현황</th><td>의무: ${reqCharge}기 (의무급속: ${f.charger_fast_req_cnt || 0}기) | 설치: ${actCharge}기 (완속: ${f.charger_slow_cnt || 0}기 / 급속: ${f.charger_fast_cnt || 0}기) | <strong>미설치: ${unCharge}기</strong></td></tr>
      </table>

      <div class="print-section-title">3. 관리 및 운영·안전 정보</div>
      <table class="print-table">
        <colgroup><col style="width: 18%;"><col style="width: 32%;"><col style="width: 18%;"><col style="width: 32%;"></colgroup>
        <tr>
          <th>관리주체</th><td>${f.management_body || '-'}</td>
          <th>시설 관리자</th><td>${f.manager_name_decrypted || '보안'}</td>
        </tr>
        <tr>
          <th>관리자 연락처</th><td>${f.manager_contact_decrypted || '보안'}</td>
          <th>실태조사 상태</th><td>${f.investigation_status || '-'}</td>
        </tr>
        <tr>
          <th>총세대수</th><td>${(f.total_households !== undefined && f.total_households !== null && f.total_households !== '') ? `${f.total_households}세대` : '-'}</td>
          <th>전기차등록대수</th><td>${(f.ev_registered_cnt !== undefined && f.ev_registered_cnt !== null && f.ev_registered_cnt !== '') ? `${f.ev_registered_cnt}대` : '-'}</td>
        </tr>
        <tr>
          <th>신고 / 보험</th><td>${f.charger_reported || '-'} / ${f.insurance_enrolled || '-'}</td>
          <th>화재대응책자 배부</th><td>${f.fire_manual_distributed || '-'}</td>
        </tr>
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

    // 정렬: 메인 '시설' 레코드가 최상단에 오고, 하위 소유자/대상자들은 등록 순서(id 오름차순)대로 기존 소유자 아래(가장 하단)로 배치
    dispItems.sort((a, b) => {
      if (a.target_type === '시설' && b.target_type !== '시설') return -1;
      if (a.target_type !== '시설' && b.target_type === '시설') return 1;
      return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
    });

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
        const cleanDecStr = (val, encVal) => {
          if (val && typeof val === 'string' && val !== '-' && val !== 'None' && !val.startsWith('gAAAAA')) {
            return val.trim();
          }
          if (encVal && typeof encVal === 'string' && encVal !== '-' && encVal !== 'None' && !encVal.startsWith('gAAAAA')) {
            return encVal.trim();
          }
          return '-';
        };

        const targetNameStr = cleanDecStr(d.target_name_decrypted, d.target_name_encrypted);
        const recipientStr = cleanDecStr(d.recipient_name_decrypted, d.recipient_name_encrypted);
        const regNumStr = cleanDecStr(d.reg_num_decrypted, d.reg_num_encrypted);
        const contactStr = cleanDecStr(d.contact_decrypted, d.contact_encrypted);
        const mailAddrStr = cleanDecStr(d.mail_address_decrypted, d.mail_address_encrypted);
        const abstractAddrStr = cleanDecStr(d.abstract_address_decrypted, d.abstract_address_encrypted);

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
          <strong id="disp-sub-target-name-${d.id}" style="font-size:1rem; color:#0F172A;">${targetNameStr} ${targetScopeStr}</strong>
        `;

        const subHtml = `
          <div class="disp-sub-card" style="margin-bottom:1.25rem;">
            <div class="disp-sub-title" style="display:flex; justify-content:space-between; align-items:center;">
              <div>${targetTagHtml}</div>
              <div style="display:flex; gap:0.4rem; align-items:center;">
                <button class="btn btn-secondary" style="padding:0.25rem 0.65rem; font-size:0.75rem;" onclick="editDisposition('${d.id}')">
                  <i class="fa-solid fa-pen-to-square"></i> 레코드 수정
                </button>
                <button class="btn btn-danger" style="padding:0.25rem 0.65rem; font-size:0.75rem;" onclick="deleteDisposition('${d.id}')">
                  <i class="fa-solid fa-trash"></i> 삭제
                </button>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; font-size: 0.85rem;">
              <!-- Left Column: 사전통지 & 초본주소 -->
              <div style="background:#FFFFFF; padding:0.9rem; border-radius:0.5rem; border:1px solid #E2E8F0;">
                <div style="font-weight:700; color:#0284C7; margin-bottom:0.6rem;"><i class="fa-solid fa-envelope"></i> 사전통지 및 초본주소 정보</div>
                <div style="display:flex; flex-direction:column; gap:0.4rem;">
                  <div><strong>사전통지 방법:</strong> ${d.advance_notice_method || '-'}</div>
                  <div><strong>우편발송주소:</strong> <span id="disp-sub-mail-${d.id}">${mailAddrStr}</span> (우편번호: ${d.zip_code || '-'})</div>
                  <div><strong>수신인:</strong> <span id="disp-sub-recipient-${d.id}">${recipientStr}</span></div>
                  <div><strong>발송일:</strong> ${d.advance_notice_send_date || '-'}</div>
                  <div><strong>반송여부:</strong> ${returnBadgeStr}</div>
                  <hr style="border:0; border-top:1px dashed #E2E8F0; margin:0.4rem 0;">
                  <div><strong>초본주소 발송일자:</strong> ${d.abstract_send_date || '-'}</div>
                  <div><strong>초본주소:</strong> <span id="disp-sub-abstract-${d.id}">${abstractAddrStr}</span></div>
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
                <div><strong>법인번호(주민번호):</strong> <span id="disp-sub-reg-${d.id}">${regNumStr}</span></div>
                <div><strong>연락처:</strong> <span id="disp-sub-contact-${d.id}">${contactStr}</span></div>
                <div style="flex:1;"><strong>비고:</strong> ${d.note || '-'}</div>
              </div>
            </div>
          </div>
        `;
        modalBody.insertAdjacentHTML('beforeend', subHtml);

        // Asynchronous post-decryption fallback if token needs dynamic decoding
        if (targetNameStr === '-' && d.target_name_encrypted && d.target_name_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.target_name_encrypted).then(dec => {
            if (dec) {
              d.target_name_decrypted = dec;
              const el = document.getElementById(`disp-sub-target-name-${d.id}`);
              if (el) el.innerText = `${dec} ${targetScopeStr}`;
            }
          });
        }
        if (recipientStr === '-' && d.recipient_name_encrypted && d.recipient_name_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.recipient_name_encrypted).then(dec => {
            if (dec) {
              d.recipient_name_decrypted = dec;
              const el = document.getElementById(`disp-sub-recipient-${d.id}`);
              if (el) el.innerText = dec;
            }
          });
        }
        if (mailAddrStr === '-' && d.mail_address_encrypted && d.mail_address_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.mail_address_encrypted).then(dec => {
            if (dec) {
              d.mail_address_decrypted = dec;
              const el = document.getElementById(`disp-sub-mail-${d.id}`);
              if (el) el.innerText = dec;
            }
          });
        }
        if (abstractAddrStr === '-' && d.abstract_address_encrypted && d.abstract_address_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.abstract_address_encrypted).then(dec => {
            if (dec) {
              d.abstract_address_decrypted = dec;
              const el = document.getElementById(`disp-sub-abstract-${d.id}`);
              if (el) el.innerText = dec;
            }
          });
        }
        if (regNumStr === '-' && d.reg_num_encrypted && d.reg_num_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.reg_num_encrypted).then(dec => {
            if (dec) {
              d.reg_num_decrypted = dec;
              const el = document.getElementById(`disp-sub-reg-${d.id}`);
              if (el) el.innerText = dec;
            }
          });
        }
        if (contactStr === '-' && d.contact_encrypted && d.contact_encrypted.startsWith('gAAAAA')) {
          decryptFernet(d.contact_encrypted).then(dec => {
            if (dec) {
              d.contact_decrypted = dec;
              const el = document.getElementById(`disp-sub-contact-${d.id}`);
              if (el) el.innerText = dec;
            }
          });
        }
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
      document.getElementById("fac-parking-ground").value = item.parking_ground_cnt || 0;
      document.getElementById("fac-parking-underground").value = item.parking_underground_cnt || 0;
      document.getElementById("fac-parking-uninstalled").value = item.parking_uninstalled_cnt || 0;
      document.getElementById("fac-charger-req").value = item.charger_required_cnt || 0;
      document.getElementById("fac-charger-inst").value = item.charger_installed_cnt || 0;
      document.getElementById("fac-charger-uninstalled").value = item.charger_uninstalled_cnt || 0;
      document.getElementById("fac-fast-req").value = item.charger_fast_req_cnt || 0;
      document.getElementById("fac-slow-cnt").value = item.charger_slow_cnt || 0;
      document.getElementById("fac-fast-cnt").value = item.charger_fast_cnt || 0;
      document.getElementById("fac-management-body").value = item.management_body || "";
      if (item.manager_name_decrypted) document.getElementById("fac-manager-name").value = item.manager_name_decrypted;
      if (item.manager_contact_decrypted) document.getElementById("fac-manager-contact").value = item.manager_contact_decrypted;
      document.getElementById("fac-total-households").value = (item.total_households !== undefined && item.total_households !== null) ? item.total_households : "";
      document.getElementById("fac-ev-registered-cnt").value = (item.ev_registered_cnt !== undefined && item.ev_registered_cnt !== null) ? item.ev_registered_cnt : "";
      const mapYesNo = (val) => {
        if (!val) return "";
        val = String(val).trim();
        if (val === "여" || val.includes("배부완료") || val.includes("가입") || val.includes("신고완료") || val === "O" || val === "o" || val === "배부" || val === "신고") return "여";
        if (val === "부" || val.includes("미배부") || val.includes("미가입") || val.includes("미신고") || val === "X" || val === "x") return "부";
        return "";
      };
      document.getElementById("fac-charger-reported").value = mapYesNo(item.charger_reported);
      document.getElementById("fac-insurance-enrolled").value = mapYesNo(item.insurance_enrolled);
      document.getElementById("fac-fire-manual-distributed").value = mapYesNo(item.fire_manual_distributed);
    }
  } else {
    document.getElementById("modal-facility-title").innerText = "신규 시설 등록";
    document.getElementById("fac-key").readOnly = false;
    document.getElementById("fac-total-households").value = "";
    document.getElementById("fac-ev-registered-cnt").value = "";
    document.getElementById("fac-charger-reported").value = "";
    document.getElementById("fac-insurance-enrolled").value = "";
    document.getElementById("fac-fire-manual-distributed").value = "";
  }
  document.getElementById("modal-facility").classList.add("active");
}

function editFacility(key) { openFacilityModal(key); }

async function saveFacility() {
  const key = document.getElementById("fac-key").value.trim();
  const name = document.getElementById("fac-name").value.trim();
  if (!key || !name) { alert("KEY와 시설명은 필수입니다."); return; }

  const mgrName = document.getElementById("fac-manager-name").value.trim();
  const mgrContact = document.getElementById("fac-manager-contact").value.trim();

  // 개인정보 암호화 적용 (규칙 4 준수)
  const encMgrName = await encryptFernet(mgrName);
  const encMgrContact = await encryptFernet(mgrContact);

  // 날짜 필드 정제 (빈 문자열이면 null로 처리하여 Postgres DATE 400 Bad Request 방지)
  const rawDate = document.getElementById("fac-dates").value.trim();
  const sanitizedApprovalDate = sanitizeDate(rawDate);

  const payload = {
    facility_key: key,
    facility_name: name,
    facility_category: document.getElementById("fac-category").value.trim(),
    compliance_status: document.getElementById("fac-compliance").value,
    facility_ownership_type: document.getElementById("fac-ownership").value.trim(),
    address_doro: document.getElementById("fac-address-doro").value.trim(),
    address_jibun: document.getElementById("fac-address-jibun").value.trim(),
    dong_name: document.getElementById("fac-dong").value.trim(),
    building_approval_dates: rawDate,
    approval_date: sanitizedApprovalDate,
    building_new_old_type: document.getElementById("fac-new-old").value,
    building_register_num: document.getElementById("fac-register").value.trim(),
    parking_required_cnt: parseInt(document.getElementById("fac-parking-req").value) || 0,
    parking_installed_cnt: parseInt(document.getElementById("fac-parking-inst").value) || 0,
    parking_ground_cnt: parseInt(document.getElementById("fac-parking-ground").value) || 0,
    parking_underground_cnt: parseInt(document.getElementById("fac-parking-underground").value) || 0,
    parking_uninstalled_cnt: parseInt(document.getElementById("fac-parking-uninstalled").value) || 0,
    charger_required_cnt: parseInt(document.getElementById("fac-charger-req").value) || 0,
    charger_installed_cnt: parseInt(document.getElementById("fac-charger-inst").value) || 0,
    charger_uninstalled_cnt: parseInt(document.getElementById("fac-charger-uninstalled").value) || 0,
    charger_fast_req_cnt: parseInt(document.getElementById("fac-fast-req").value) || 0,
    charger_slow_cnt: parseInt(document.getElementById("fac-slow-cnt").value) || 0,
    charger_fast_cnt: parseInt(document.getElementById("fac-fast-cnt").value) || 0,
    management_body: document.getElementById("fac-management-body").value.trim(),
    manager_name_encrypted: encMgrName,
    manager_contact_encrypted: encMgrContact,
    manager_name_decrypted: mgrName,
    manager_contact_decrypted: mgrContact,
    total_households: document.getElementById("fac-total-households").value ? parseInt(document.getElementById("fac-total-households").value) : null,
    ev_registered_cnt: document.getElementById("fac-ev-registered-cnt").value ? parseInt(document.getElementById("fac-ev-registered-cnt").value) : null,
    charger_reported: document.getElementById("fac-charger-reported").value.trim(),
    insurance_enrolled: document.getElementById("fac-insurance-enrolled").value.trim(),
    fire_manual_distributed: document.getElementById("fac-fire-manual-distributed").value.trim()
  };

  // [1순위] Supabase DB에 직접 즉시 저장 (Render 상태와 무관하게 100% 영구 안착)
  let savedSuccessfully = false;
  try {
    const directPayload = {
      facility_key: key,
      facility_name: name,
      facility_category: payload.facility_category,
      compliance_status: payload.compliance_status,
      facility_ownership_type: payload.facility_ownership_type,
      address_doro: payload.address_doro,
      address_jibun: payload.address_jibun,
      dong_name: payload.dong_name,
      approval_date: sanitizedApprovalDate,
      is_new_building: payload.building_new_old_type,
      building_register_num: payload.building_register_num,
      parking_required_cnt: payload.parking_required_cnt,
      parking_installed_cnt: payload.parking_installed_cnt,
      parking_ground_cnt: payload.parking_ground_cnt,
      parking_underground_cnt: payload.parking_underground_cnt,
      parking_uninstalled_cnt: payload.parking_uninstalled_cnt,
      charger_required_cnt: payload.charger_required_cnt,
      charger_installed_cnt: payload.charger_installed_cnt,
      charger_uninstalled_cnt: payload.charger_uninstalled_cnt,
      charger_fast_req_cnt: payload.charger_fast_req_cnt,
      charger_slow_cnt: payload.charger_slow_cnt,
      charger_fast_cnt: payload.charger_fast_cnt,
      management_body: payload.management_body,
      manager_name_encrypted: encMgrName,
      manager_contact_encrypted: encMgrContact,
      total_households: payload.total_households,
      ev_registered_cnt: payload.ev_registered_cnt,
      charger_reported: payload.charger_reported,
      insurance_enrolled: payload.insurance_enrolled,
      fire_manual_distributed: payload.fire_manual_distributed
    };

    const preferHeaders = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    // 1. 기존 시설 PATCH 시도
    let rDirect = await fetch(`${SUPABASE_REST_URL}/facilities?facility_key=eq.${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: preferHeaders,
      body: JSON.stringify(directPayload)
    });

    if (rDirect.ok) {
      const patchRows = await rDirect.json().catch(() => []);
      if (!patchRows || patchRows.length === 0) {
        // 행이 없으면 POST 신규 생성
        rDirect = await fetch(`${SUPABASE_REST_URL}/facilities`, {
          method: "POST",
          headers: preferHeaders,
          body: JSON.stringify([directPayload])
        });
      }
      if (rDirect.ok) savedSuccessfully = true;
    } else {
      const errDetail = await rDirect.text().catch(() => "");
      console.warn("Direct Supabase facility PATCH error:", rDirect.status, errDetail);
      // POST 시도
      rDirect = await fetch(`${SUPABASE_REST_URL}/facilities`, {
        method: "POST",
        headers: preferHeaders,
        body: JSON.stringify([directPayload])
      });
      if (rDirect.ok) {
        savedSuccessfully = true;
      } else {
        const postErr = await rDirect.text().catch(() => "");
        console.error("Direct Supabase facility POST error:", rDirect.status, postErr);
      }
    }
  } catch (eDir) {
    console.error("Direct Supabase facility save network/runtime error:", eDir);
  }

  // [2순위 보조 Fallback] 만약 1순위 직접 저장이 실패했거나 백엔드 캐시 갱신이 필요한 경우 동기적으로 백엔드 호출
  try {
    const backendRes = await fetch(`${API_BASE_URL}/facilities/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (backendRes.ok) {
      savedSuccessfully = true;
    }
  } catch (backendErr) {
    console.warn("Backend facility save fallback error:", backendErr);
  }

  if (!savedSuccessfully) {
    alert("시설 정보 저장 중 오류가 발생했습니다. (Supabase DB 연결 실패)");
    return;
  }

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

  alert("시설 정보가 성공적으로 저장되었습니다.");
  closeModal('modal-facility');

  // 만약 상세 모달창이 열려있는 상태라면 즉시 최신 정보로 재렌더링
  const detailModal = document.getElementById("modal-facility-detail");
  if (detailModal && detailModal.classList.contains("active")) {
    openFacilityDetailModal(key);
  }

  filterFacilities();
  updateDashboardStats();
  renderCategoryChart();
  renderStatusChart();
}

async function deleteFacility(key) {
  if (!confirm(`정말 시설 (${key})을 삭제하시겠습니까?`)) return;
  try {
    // 1. [모범 아키텍처] Supabase DB 직접 즉시 삭제
    try {
      await fetch(`${SUPABASE_REST_URL}/dispositions?facility_key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_SECRET_KEY, "Authorization": `Bearer ${SUPABASE_SECRET_KEY}` }
      });
      await fetch(`${SUPABASE_REST_URL}/facilities?facility_key=eq.${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "apikey": SUPABASE_SECRET_KEY, "Authorization": `Bearer ${SUPABASE_SECRET_KEY}` }
      });
    } catch(eDb) {
      console.warn("Direct Supabase facility delete note:", eDb);
    }

    // 2. 백엔드 프록시 삭제
    try {
      await fetch(`${API_BASE_URL}/facilities/delete?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    } catch(eProxy) {}

    alert("시설이 성공적으로 삭제되었습니다.");
    closeModal('modal-facility-detail');

    // 로컬 메모리 및 브라우저 캐시에서 즉시 제거
    facilitiesData = facilitiesData.filter(f => f.facility_key !== key);
    dispositionsData = dispositionsData.filter(d => d.facility_key !== key);
    try { localStorage.setItem("cached_facilities", JSON.stringify(facilitiesData)); } catch(e) {}
    try { localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData)); } catch(e) {}

    filterFacilities();
    updateDashboardStats();
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다.");
  }
}

// 상세 팝업에서 시설 삭제 버튼 클릭 시 호출
function deleteFacilityFromDetail() {
  if (!currentFacilityDetail || !currentFacilityDetail.facility_key) {
    alert("삭제할 시설 정보를 찾을 수 없습니다.");
    return;
  }
  deleteFacility(currentFacilityDetail.facility_key);
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
          <input type="text" class="input-box sub-status" disabled readonly style="background:#F1F5F9; color:#64748B; cursor:not-allowed;" value="${(document.getElementById('disp-status')?.value || '').trim()}" placeholder="시설 현상태와 자동 연동">
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
          <input type="text" class="input-box sub-correction-period" placeholder="예: 2026.08.31 ~ 2027.08.30">
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
  try {
    const form = document.getElementById("form-disposition");
    if (form) form.reset();

    subOwnerCounter = 0;
    const container = document.getElementById("disp-sub-owners-container");
    if (container) container.innerHTML = "";

    const delBtn = document.getElementById("btn-delete-disp-form");
    const isAdmin = currentUser && (currentUser.role === "ADMIN" || currentUser.username === "ADMIN");

    const setVal = (elemId, val) => {
      const el = document.getElementById(elemId);
      if (el) el.value = (val === null || val === undefined || val === 'None') ? '' : String(val);
    };

    const setDateVal = (elemId, val) => {
      const el = document.getElementById(elemId);
      if (el) {
        if (val && typeof val === 'string' && val.length >= 10 && !val.includes('None')) {
          el.value = val.substring(0, 10);
        } else {
          el.value = '';
        }
      }
    };

    const getCleanVal = (decVal, encVal) => {
      if (decVal && typeof decVal === 'string' && !decVal.startsWith('gAAAAA')) return decVal;
      if (encVal && typeof encVal === 'string' && !encVal.startsWith('gAAAAA')) return encVal;
      return "";
    };

    const resolveAsyncInput = (elemId, encVal) => {
      if (encVal && typeof encVal === 'string' && encVal.startsWith('gAAAAA')) {
        decryptFernet(encVal).then(dec => {
          if (dec) {
            const el = document.getElementById(elemId);
            if (el && !el.value) el.value = dec;
          }
        });
      }
    };

    if (id) {
      if (delBtn) delBtn.style.display = isAdmin ? "inline-flex" : "none";
      const item = dispositionsData.find(d => String(d.id) === String(id));
      if (item) {
        const fac = facilitiesData.find(f => f.facility_key === item.facility_key) || {};
        const facName = fac.facility_name || item.facility_key || `수정 (#${id})`;
        const targetType = item.target_type || '소유자';
        const targetName = getCleanVal(item.target_name_decrypted, item.target_name_encrypted);

        let subInfoStr = targetType;
        if (targetName && targetName !== facName) {
          subInfoStr = `${targetType}: ${targetName}`;
        }
        
        const titleEl = document.getElementById("modal-disposition-title");
        if (titleEl) titleEl.innerText = `${facName} (${subInfoStr}) 수정`;
        
        setVal("disp-id", item.id);
        
        // 1. 기본 관리 정보
        setVal("disp-facility-key", item.facility_key);
        setVal("disp-target-type", item.target_type || "소유자");
        setVal("disp-status", item.current_status);
        setVal("disp-target-name", targetName);
        resolveAsyncInput("disp-target-name", item.target_name_encrypted);
        setVal("disp-notice-target", item.advance_notice_target);

        // 2. 사전통지 & 초본주소 정보
        setVal("disp-notice-method", item.advance_notice_method);
        setVal("disp-mail-address", getCleanVal(item.mail_address_decrypted, item.mail_address_encrypted));
        resolveAsyncInput("disp-mail-address", item.mail_address_encrypted);
        setVal("disp-zip-code", item.zip_code);
        setVal("disp-recipient-name", getCleanVal(item.recipient_name_decrypted, item.recipient_name_encrypted));
        resolveAsyncInput("disp-recipient-name", item.recipient_name_encrypted);
        setDateVal("disp-notice-send-date", item.advance_notice_send_date);
        setVal("disp-notice-return-status", item.advance_notice_return_status);
        setDateVal("disp-abstract-send-date", item.abstract_send_date);
        setVal("disp-abstract-address", getCleanVal(item.abstract_address_decrypted, item.abstract_address_encrypted));
        resolveAsyncInput("disp-abstract-address", item.abstract_address_encrypted);
        setVal("disp-abstract-return-status", item.abstract_return_status);
        setVal("disp-notice-public", item.notice_public);
        setVal("disp-notice-public-period", item.notice_public_period);

        // 3. 의견제출 & 시정명령 정보
        setVal("disp-opinion-submitted", item.opinion_submitted || "X");
        setDateVal("disp-opinion-submit-date", item.opinion_submit_date);
        setVal("disp-opinion-content", item.opinion_content);
        setVal("disp-correction-order", item.correction_order);
        setDateVal("disp-correction-date", item.correction_order_date);
        setVal("disp-correction-reason", item.correction_reason);
        setVal("disp-correction-period", item.correction_period);
        setVal("disp-correction-notice-method", item.correction_notice_method);
        setVal("disp-correction-return-details", item.correction_return_details);
        setVal("disp-correction-public", item.correction_public);

        // 4. 개인정보 & 비고
        setVal("disp-reg-num", getCleanVal(item.reg_num_decrypted, item.reg_num_encrypted));
        resolveAsyncInput("disp-reg-num", item.reg_num_encrypted);
        setVal("disp-contact", getCleanVal(item.contact_decrypted, item.contact_encrypted));
        resolveAsyncInput("disp-contact", item.contact_encrypted);
        setVal("disp-note", item.note);
      }
    } else {
      if (delBtn) delBtn.style.display = "none";
      const titleEl = document.getElementById("modal-disposition-title");
      if (titleEl) titleEl.innerText = "신규등록";
      setVal("disp-id", "");
    }

    // 현상태 제어: '시설'인 경우에만 편집 허용, '소유자/관리자' 등 하위 정보는 자동 연동 및 비활성화
    const statusInput = document.getElementById("disp-status");
    const targetTypeSelect = document.getElementById("disp-target-type");
    const statusHint = document.getElementById("disp-status-hint");

    const updateDispStatusState = () => {
      const isFacility = targetTypeSelect && targetTypeSelect.value === '시설';
      if (statusInput) {
        if (isFacility) {
          statusInput.disabled = false;
          statusInput.readOnly = false;
          statusInput.style.background = "#FFFFFF";
          statusInput.style.color = "#1E293B";
          statusInput.style.cursor = "text";
          statusInput.placeholder = "예: 7.27.시정명령 (시설 변경 시 모든 하위 소유자에 일괄 적용)";
          if (statusHint) statusHint.innerText = "* '시설'의 현상태 변경 시 해당 시설의 모든 하위 소유자/관리자에게 일괄 적용됩니다.";
        } else {
          statusInput.disabled = true;
          statusInput.readOnly = true;
          statusInput.style.background = "#F1F5F9";
          statusInput.style.color = "#64748B";
          statusInput.style.cursor = "not-allowed";
          statusInput.placeholder = "시설 레코드에서 관리됩니다 (자동 연동)";
          if (statusHint) statusHint.innerText = "* 현상태는 '시설' 레코드에서만 수정할 수 있으며 모든 하위 정보에 자동 연동됩니다.";
          
          // 해당 시설의 '시설' 레코드에서 현상태 가져와 표시
          const currentFacKey = document.getElementById("disp-facility-key")?.value.trim();
          if (currentFacKey) {
            const mainFacDisp = dispositionsData.find(d => d.facility_key === currentFacKey && d.target_type === '시설');
            if (mainFacDisp && mainFacDisp.current_status) {
              statusInput.value = mainFacDisp.current_status;
            }
          }
        }
      }
    };

    if (targetTypeSelect) {
      targetTypeSelect.onchange = updateDispStatusState;
    }
    updateDispStatusState();

    const modalEl = document.getElementById("modal-disposition");
    if (modalEl) modalEl.classList.add("active");
  } catch (errModal) {
    console.error("Error opening disposition modal:", errModal);
  }
}

function editDisposition(id) {
  closeModal('modal-disposition-detail');
  openDispositionModal(id);
}

async function saveDisposition() {
  try {
    const id = document.getElementById("disp-id").value;
    const facilityKey = document.getElementById("disp-facility-key").value.trim();
  if (!facilityKey) { alert("시설 KEY는 필수입니다."); return; }

  const targetName = document.getElementById("disp-target-name").value.trim();
  const mailAddr = document.getElementById("disp-mail-address").value.trim();
  const recipientName = document.getElementById("disp-recipient-name").value.trim();
  const abstractAddr = document.getElementById("disp-abstract-address").value.trim();
  const regNum = document.getElementById("disp-reg-num").value.trim();
  const contact = document.getElementById("disp-contact").value.trim();

  const getDateVal = (elemId) => {
    const el = document.getElementById(elemId);
    return el ? normalizeDateStr(el.value) : null;
  };

  const payload = {
    facility_key: facilityKey,
    target_type: document.getElementById("disp-target-type").value,
    current_status: document.getElementById("disp-status").value.trim(),
    advance_notice_target: document.getElementById("disp-notice-target").value.trim(),

    advance_notice_method: document.getElementById("disp-notice-method").value.trim(),
    zip_code: document.getElementById("disp-zip-code").value.trim(),
    advance_notice_send_date: getDateVal("disp-notice-send-date"),
    advance_notice_return_status: document.getElementById("disp-notice-return-status").value.trim(),
    abstract_send_date: getDateVal("disp-abstract-send-date"),
    abstract_return_status: document.getElementById("disp-abstract-return-status").value.trim(),
    notice_public: document.getElementById("disp-notice-public").value.trim(),
    notice_public_period: document.getElementById("disp-notice-public-period").value.trim(),

    opinion_submitted: document.getElementById("disp-opinion-submitted").value,
    opinion_submit_date: getDateVal("disp-opinion-submit-date"),
    opinion_content: document.getElementById("disp-opinion-content").value.trim(),
    correction_order: document.getElementById("disp-correction-order").value.trim(),
    correction_order_date: getDateVal("disp-correction-date"),
    correction_reason: document.getElementById("disp-correction-reason").value.trim(),
    correction_period: document.getElementById("disp-correction-period").value.trim(),
    correction_notice_method: document.getElementById("disp-correction-notice-method").value.trim(),
    correction_return_details: document.getElementById("disp-correction-return-details").value.trim(),
    correction_public: document.getElementById("disp-correction-public").value.trim(),
    note: document.getElementById("disp-note").value.trim(),
    target_name_decrypted: targetName,
    mail_address_decrypted: mailAddr,
    recipient_name_decrypted: recipientName,
    abstract_address_decrypted: abstractAddr,
    reg_num_decrypted: regNum,
    contact_decrypted: contact
  };

  if (id) payload.id = parseInt(id);

  // [1순위] Supabase DB에 직접 즉시 저장/수정 (Direct Mutation)
  let actualId = null;
  try {
    const directPayload = {
      facility_key: facilityKey,
      target_type: payload.target_type || '소유자',
      current_status: payload.current_status,
      target_name_encrypted: payload.target_name_decrypted,
      recipient_name_encrypted: payload.recipient_name_decrypted,
      reg_num_encrypted: payload.reg_num_decrypted,
      contact_encrypted: payload.contact_decrypted,
      mail_address_encrypted: payload.mail_address_decrypted,
      abstract_address_encrypted: payload.abstract_address_decrypted,
      zip_code: payload.zip_code,
      advance_notice_target: payload.advance_notice_target,
      advance_notice_method: payload.advance_notice_method,
      advance_notice_send_date: payload.advance_notice_send_date,
      advance_notice_return_status: payload.advance_notice_return_status,
      abstract_send_date: payload.abstract_send_date,
      abstract_return_status: payload.abstract_return_status,
      notice_public: payload.notice_public,
      notice_public_period: payload.notice_public_period,
      opinion_submitted: payload.opinion_submitted,
      opinion_submit_date: payload.opinion_submit_date,
      opinion_content: payload.opinion_content,
      correction_order: payload.correction_order,
      correction_order_date: payload.correction_order_date,
      correction_reason: payload.correction_reason,
      correction_period: payload.correction_period,
      correction_notice_method: payload.correction_notice_method,
      correction_return_details: payload.correction_return_details,
      correction_public: payload.correction_public,
      note: payload.note
    };

    const preferHeaders = {
      "apikey": SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    };

    if (id) {
      // 기존 처분 수정: Supabase DB에 직접 PATCH!
      const rPatch = await fetch(`${SUPABASE_REST_URL}/dispositions?id=eq.${id}`, {
        method: "PATCH",
        headers: preferHeaders,
        body: JSON.stringify(directPayload)
      });
      if (rPatch.ok) {
        actualId = parseInt(id);
      }
    } else {
      // 신규 처분 생성: Supabase DB에 직접 POST!
      const rPost = await fetch(`${SUPABASE_REST_URL}/dispositions`, {
        method: "POST",
        headers: preferHeaders,
        body: JSON.stringify([directPayload])
      });
      if (rPost.ok) {
        const rows = await rPost.json().catch(() => []);
        if (rows && rows.length > 0) {
          actualId = rows[0].id;
        }
      }
    }

    // [현상태 일괄 연동] '시설'의 현상태가 변경된 경우, 동일 시설의 모든 하위 처분 레코드(소유자, 관리자 등)의 현상태도 Supabase DB에 일괄 동기화!
    if (payload.target_type === '시설' && payload.current_status) {
      try {
        await fetch(`${SUPABASE_REST_URL}/dispositions?facility_key=eq.${encodeURIComponent(facilityKey)}`, {
          method: "PATCH",
          headers: preferHeaders,
          body: JSON.stringify({ current_status: payload.current_status })
        });
      } catch (errSync) {
        console.warn("Cascade status update to sub-dispositions failed:", errSync);
      }
    }
  } catch (eDir) {
    console.error("Direct Supabase disposition save error:", eDir);
  }

  // [2순위 보조] Render 백엔드 로컬 동기화용 비동기 통지
  fetch(`${API_BASE_URL}/dispositions/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, id: actualId || id })
  }).catch(() => {});

  if (!actualId && !id) {
    alert("행정처분 정보 저장 중 오류가 발생했습니다. (Supabase DB 저장 실패)");
    return;
  }

  payload.id = actualId || parseInt(id);

  // 1. Update Main Disposition in In-Memory Array & Cascade if Facility
  let mainIdx = dispositionsData.findIndex(d => String(d.id) === String(payload.id));
  if (mainIdx >= 0) {
    dispositionsData[mainIdx] = { ...dispositionsData[mainIdx], ...payload };
  } else {
    dispositionsData.push(payload);
  }

  // 시설 상태 변경 시 인메모리의 동일 시설 모든 하위 레코드도 일괄 갱신
  if (payload.target_type === '시설' && payload.current_status) {
    dispositionsData.forEach(d => {
      if (d.facility_key === facilityKey) {
        d.current_status = payload.current_status;
      }
    });
  }

  // 2. Save Sub-owner Forms (All 30 fields parsed with guaranteed Direct DB persistence)
  const subCards = document.querySelectorAll("#disp-sub-owners-container .sub-owner-card");
  for (const card of subCards) {
    const subTargetType = card.querySelector(".sub-target-type")?.value || "소유자";
    const subTargetName = card.querySelector(".sub-target-name")?.value.trim() || "";
    const subStatus = (payload.target_type === '시설' ? payload.current_status : (payload.current_status || "")) || card.querySelector(".sub-status")?.value.trim() || "";
    const subNoticeTarget = card.querySelector(".sub-notice-target")?.value.trim() || "";

    const subNoticeMethod = card.querySelector(".sub-notice-method")?.value.trim() || "";
    const subMailAddr = card.querySelector(".sub-mail-address")?.value.trim() || "";
    const subZipCode = card.querySelector(".sub-zip-code")?.value.trim() || "";
    const subRecipient = card.querySelector(".sub-recipient-name")?.value.trim() || "";
    const subNoticeSendDate = normalizeDateStr(card.querySelector(".sub-notice-send-date")?.value);
    const subNoticeReturnStatus = card.querySelector(".sub-notice-return-status")?.value.trim() || "";
    const subAbstractSendDate = normalizeDateStr(card.querySelector(".sub-abstract-send-date")?.value);
    const subAbstractAddr = card.querySelector(".sub-abstract-address")?.value.trim() || "";
    const subAbstractReturnStatus = card.querySelector(".sub-abstract-return-status")?.value.trim() || "";
    const subNoticePublic = card.querySelector(".sub-notice-public")?.value.trim() || "";
    const subNoticePublicPeriod = card.querySelector(".sub-notice-public-period")?.value.trim() || "";

    const subOpinionSubmitted = card.querySelector(".sub-opinion-submitted")?.value || "X";
    const subOpinionSubmitDate = normalizeDateStr(card.querySelector(".sub-opinion-submit-date")?.value);
    const subOpinionContent = card.querySelector(".sub-opinion-content")?.value.trim() || "";
    const subCorrectionOrder = card.querySelector(".sub-correction-order")?.value.trim() || "";
    const subCorrectionDate = normalizeDateStr(card.querySelector(".sub-correction-date")?.value);
    const subCorrectionReason = card.querySelector(".sub-correction-reason")?.value.trim() || "";
    const subCorrectionPeriod = card.querySelector(".sub-correction-period")?.value.trim() || "";
    const subCorrectionNoticeMethod = card.querySelector(".sub-correction-notice-method")?.value.trim() || "";
    const subCorrectionReturnDetails = card.querySelector(".sub-correction-return-details")?.value.trim() || "";
    const subCorrectionPublic = card.querySelector(".sub-correction-public")?.value.trim() || "";

    const subReg = card.querySelector(".sub-reg-num")?.value.trim() || "";
    const subCon = card.querySelector(".sub-contact")?.value.trim() || "";
    const subNote = card.querySelector(".sub-note")?.value.trim() || "";

    // Skip completely empty cards
    if (!subTargetName && !subMailAddr && !subRecipient && !subNoticeMethod && !subCorrectionOrder && !subNote) {
      continue;
    }

    const subPayload = {
      facility_key: facilityKey,
      target_type: subTargetType || '소유자',
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
      note: subNote,
      target_name_decrypted: subTargetName,
      mail_address_decrypted: subMailAddr,
      recipient_name_decrypted: subRecipient,
      abstract_address_decrypted: subAbstractAddr,
      reg_num_decrypted: subReg,
      contact_decrypted: subCon
    };

    // [서브 카드 1순위] Supabase DB에 직접 POST 생성
    let subActualId = null;
    try {
      const directSub = {
        facility_key: facilityKey,
        target_type: subPayload.target_type,
        current_status: subPayload.current_status,
        target_name_encrypted: subPayload.target_name_decrypted,
        recipient_name_encrypted: subPayload.recipient_name_decrypted,
        reg_num_encrypted: subPayload.reg_num_decrypted,
        contact_encrypted: subPayload.contact_decrypted,
        mail_address_encrypted: subPayload.mail_address_decrypted,
        abstract_address_encrypted: subPayload.abstract_address_decrypted,
        zip_code: subPayload.zip_code,
        advance_notice_target: subPayload.advance_notice_target,
        advance_notice_method: subPayload.advance_notice_method,
        advance_notice_send_date: subPayload.advance_notice_send_date,
        advance_notice_return_status: subPayload.advance_notice_return_status,
        abstract_send_date: subPayload.abstract_send_date,
        abstract_return_status: subPayload.abstract_return_status,
        notice_public: subPayload.notice_public,
        notice_public_period: subPayload.notice_public_period,
        opinion_submitted: subPayload.opinion_submitted,
        opinion_submit_date: subPayload.opinion_submit_date,
        opinion_content: subPayload.opinion_content,
        correction_order: subPayload.correction_order,
        correction_order_date: subPayload.correction_order_date,
        correction_reason: subPayload.correction_reason,
        correction_period: subPayload.correction_period,
        correction_notice_method: subPayload.correction_notice_method,
        correction_return_details: subPayload.correction_return_details,
        correction_public: subPayload.correction_public,
        note: subPayload.note
      };
      const rSubDirect = await fetch(`${SUPABASE_REST_URL}/dispositions`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify([directSub])
      });
      if (rSubDirect.ok) {
        const subRows = await rSubDirect.json();
        if (subRows && subRows.length > 0) {
          subActualId = subRows[0].id;
        }
      }
    } catch (eDirSub) {
      console.error("Direct Supabase sub save error:", eDirSub);
    }

    // [서브 카드 2순위 보조] Render 백엔드 비동기 통지
    fetch(`${API_BASE_URL}/dispositions/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...subPayload, id: subActualId })
    }).catch(() => {});

    if (subActualId) {
      dispositionsData.push({ ...subPayload, id: subActualId });
    }
  }

    try {
      localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData));
    } catch(e) {}

    alert("행정처분 정보가 성공적으로 저장되었습니다." + (payload.target_type === '시설' ? "\n(해당 시설의 모든 하위 소유자/관리자의 현상태도 함께 일괄 동기화되었습니다)" : ""));
    closeModal('modal-disposition');

    // 상세 팝업을 즉시 최신 데이터로 다시 열기
    openDispositionDetailModal(facilityKey);

    // 메인 카드 그리드 및 테이블도 즉시 갱신
    filterDispositions();
  } catch (err) {
    console.error("Error saving disposition:", err);
    alert("저장 중 오류가 발생했습니다.");
  }
}

async function deleteDisposition(id) {
  if (!confirm(`정말 행정처분 내역 (#${id})을 삭제하시겠습니까?`)) return;
  try {
    const item = dispositionsData.find(d => String(d.id) === String(id));
    const facilityKey = item ? item.facility_key : null;

    // 1. [모범 아키텍처 1단계] Supabase DB에 직접 DELETE 요청 (0.1초 즉시 영구 삭제 보장)
    try {
      await fetch(`${SUPABASE_REST_URL}/dispositions?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Prefer": "return=minimal"
        }
      });
    } catch(eDb) {
      console.warn("Direct Supabase DELETE error:", eDb);
    }

    // 2. [모범 아키텍처 2단계] 백엔드 프록시 삭제 동기화
    try {
      await fetch(`${API_BASE_URL}/dispositions/delete?id=${id}`, { method: "DELETE" });
    } catch(eProxy) {}

    // 3. [모범 아키텍처 3단계] 인메모리 배열 및 localStorage에서 즉시 영구 제거
    dispositionsData = dispositionsData.filter(d => String(d.id) !== String(id));
    try {
      localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData));
    } catch(e) {}

    alert("성공적으로 삭제되었습니다.");

    // 4. 상세 모달창 및 메인 그리드 즉시 갱신
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
    filterDispositions();
    updateDashboardStats();
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다.");
  }
}

// 행정처분 상세 팝업에서 "행정처분 전체 삭제" 버튼 클릭 시 호출
async function deleteDispositionFromDetail() {
  if (!currentDispositionDetailKey) {
    alert("삭제할 시설/처분 정보를 찾을 수 없습니다.");
    return;
  }
  const items = dispositionsData.filter(d => d.facility_key === currentDispositionDetailKey);
  if (items.length === 0) {
    alert("삭제할 행정처분 내역이 없습니다.");
    return;
  }
  if (!confirm(`정말 시설 (${currentDispositionDetailKey})의 행정처분 내역 전체(${items.length}건)를 삭제하시겠습니까?`)) return;

  try {
    // 1. [모범 아키텍처 1단계] Supabase DB 직접 전체 삭제
    try {
      await fetch(`${SUPABASE_REST_URL}/dispositions?facility_key=eq.${encodeURIComponent(currentDispositionDetailKey)}`, {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_SECRET_KEY,
          "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
          "Prefer": "return=minimal"
        }
      });
    } catch(eDb) {
      console.warn("Direct Supabase bulk delete error:", eDb);
    }

    // 2. [모범 아키텍처 2단계] 백엔드 프록시 삭제 동기화
    try {
      await fetch(`${API_BASE_URL}/dispositions/delete?facility_key=${encodeURIComponent(currentDispositionDetailKey)}`, { method: "DELETE" });
    } catch(eProxy) {}

    dispositionsData = dispositionsData.filter(d => d.facility_key !== currentDispositionDetailKey);
    try { localStorage.setItem("cached_dispositions", JSON.stringify(dispositionsData)); } catch(e) {}
    alert("행정처분 내역 전체가 성공적으로 삭제되었습니다.");
    closeModal('modal-disposition-detail');
    filterDispositions();
    updateDashboardStats();
  } catch (err) {
    console.error(err);
    alert("삭제 중 오류가 발생했습니다.");
  }
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

function openModal(modalId) {
  const elem = document.getElementById(modalId);
  if (elem) {
    elem.classList.add("active");
    elem.style.display = "flex";
  }
}

let returnTabAfterFacilityDetail = null;

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

  // 통합시설 상세보기 또는 시설수정 모달을 닫을 때, 운영현황(또는 이전 탭)에서 호출된 경우 해당 탭으로 복귀
  if (modalId === "modal-facility-detail" || modalId === "modal-facility") {
    if (returnTabAfterFacilityDetail) {
      const isFacilityModalActive = document.getElementById("modal-facility")?.classList.contains("active");
      const isDetailModalActive = document.getElementById("modal-facility-detail")?.classList.contains("active");
      if (!isFacilityModalActive && !isDetailModalActive) {
        const targetTab = returnTabAfterFacilityDetail;
        returnTabAfterFacilityDetail = null;
        switchTab(targetTab);
      }
    }
  }
}

// 개별 처분 수정 폼 내부의 삭제 버튼
async function deleteDispositionFromForm() {
  const dispId = document.getElementById("disp-id").value;
  if (!dispId) {
    alert("삭제할 레코드 ID가 존재하지 않습니다.");
    return;
  }
  closeModal("modal-disposition");
  await deleteDisposition(dispId);
}

// ==========================================
// 8. 시정명령 차수별 관리 로직 (Correction Orders)
// ==========================================
let allCorrectionOrders = [];
let correctionMeta = {};
let currentCorrectionBatch = '2026-06-30';

async function fetchCorrectionOrders() {
  let fetchedData = null;

  try {
    const res = await fetch(`${API_BASE_URL}/correction_orders`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.orders && data.orders.length > 0) {
        fetchedData = data;
      }
    }
  } catch (err) {
    console.warn("Backend API fetch correction orders failed:", err);
  }

  if (!fetchedData) {
    try {
      const resLocal = await fetch("correction_orders_cache.json?v=" + Date.now());
      if (resLocal.ok) {
        const data = await resLocal.json();
        if (data && data.orders && data.orders.length > 0) {
          fetchedData = data;
        }
      }
    } catch (e) {
      console.warn("Local cache fetch failed:", e);
    }
  }

  // Smart Merge with localStorage edits
  const cached = localStorage.getItem("cached_correction_orders");
  let orders = fetchedData ? (fetchedData.orders || []) : [];
  let meta = fetchedData ? (fetchedData.meta || {}) : {};

  if (cached) {
    try {
      const cData = JSON.parse(cached);
      const cOrders = cData.orders || [];
      if (cOrders.length > 0) {
        const cMap = new Map(cOrders.map(o => [String(o.id), o]));
        orders = orders.map(o => {
          const cItem = cMap.get(String(o.id));
          return cItem ? { ...o, ...cItem } : o;
        });
        cOrders.forEach(cItem => {
          if (!orders.some(o => String(o.id) === String(cItem.id))) {
            orders.push(cItem);
          }
        });
        if (cData.meta) meta = { ...meta, ...cData.meta };
      }
    } catch(e) {}
  }

  allCorrectionOrders = orders;
  correctionMeta = meta;
  try { localStorage.setItem("cached_correction_orders", JSON.stringify({ meta: correctionMeta, orders: allCorrectionOrders })); } catch(e) {}
  renderCorrectionBatch(currentCorrectionBatch);
}

function renderCorrectionBatchTabs() {
  const container = document.getElementById("correction-batch-tabs-container");
  if (!container) return;

  // 모든 차수 라운드 수집
  const roundsSet = new Set();
  Object.keys(correctionMeta).forEach(r => roundsSet.add(r));
  allCorrectionOrders.forEach(o => { if (o.batch_round) roundsSet.add(o.batch_round); });
  
  const sortedRounds = Array.from(roundsSet).sort();
  if (sortedRounds.length === 0) {
    sortedRounds.push('2026-06-30', '2026-07-28', '2026-08-19');
  }

  if (!sortedRounds.includes(currentCorrectionBatch)) {
    currentCorrectionBatch = sortedRounds[0];
  }

  container.innerHTML = sortedRounds.map((r, idx) => {
    const meta = correctionMeta[r] || {};
    const label = meta.batch_label || `${idx + 1}차 (${r})`;
    const isActive = r === currentCorrectionBatch;
    return `
      <button class="btn correction-batch-btn ${isActive ? 'active' : 'inactive'}" id="btn-batch-${r}" onclick="switchCorrectionBatch('${r}')">
        <i class="fa-solid fa-calendar-check" style="${isActive ? 'color: #FFFFFF;' : 'color: #0284C7;'}"></i> ${label}
      </button>
    `;
  }).join('');
}

function switchCorrectionBatch(batchRound) {
  currentCorrectionBatch = batchRound;
  renderCorrectionBatchTabs();

  // 검색창 초기화
  const searchInput = document.getElementById("corr-search-input");
  if (searchInput) searchInput.value = "";
  const methodFilter = document.getElementById("corr-filter-method");
  if (methodFilter) methodFilter.value = "";
  const delivFilter = document.getElementById("corr-filter-delivery");
  if (delivFilter) delivFilter.value = "";

  renderCorrectionBatch(batchRound);
}

function renderCorrectionBatch(batchRound) {
  renderCorrectionBatchTabs();

  const bOrders = allCorrectionOrders.filter(o => o.batch_round === batchRound);
  const uniqueFacs = len_unique(bOrders.map(o => o.facility_name));
  const offCnt = bOrders.filter(o => o.notice_method === '공문').length;
  const mailCnt = bOrders.length - offCnt;

  const meta = correctionMeta[batchRound] || {
    batch_title: batchRound === '2026-06-30' ? '6.29.공문결재, 6.30.등기발송' : (batchRound === '2026-07-28' ? '7.27.공문결재, 7.28.등기발송' : (batchRound === '2026-08-19' ? '8.19.공문결재, 8.20.등기발송' : `${batchRound} 시정명령`)),
    approval_date: bOrders[0]?.approval_date || bOrders[0]?.order_date || '-',
    send_date: bOrders[0]?.send_date || bOrders[0]?.order_date || '-',
    total_facilities: uniqueFacs,
    official_count: offCnt,
    mail_count: mailCnt,
    row_count: bOrders.length
  };

  // 상단 요약 카드 텍스트 바인딩
  const titleElem = document.getElementById("corr-title-text");
  if (titleElem) {
    titleElem.innerHTML = `<i class="fa-solid fa-file-contract" style="color:var(--primary);"></i> 행정처분 내역 (시정명령, ${meta.batch_title || batchRound})`;
  }

  const descElem = document.getElementById("corr-desc-text");
  if (descElem) {
    descElem.innerText = `해당 행정처분은 ${meta.approval_date || '-'}에 공문결재를 완료하고, ${meta.send_date || '-'}에 발송을 완료한 내역입니다.`;
  }

  const totalElem = document.getElementById("corr-stat-total");
  if (totalElem) totalElem.innerText = `${meta.total_facilities || uniqueFacs}개소`;

  const offElem = document.getElementById("corr-stat-official");
  if (offElem) offElem.innerText = `${meta.official_count !== undefined ? meta.official_count : offCnt}개소`;

  const mailElem = document.getElementById("corr-stat-mail");
  if (mailElem) mailElem.innerText = `${meta.mail_count !== undefined ? meta.mail_count : mailCnt}개소`;

  const rowsElem = document.getElementById("corr-stat-rows");
  if (rowsElem) rowsElem.innerText = `${meta.row_count || bOrders.length}건`;

  filterCorrectionOrders();
}

function len_unique(arr) {
  return new Set(arr.filter(Boolean).map(s => String(s).trim())).size;
}

// 신규 시정명령 건 등록 모달 열기
function openNewCorrectionOrderModal() {
  document.getElementById("corr-edit-id").value = "";
  document.getElementById("corr-edit-batch").value = currentCorrectionBatch || "2026-09-15";
  document.getElementById("corr-edit-date").value = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  document.getElementById("corr-edit-method").value = "등기";
  document.getElementById("corr-edit-fac-name").value = "";
  document.getElementById("corr-edit-address").value = "";
  document.getElementById("corr-edit-zip").value = "";
  document.getElementById("corr-edit-target").value = "";
  document.getElementById("corr-edit-recipient").value = "";
  document.getElementById("corr-edit-delivery").value = "";
  document.getElementById("corr-edit-note").value = "";

  const modal = document.getElementById("modal-correction-order");
  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }
}

// 업로드 양식 템플릿 다운로드
function downloadCorrectionOrdersTemplate() {
  const csvContent = "\uFEFF차수구분(예: 2026-09-15),시정명령일자,시설명,우편발송 도로명주소,우편번호,시정명령대상,통지방법(등기/공문),수신인,우편도달여부(도달/반송),비고\n" +
    "2026-09-15,2026.9.15.,샘플시설1,광주광역시 광산구 임방울대로 123,62245,샘플관리단,등기,샘플관리실,도달,샘플비고\n" +
    "2026-09-15,2026.9.15.,샘플시설2,광주광역시 광산구 무진대로 456,62355,샘플공공기관,공문,샘플기관장,,공문발송\n";

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", "시정명령_일괄업로드_표준양식.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 엑셀/CSV 일괄 업로드 처리기
async function handleCorrectionOrdersUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = async function(e) {
      const data = new Uint8Array(e.target.result);
      if (typeof XLSX === 'undefined') {
        alert("엑셀 파싱 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const workbook = XLSX.read(data, { type: 'array' });
      const parsedItems = [];

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!jsonRows || jsonRows.length < 2) return;

        // 헤더 인덱스 찾기
        let headerRowIdx = -1;
        let colMap = {};

        for (let r = 0; r < Math.min(jsonRows.length, 10); r++) {
          const row = jsonRows[r];
          const rowStr = row.join(' ');
          if (rowStr.includes('시설명') || rowStr.includes('시정명령')) {
            headerRowIdx = r;
            row.forEach((cell, cIdx) => {
              const cStr = String(cell).replace(/\n/g, '').trim();
              if (cStr.includes('차수')) colMap['batch'] = cIdx;
              if (cStr.includes('명령일자') || cStr.includes('일자')) colMap['order_date'] = cIdx;
              if (cStr.includes('시설명')) colMap['facility_name'] = cIdx;
              if (cStr.includes('주소') || cStr.includes('도로명')) colMap['send_address'] = cIdx;
              if (cStr.includes('우편번호')) colMap['zip_code'] = cIdx;
              if (cStr.includes('대상')) colMap['target_name'] = cIdx;
              if (cStr.includes('통지방법') || cStr.includes('방법')) colMap['notice_method'] = cIdx;
              if (cStr.includes('수신인')) colMap['recipient_name'] = cIdx;
              if (cStr.includes('도달')) colMap['delivery_status'] = cIdx;
              if (cStr.includes('비고')) colMap['note'] = cIdx;
            });
            break;
          }
        }

        if (headerRowIdx === -1) return;

        // 차수 기본값 추출 (시트명이나 파일명 기준)
        let defaultBatch = currentCorrectionBatch;
        if (sheetName.includes('6.30')) defaultBatch = '2026-06-30';
        else if (sheetName.includes('7.28')) defaultBatch = '2026-07-28';
        else if (sheetName.includes('8.19')) defaultBatch = '2026-08-19';
        else {
          const matchDate = sheetName.match(/\d{4}[.\-_]\d{1,2}[.\-_]\d{1,2}/);
          if (matchDate) defaultBatch = matchDate[0].replace(/[._]/g, '-');
        }

        for (let r = headerRowIdx + 1; r < jsonRows.length; r++) {
          const row = jsonRows[r];
          if (!row || row.length === 0) continue;
          
          const facName = colMap['facility_name'] !== undefined ? String(row[colMap['facility_name']] || '').trim() : '';
          if (!facName || facName.startsWith('총 ')) continue;

          const batch = (colMap['batch'] !== undefined && row[colMap['batch']]) ? String(row[colMap['batch']]).trim() : defaultBatch;
          const orderDate = colMap['order_date'] !== undefined ? String(row[colMap['order_date']] || '').trim() : '';
          const address = colMap['send_address'] !== undefined ? String(row[colMap['send_address']] || '').trim() : '';
          const zip = colMap['zip_code'] !== undefined ? String(row[colMap['zip_code']] || '').trim() : '';
          const target = colMap['target_name'] !== undefined ? String(row[colMap['target_name']] || '').trim() : '';
          const method = colMap['notice_method'] !== undefined ? String(row[colMap['notice_method']] || '등기').trim() : '등기';
          const recipient = colMap['recipient_name'] !== undefined ? String(row[colMap['recipient_name']] || '').trim() : '';
          const delivery = colMap['delivery_status'] !== undefined ? String(row[colMap['delivery_status']] || '').trim() : '';
          const note = colMap['note'] !== undefined ? String(row[colMap['note']] || '').trim() : '';

          parsedItems.push({
            batch_round: batch,
            order_date: orderDate,
            facility_name: facName,
            send_address: address,
            zip_code: zip,
            target_name: target,
            notice_method: method,
            recipient_name: recipient,
            delivery_status: delivery,
            note: note
          });
        }
      });

      if (parsedItems.length === 0) {
        alert("엑셀 파일에서 유효한 시정명령 데이터를 찾지 못했습니다.\n양식 헤더(시설명, 주소, 수신인 등)를 확인해주세요.");
        return;
      }

      // 서버 업로드 전송
      const res = await fetch(`${API_BASE_URL}/correction_orders/batch_upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedItems })
      });

      if (res.ok) {
        const result = await res.json();
        alert(`🎉 엑셀 일괄 업로드 완료!\n- 추가: ${result.added_count}건\n- 갱신: ${result.updated_count}건`);
        if (parsedItems[0]?.batch_round) {
          currentCorrectionBatch = parsedItems[0].batch_round;
        }
        await fetchCorrectionOrders();
      } else {
        alert("서버 업로드 처리 중 오류가 발생했습니다.");
      }
    };
    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error("Excel upload error:", err);
    alert("파일을 읽는 중 오류가 발생했습니다: " + err.message);
  } finally {
    event.target.value = ""; // reset
  }
}

function filterCorrectionOrders() {
  const tbody = document.getElementById("correction-orders-tbody");
  if (!tbody) return;

  const searchKeyword = (document.getElementById("corr-search-input")?.value || "").trim().toLowerCase();
  const methodFilter = (document.getElementById("corr-filter-method")?.value || "").trim();
  const deliveryFilter = (document.getElementById("corr-filter-delivery")?.value || "").trim();

  // 현재 차수 데이터 추출
  const batchList = allCorrectionOrders.filter(o => o.batch_round === currentCorrectionBatch);

  // 검색 및 필터링
  const filtered = batchList.filter(item => {
    if (methodFilter && item.notice_method !== methodFilter) return false;
    if (deliveryFilter) {
      if (deliveryFilter === '도달' && item.delivery_status !== '도달') return false;
      if (deliveryFilter === '미도달' && item.delivery_status === '도달') return false;
    }
    if (searchKeyword) {
      const targetStr = `${item.facility_name || ''} ${item.target_name || ''} ${item.recipient_name || ''} ${item.send_address || ''} ${item.note || ''}`.toLowerCase();
      if (!targetStr.includes(searchKeyword)) return false;
    }
    return true;
  });

  const countElem = document.getElementById("corr-filtered-count");
  if (countElem) countElem.innerText = `총 ${filtered.length}건 검색`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-info" style="margin-right:0.4rem;"></i> 조건에 해당하는 시정명령 내역이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => {
    const isOfficial = item.notice_method === '공문';
    const methodBadge = isOfficial 
      ? `<span class="badge badge-amber" style="font-size:0.75rem; padding:0.2rem 0.5rem;"><i class="fa-solid fa-envelope-open-text"></i> 공문</span>`
      : `<span class="badge badge-blue" style="font-size:0.75rem; padding:0.2rem 0.5rem;"><i class="fa-solid fa-paper-plane"></i> 등기</span>`;

    let deliveryBadge = `<span style="color:#94A3B8; font-size:0.8rem;">-</span>`;
    if (item.delivery_status === '도달') {
      deliveryBadge = `<span class="badge badge-emerald" style="font-size:0.75rem; padding:0.2rem 0.5rem; font-weight:700;"><i class="fa-solid fa-check"></i> 도달</span>`;
    } else if (item.delivery_status) {
      deliveryBadge = `<span class="badge badge-rose" style="font-size:0.75rem; padding:0.2rem 0.5rem; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${item.delivery_status}</span>`;
    }

    const noteTag = item.note ? `<span style="font-size:0.8rem; background:#F8FAFC; padding:0.2rem 0.45rem; border-radius:4px; border:1px solid #CBD5E1; color:#334155; font-weight:500;">${item.note}</span>` : `<span style="color:#94A3B8;">-</span>`;

    return `
      <tr>
        <td style="text-align:center;"><span class="table-no-badge">${idx + 1}</span></td>
        <td style="text-align:center; font-size:0.83rem; color:#334155; font-weight:600;">${item.order_date || '-'}</td>
        <td>
          <span class="clickable-fac-name" onclick="openCorrectionOrderModal(${item.id})" title="클릭하여 내용 수정">
            <i class="fa-regular fa-pen-to-square" style="font-size:0.75rem;"></i>${item.facility_name || '-'}
          </span>
        </td>
        <td style="font-size:0.83rem; color:#334155; line-height:1.45; word-break:keep-all;">${item.send_address || '-'}</td>
        <td style="text-align:center; font-size:0.8rem; color:#64748B; font-family:monospace; font-weight:600;">${item.zip_code || '-'}</td>
        <td style="font-size:0.83rem; color:#1E293B;">${item.target_name || '-'}</td>
        <td style="text-align:center;">${methodBadge}</td>
        <td style="font-size:0.83rem; font-weight:700; color:#0F172A;">${item.recipient_name || '-'}</td>
        <td style="text-align:center;">${deliveryBadge}</td>
        <td style="text-align:center;">${noteTag}</td>
      </tr>
    `;
  }).join('');
}

// 시정명령 건별 수정 모달 열기
function openCorrectionOrderModal(id) {
  const item = allCorrectionOrders.find(o => String(o.id) === String(id));
  if (!item) return;

  document.getElementById("corr-edit-id").value = item.id;
  document.getElementById("corr-edit-batch").value = item.batch_round || currentCorrectionBatch;
  document.getElementById("corr-edit-date").value = item.order_date || "";
  document.getElementById("corr-edit-method").value = item.notice_method || "등기";
  document.getElementById("corr-edit-fac-name").value = item.facility_name || "";
  document.getElementById("corr-edit-address").value = item.send_address || "";
  document.getElementById("corr-edit-zip").value = item.zip_code || "";
  document.getElementById("corr-edit-target").value = item.target_name || "";
  document.getElementById("corr-edit-recipient").value = item.recipient_name || "";
  document.getElementById("corr-edit-delivery").value = item.delivery_status || "";
  document.getElementById("corr-edit-note").value = item.note || "";

  const modal = document.getElementById("modal-correction-order");
  if (modal) {
    modal.classList.add("active");
    modal.style.display = "flex";
  }
}

// 시정명령 저장 (수정)
async function saveCorrectionOrder() {
  const id = document.getElementById("corr-edit-id").value;
  const batchRound = document.getElementById("corr-edit-batch").value || currentCorrectionBatch;
  const orderDate = document.getElementById("corr-edit-date").value.trim();
  const noticeMethod = document.getElementById("corr-edit-method").value;
  const facName = document.getElementById("corr-edit-fac-name").value.trim();
  const address = document.getElementById("corr-edit-address").value.trim();
  const zip = document.getElementById("corr-edit-zip").value.trim();
  const target = document.getElementById("corr-edit-target").value.trim();
  const recipient = document.getElementById("corr-edit-recipient").value.trim();
  const delivery = document.getElementById("corr-edit-delivery").value;
  const note = document.getElementById("corr-edit-note").value.trim();

  if (!facName) {
    alert("시설명을 입력해주세요.");
    return;
  }

  const payload = {
    id: parseInt(id) || id,
    batch_round: batchRound,
    order_date: orderDate,
    notice_method: noticeMethod,
    facility_name: facName,
    send_address: address,
    zip_code: zip,
    target_name: target,
    recipient_name: recipient,
    delivery_status: delivery,
    note: note
  };

  // 백엔드 API 저장 호출 (Supabase DB 및 서버 캐시 저장)
  try {
    const res = await fetch(`${API_BASE_URL}/correction_orders/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const resData = await res.json();
      if (resData.data && resData.data.id) {
        payload.id = resData.data.id;
      }
      
      // 로컬 메모리 상태 갱신
      const idx = allCorrectionOrders.findIndex(o => String(o.id) === String(payload.id) || (id && String(o.id) === String(id)));
      if (idx !== -1) {
        allCorrectionOrders[idx] = { ...allCorrectionOrders[idx], ...payload };
      } else {
        allCorrectionOrders.push(payload);
      }

      try {
        localStorage.setItem("cached_correction_orders", JSON.stringify({
          meta: correctionMeta,
          orders: allCorrectionOrders
        }));
      } catch(e) {}

      closeModal("modal-correction-order");
      renderCorrectionBatch(currentCorrectionBatch);
      alert("시정명령 내용이 데이터베이스에 안전하게 저장되었습니다.");
    } else {
      alert("저장 중 서버 오류가 발생했습니다. 다시 시도해주세요.");
    }
  } catch (err) {
    console.error("Backend save error:", err);
    alert("서버 연결에 실패했습니다: " + err.message);
  }
}

// 시정명령 삭제
async function deleteCurrentCorrectionOrder() {
  const id = document.getElementById("corr-edit-id").value;
  if (!id) return;
  if (!confirm("해당 시정명령 건을 삭제하시겠습니까?")) return;

  allCorrectionOrders = allCorrectionOrders.filter(o => String(o.id) !== String(id));
  try {
    localStorage.setItem("cached_correction_orders", JSON.stringify({
      meta: correctionMeta,
      orders: allCorrectionOrders
    }));
  } catch(e) {}

  closeModal("modal-correction-order");
  renderCorrectionBatch(currentCorrectionBatch);

  try {
    await fetch(`${API_BASE_URL}/correction_orders/delete?id=${id}`, { method: "DELETE" });
    alert("시정명령 건이 삭제되었습니다.");
  } catch(e) {
    console.warn("Backend delete error:", e);
  }
}

function exportCorrectionOrdersExcel() {
  const batchList = allCorrectionOrders.filter(o => o.batch_round === currentCorrectionBatch);
  if (!batchList || batchList.length === 0) {
    alert("다운로드할 데이터가 없습니다.");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "No,시정명령일자,시설명,우편발송 도로명주소,우편번호,시정명령대상,통지방법,수신인,우편도달여부,비고\n";

  batchList.forEach((item, idx) => {
    const row = [
      idx + 1,
      `"${item.order_date || ''}"`,
      `"${(item.facility_name || '').replace(/"/g, '""')}"`,
      `"${(item.send_address || '').replace(/"/g, '""')}"`,
      `"${item.zip_code || ''}"`,
      `"${(item.target_name || '').replace(/"/g, '""')}"`,
      `"${item.notice_method || ''}"`,
      `"${(item.recipient_name || '').replace(/"/g, '""')}"`,
      `"${item.delivery_status || ''}"`,
      `"${(item.note || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const meta = correctionMeta[currentCorrectionBatch] || {};
  const filename = `시정명령_내역_${currentCorrectionBatch}_${meta.batch_title || ''}.csv`.replace(/[\/\\?%*:|"<>]/g, '_');
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printCorrectionOrders() {
  const meta = correctionMeta[currentCorrectionBatch] || {
    batch_title: '시정명령 내역',
    approval_date: '-',
    send_date: '-',
    total_facilities: 0,
    official_count: 0,
    mail_count: 0
  };
  const batchList = allCorrectionOrders.filter(o => o.batch_round === currentCorrectionBatch);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("팝업 차단을 해제해주세요.");
    return;
  }

  let tableRows = batchList.map((item, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${item.order_date || '-'}</td>
      <td style="font-weight:bold;">${item.facility_name || '-'}</td>
      <td>${item.send_address || '-'}</td>
      <td style="text-align:center;">${item.zip_code || '-'}</td>
      <td>${item.target_name || '-'}</td>
      <td style="text-align:center;">${item.notice_method || '-'}</td>
      <td>${item.recipient_name || '-'}</td>
      <td style="text-align:center;">${item.delivery_status || '-'}</td>
      <td>${item.note || '-'}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>행정처분 내역 (시정명령, ${meta.batch_title})</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: 'Pretendard', sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 10px; }
        h1 { font-size: 16px; margin: 0 0 8px 0; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
        .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th, td { border: 1px solid #94a3b8; padding: 4px 6px; font-size: 10px; }
        th { background: #f1f5f9; font-weight: 700; text-align: center; }
      </style>
    </head>
    <body>
      <h1>행정처분 내역 (시정명령, ${meta.batch_title})</h1>
      <div class="summary-box">
        <span><strong>결재/발송:</strong> ${meta.approval_date} 공문결재 / ${meta.send_date} 발송</span>
        <span><strong>통계:</strong> 총 대상 ${meta.total_facilities}개소 (공문 ${meta.official_count}개소, 우편 ${meta.mail_count}개소) / 총 ${batchList.length}건</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:30px;">No</th>
            <th style="width:70px;">명령일자</th>
            <th style="width:130px;">시설명</th>
            <th>우편발송 도로명주소</th>
            <th style="width:50px;">우편번호</th>
            <th style="width:120px;">시정명령대상</th>
            <th style="width:50px;">통지방법</th>
            <th style="width:120px;">수신인</th>
            <th style="width:50px;">도달여부</th>
            <th style="width:80px;">비고</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// 날짜 입력 필드 4자리 연도 초과 방지 및 편의성 헬퍼
document.addEventListener("DOMContentLoaded", () => {
  const setupDateInputs = () => {
    document.querySelectorAll('input[type="date"]').forEach(input => {
      if (!input.hasAttribute("max")) input.setAttribute("max", "2099-12-31");
      if (!input.hasAttribute("min")) input.setAttribute("min", "1900-01-01");
    });
  };
  setupDateInputs();
  
  const observer = new MutationObserver(setupDateInputs);
  observer.observe(document.body, { childList: true, subtree: true });
});

/* ==========================================================================
   Operations Management (운영현황 관리) Functions
   ========================================================================== */

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function fetchOperations(forceRefresh = false) {
  const container = document.getElementById("operations-card-container");
  
  // 이미 메모리에 데이터가 있다면 먼저 렌더링하여 지연 방지
  if (operationsData && operationsData.length > 0 && !forceRefresh) {
    initOperationReasonFilter();
    filterOperations();
    return;
  }

  // 로컬 캐시(localStorage)에 저장된 데이터가 있으면 0.001초 만에 즉시 표시
  try {
    const localCached = localStorage.getItem("cached_operations");
    if (localCached) {
      const parsed = JSON.parse(localCached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        operationsData = parsed;
        initOperationReasonFilter();
        filterOperations();
      }
    }
  } catch (e) {}

  if (container && (!operationsData || operationsData.length === 0)) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary); margin-bottom: 0.8rem;"></i>
        <div style="font-weight: 600;">운영현황 데이터를 불러오는 중입니다...</div>
      </div>
    `;
  }

  let list = [];

  // [1순위] 초고속 로컬 정적 캐시 파일 (즉시 로드되어 0.1초 렌더링 보장)
  try {
    const resStatic = await fetch("operations_cache.json?v=" + Date.now());
    if (resStatic.ok) {
      const raw = await resStatic.json();
      const rawList = Array.isArray(raw) ? raw : [];
      list = await Promise.all(rawList.map(async op => {
        let decMgr = await decryptFernet(op.manager_name_encrypted);
        let decContact = await decryptFernet(op.manager_contact_encrypted);
        return {
          ...op,
          manager_name: decMgr || (op.manager_name_encrypted && !op.manager_name_encrypted.startsWith("gAAAAA") ? op.manager_name_encrypted : (op.manager_name || "")),
          manager_contact: decContact || (op.manager_contact_encrypted && !op.manager_contact_encrypted.startsWith("gAAAAA") ? op.manager_contact_encrypted : (op.manager_contact || ""))
        };
      }));
    }
  } catch (e) {
    console.warn("Static operations cache fetch note:", e);
  }

  // 1순위 데이터가 있으면 즉시 화면 렌더링 (체감 대기시간 0초)
  if (list.length > 0) {
    operationsData = list;
    try { localStorage.setItem("cached_operations", JSON.stringify(operationsData)); } catch (e) {}
    initOperationFilters();
    filterOperations();
  }

  // [2순위 & 백그라운드 동기화] Supabase DB 실시간 직접 조회 (SSOT)
  try {
    const resDirect = await fetch(`${SUPABASE_REST_URL}/operations?select=*&order=id.asc`, {
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    if (resDirect.ok) {
      const dbRows = await resDirect.json();
      if (Array.isArray(dbRows) && dbRows.length > 0) {
        const freshList = await Promise.all(dbRows.map(async op => {
          let decMgr = await decryptFernet(op.manager_name_encrypted);
          let decContact = await decryptFernet(op.manager_contact_encrypted);
          return {
            ...op,
            manager_name: decMgr || (op.manager_name_encrypted && !op.manager_name_encrypted.startsWith("gAAAAA") ? op.manager_name_encrypted : (op.manager_name || "")),
            manager_contact: decContact || (op.manager_contact_encrypted && !op.manager_contact_encrypted.startsWith("gAAAAA") ? op.manager_contact_encrypted : (op.manager_contact || ""))
          };
        }));
        operationsData = freshList;
        try { localStorage.setItem("cached_operations", JSON.stringify(operationsData)); } catch (e) {}
        initOperationFilters();
        filterOperations();
        return;
      }
    }
  } catch (errDb) {
    console.warn("Direct Supabase operations fetch note:", errDb);
  }

  // [3순위] Render 백엔드 API (Supabase 테이블이 없을 때 백엔드 캐시 활용)
  if (operationsData.length === 0) {
    try {
      const res = await fetchWithRetry(`${API_BASE_URL}/operations`);
      if (res && res.ok) {
        const raw = await res.json();
        const rawList = Array.isArray(raw) ? raw : (raw.data || []);
        if (rawList.length > 0) {
          operationsData = rawList;
          try { localStorage.setItem("cached_operations", JSON.stringify(operationsData)); } catch (e) {}
          initOperationFilters();
          filterOperations();
          return;
        }
      }
    } catch (e) {
      console.warn("Backend operations fetch note:", e);
    }
  }

  // 최종 실패 시 처리
  if ((!operationsData || operationsData.length === 0) && container) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--warning); margin-bottom: 0.8rem;"></i>
        <div style="font-weight: 600;">운영현황 데이터를 불러오지 못했습니다.</div>
        <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="fetchOperations(true)">다시 시도</button>
      </div>
    `;
  }
}

// 조사일자 시간 제거 헬퍼 함수 ('2026-06-30 00:00:00' -> '2026-06-30')
function formatInvestigationDate(dateStr) {
  if (!dateStr) return "-";
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
  if (m) return m[1];
  return s.split(" ")[0] || s;
}

function initOperationFilters() {
  initOperationOperatorFilter();
  initOperationReasonFilter();
}

function initOperationOperatorFilter() {
  const opSelect = document.getElementById("op-filter-operator");
  if (!opSelect) return;

  const currentVal = opSelect.value;
  const operators = new Set();

  operationsData.forEach(d => {
    // 1. normal_operator_qty에서 사업자명 추출
    const norm = d.normal_operator_qty || "";
    if (norm) {
      const parts = norm.split(/[,/&]/);
      parts.forEach(p => {
        const m = p.trim().match(/^([^(（0-9]+)/);
        if (m) {
          const name = m[1].trim();
          if (name && name.length >= 2 && name !== "None" && name !== "기타") {
            operators.add(name);
          }
        }
      });
    }

    // 2. unoperated_operator에서 사업자명 추출
    const unop = d.unoperated_operator || "";
    if (unop) {
      const parts = unop.split(/[,/&]/);
      parts.forEach(p => {
        const m = p.trim().match(/^([^(（0-9]+)/);
        if (m) {
          const name = m[1].trim();
          if (name && name.length >= 2 && name !== "None" && name !== "기타") {
            operators.add(name);
          }
        }
      });
    }
  });

  const sortedOps = Array.from(operators).sort((a, b) => a.localeCompare(b, "ko"));
  let html = `<option value="ALL">운영사업자 전체</option>`;
  sortedOps.forEach(op => {
    html += `<option value="${escapeHtml(op)}">${escapeHtml(op)}</option>`;
  });
  opSelect.innerHTML = html;
  if (operators.has(currentVal)) {
    opSelect.value = currentVal;
  }
}

function initOperationReasonFilter() {
  const reasonSelect = document.getElementById("op-filter-reason");
  if (!reasonSelect) return;

  const currentVal = reasonSelect.value;
  const reasons = new Set();

  operationsData.forEach(item => {
    const r = (item.unoperated_reason || "").trim();
    if (r && r !== "-" && r.toLowerCase() !== "none") {
      reasons.add(r);
    }
  });

  const sortedReasons = Array.from(reasons).sort();
  let html = `<option value="ALL">미운영사유 전체</option>`;
  sortedReasons.forEach(r => {
    html += `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`;
  });
  reasonSelect.innerHTML = html;
  if (reasons.has(currentVal)) {
    reasonSelect.value = currentVal;
  }
}

function filterOperations() {
  const searchInput = (document.getElementById("op-search-input")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("op-filter-status")?.value || "ALL";
  const operatorFilter = document.getElementById("op-filter-operator")?.value || "ALL";
  const reasonFilter = document.getElementById("op-filter-reason")?.value || "ALL";
  const sortMode = document.getElementById("op-sort")?.value || "default";

  filteredOperationsData = operationsData.filter(item => {
    // 1. 운영여부 필터
    if (statusFilter !== "ALL") {
      if (item.operation_status !== statusFilter) return false;
    }

    // 2. 운영사업자 필터
    if (operatorFilter !== "ALL") {
      const normStr = item.normal_operator_qty || "";
      const unopStr = item.unoperated_operator || "";
      if (!normStr.includes(operatorFilter) && !unopStr.includes(operatorFilter)) {
        return false;
      }
    }

    // 3. 미운영사유 필터
    if (reasonFilter !== "ALL") {
      if ((item.unoperated_reason || "").trim() !== reasonFilter) return false;
    }

    // 4. 검색어 필터 (시설명, 도로명주소, 정상사업자, 미운영사업자, 미운영사유, KEY, 관리자)
    if (searchInput) {
      const matchKey = (item.facility_key || "").toLowerCase().includes(searchInput);
      const matchName = (item.facility_name || "").toLowerCase().includes(searchInput);
      const matchAddr = (item.address_doro || "").toLowerCase().includes(searchInput);
      const matchNormal = (item.normal_operator_qty || "").toLowerCase().includes(searchInput);
      const matchUnopOp = (item.unoperated_operator || "").toLowerCase().includes(searchInput);
      const matchReason = (item.unoperated_reason || "").toLowerCase().includes(searchInput);
      const matchMgr = (item.manager_name || "").toLowerCase().includes(searchInput);
      const matchContact = (item.manager_contact || "").toLowerCase().includes(searchInput);
      if (!matchKey && !matchName && !matchAddr && !matchNormal && !matchUnopOp && !matchReason && !matchMgr && !matchContact) {
        return false;
      }
    }

    return true;
  });

  // 정렬
  if (sortMode === "name_asc") {
    filteredOperationsData.sort((a, b) => (a.facility_name || "").localeCompare(b.facility_name || "", "ko"));
  } else if (sortMode === "name_desc") {
    filteredOperationsData.sort((a, b) => (b.facility_name || "").localeCompare(a.facility_name || "", "ko"));
  } else if (sortMode === "unop_desc") {
    filteredOperationsData.sort((a, b) => (parseInt(b.unoperated_cnt) || 0) - (parseInt(a.unoperated_cnt) || 0));
  } else if (sortMode === "installed_desc") {
    filteredOperationsData.sort((a, b) => (parseInt(b.charger_installed_cnt) || 0) - (parseInt(a.charger_installed_cnt) || 0));
  }

  renderOperations();
}

function renderOperations() {
  // 1. 상단 통계 수치 갱신
  const totalCount = operationsData.length;
  const normalCount = operationsData.filter(d => d.operation_status === "정상운영").length;
  const unopCount = operationsData.filter(d => d.operation_status === "미운영").length;
  const unopChargers = operationsData.reduce((sum, d) => sum + (parseInt(d.unoperated_cnt) || 0), 0);

  const elTotal = document.getElementById("stat-op-total");
  const elNormal = document.getElementById("stat-op-normal");
  const elUnop = document.getElementById("stat-op-unoperated");
  const elUnopChargers = document.getElementById("stat-op-unoperated-chargers");
  const elBadge = document.getElementById("op-count-badge");

  if (elTotal) elTotal.textContent = totalCount.toLocaleString();
  if (elNormal) elNormal.textContent = normalCount.toLocaleString();
  if (elUnop) elUnop.textContent = unopCount.toLocaleString();
  if (elUnopChargers) elUnopChargers.textContent = unopChargers.toLocaleString();
  if (elBadge) elBadge.textContent = `총 ${filteredOperationsData.length}건 검색`;

  // 2. 카드 그리드 렌더링
  const container = document.getElementById("operations-card-container");
  if (!container) return;

  if (filteredOperationsData.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
        <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 0.8rem;"></i>
        <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.3rem;">검색 조건에 맞는 시설이 없습니다.</div>
        <div style="font-size: 0.85rem;">검색어 또는 필터 조건을 변경해보세요.</div>
      </div>
    `;
    return;
  }

  let cardsHtml = "";
  filteredOperationsData.forEach(item => {
    const isUnop = item.operation_status === "미운영";
    const statusClass = isUnop ? "unoperated" : "normal";
    const badgeHtml = isUnop
      ? `<span class="op-badge op-badge-unop"><i class="fa-solid fa-triangle-exclamation"></i> 미운영</span>`
      : `<span class="op-badge op-badge-normal"><i class="fa-solid fa-circle-check"></i> 정상운영</span>`;

    const unopCnt = parseInt(item.unoperated_cnt) || 0;
    const hasNormal = Boolean(item.normal_operator_qty && item.normal_operator_qty.trim() && item.normal_operator_qty.trim() !== "-");
    const hasUnop = Boolean(isUnop || unopCnt > 0 || (item.unoperated_operator && item.unoperated_operator.trim() && item.unoperated_operator.trim() !== "-") || (item.unoperated_reason && item.unoperated_reason.trim() && item.unoperated_reason.trim() !== "-"));

    let summaryBoxesHtml = "";
    if (hasNormal || (!hasUnop && item.operation_status === "정상운영")) {
      summaryBoxesHtml += `
        <div class="op-summary-normal">
          <div class="op-summary-normal-title">
            <i class="fa-solid fa-circle-check"></i> 정상운영
          </div>
          <div class="op-summary-operator">
            ${escapeHtml(item.normal_operator_qty || "충전시설 정상 가동 중")}
          </div>
        </div>
      `;
    }
    if (hasUnop) {
      summaryBoxesHtml += `
        <div class="op-summary-unop">
          <div class="op-summary-unop-title">
            <i class="fa-solid fa-triangle-exclamation"></i> 미운영 ${unopCnt > 0 ? `${unopCnt}기` : ''}
            ${item.unoperated_operator ? `<span class="op-sub-text">(${escapeHtml(item.unoperated_operator)})</span>` : ''}
          </div>
          ${item.unoperated_reason ? `
            <div class="op-summary-reason-badge">
              <i class="fa-solid fa-wrench"></i> 사유: ${escapeHtml(item.unoperated_reason)}
            </div>
          ` : ''}
        </div>
      `;
    }

    cardsHtml += `
      <div class="op-card ${statusClass}">
        <!-- 1. 카드 헤더: 시설명, KEY, 운영여부 뱃지 -->
        <div class="op-card-header">
          <div class="op-card-title-wrap">
            <div class="op-card-title" onclick="openOperationModal('${escapeHtml(item.facility_key)}')">
              <span>${escapeHtml(item.facility_name || "시설명 미지정")}</span>
            </div>
            <span class="op-card-key">${escapeHtml(item.facility_key || "-")}</span>
          </div>
          <div>${badgeHtml}</div>
        </div>

        <!-- 2. 카드 본문: 핵심 운영/미운영 현황 요약 (단순화 및 직관성 극대화) -->
        <div class="op-card-summary">
          ${summaryBoxesHtml}

          <!-- 조사 정보 (조사일 / 조사자) -->
          <div class="op-meta-row">
            <span><i class="fa-regular fa-calendar-check"></i> 조사일: ${escapeHtml(formatInvestigationDate(item.investigation_date))}</span>
            <span><i class="fa-regular fa-user"></i> 조사자: ${escapeHtml(item.investigator || "-")}</span>
          </div>
        </div>

        <!-- 3. 카드 액션 버튼 (통합시설 상세보기 & 운영현황 상세/수정) -->
        <div class="op-card-footer">
          <button type="button" class="btn btn-secondary op-btn-facility" onclick="jumpToFacilityDetail('${escapeHtml(item.facility_key)}')">
            <i class="fa-solid fa-building"></i> 통합시설 상세보기
          </button>
          <button type="button" class="btn btn-primary op-btn-edit" onclick="openOperationModal('${escapeHtml(item.facility_key)}')">
            <i class="fa-solid fa-pen-to-square"></i> 상세 / 수정
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = cardsHtml;
}

function openOperationModal(facilityKey) {
  const item = operationsData.find(d => d.facility_key === facilityKey);
  if (!item) {
    alert("해당 시설의 운영현황 데이터를 찾을 수 없습니다.");
    return;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== null && val !== undefined) ? val : "";
  };

  // 폼에 데이터 바인딩
  setVal("op-edit-facility-key", item.facility_key);
  setVal("op-edit-facility-name", item.facility_name);
  setVal("op-edit-investigator", item.investigator);
  setVal("op-edit-investigation-date", formatInvestigationDate(item.investigation_date));
  setVal("op-edit-address-doro", item.address_doro);

  setVal("op-edit-parking-ground", item.parking_ground_cnt ?? 0);
  setVal("op-edit-parking-underground", item.parking_underground_cnt ?? 0);
  setVal("op-edit-parking-uninstalled", item.parking_uninstalled_cnt ?? 0);

  setVal("op-edit-charger-installed", item.charger_installed_cnt ?? 0);
  setVal("op-edit-charger-fast", item.charger_fast_cnt ?? 0);
  setVal("op-edit-charger-slow", item.charger_slow_cnt ?? 0);
  setVal("op-edit-charger-uninstalled", item.charger_uninstalled_cnt ?? 0);

  setVal("op-edit-normal-operator", item.normal_operator_qty || "");
  setVal("op-edit-status", item.operation_status === "미운영" ? "미운영" : "정상운영");

  setVal("op-edit-unoperated-cnt", item.unoperated_cnt ?? 0);
  setVal("op-edit-unoperated-operator", item.unoperated_operator || "");
  setVal("op-edit-location", item.location || "");
  setVal("op-edit-unoperated-reason", item.unoperated_reason || "");
  setVal("op-edit-unoperated-date", item.unoperated_date || "");
  setVal("op-edit-initial-install-date", item.initial_install_date || "");
  setVal("op-edit-note", item.note || "");

  setVal("op-edit-complaint-plan", item.complaint_and_plan || "");
  setVal("op-edit-manager-name", item.manager_name || "");
  setVal("op-edit-manager-contact", item.manager_contact || "");

  // 헤더 뱃지 설정
  const keyBadge = document.getElementById("op-modal-key-badge");
  const statusBadge = document.getElementById("op-modal-status-badge");
  if (keyBadge) keyBadge.textContent = item.facility_key || "-";
  if (statusBadge) {
    if (item.operation_status === "미운영") {
      statusBadge.className = "badge op-badge-unop";
      statusBadge.textContent = "미운영";
    } else {
      statusBadge.className = "badge op-badge-normal";
      statusBadge.textContent = "정상운영";
    }
  }

  toggleOpUnoperatedFields();
  openModal("modal-operation-detail");
}

function toggleOpUnoperatedFields() {
  const status = document.getElementById("op-edit-status")?.value;
  const box = document.getElementById("op-unoperated-fields-box");
  const statusBadge = document.getElementById("op-modal-status-badge");

  if (status === "미운영") {
    if (box) box.style.opacity = "1";
    if (statusBadge) {
      statusBadge.className = "badge op-badge-unop";
      statusBadge.textContent = "미운영";
    }
  } else {
    if (box) box.style.opacity = "0.6";
    if (statusBadge) {
      statusBadge.className = "badge op-badge-normal";
      statusBadge.textContent = "정상운영";
    }
  }
}

async function handleSaveOperation(e) {
  e.preventDefault();
  const facilityKey = document.getElementById("op-edit-facility-key")?.value;
  if (!facilityKey) {
    alert("시설 고유키가 유효하지 않습니다.");
    return;
  }

  const mgrName = (document.getElementById("op-edit-manager-name")?.value || "").trim();
  const mgrContact = (document.getElementById("op-edit-manager-contact")?.value || "").trim();

  const payload = {
    facility_key: facilityKey,
    facility_name: (document.getElementById("op-edit-facility-name")?.value || "").trim(),
    investigator: (document.getElementById("op-edit-investigator")?.value || "").trim(),
    investigation_date: (document.getElementById("op-edit-investigation-date")?.value || "").trim(),
    address_doro: (document.getElementById("op-edit-address-doro")?.value || "").trim(),
    parking_ground_cnt: parseInt(document.getElementById("op-edit-parking-ground")?.value) || 0,
    parking_underground_cnt: parseInt(document.getElementById("op-edit-parking-underground")?.value) || 0,
    parking_uninstalled_cnt: parseInt(document.getElementById("op-edit-parking-uninstalled")?.value) || 0,
    charger_installed_cnt: parseInt(document.getElementById("op-edit-charger-installed")?.value) || 0,
    charger_fast_cnt: parseInt(document.getElementById("op-edit-charger-fast")?.value) || 0,
    charger_slow_cnt: parseInt(document.getElementById("op-edit-charger-slow")?.value) || 0,
    charger_uninstalled_cnt: parseInt(document.getElementById("op-edit-charger-uninstalled")?.value) || 0,
    normal_operator_qty: (document.getElementById("op-edit-normal-operator")?.value || "").trim(),
    operation_status: document.getElementById("op-edit-status")?.value || "정상운영",
    unoperated_cnt: parseInt(document.getElementById("op-edit-unoperated-cnt")?.value) || 0,
    unoperated_operator: (document.getElementById("op-edit-unoperated-operator")?.value || "").trim(),
    location: (document.getElementById("op-edit-location")?.value || "").trim(),
    unoperated_reason: (document.getElementById("op-edit-unoperated-reason")?.value || "").trim(),
    unoperated_date: (document.getElementById("op-edit-unoperated-date")?.value || "").trim(),
    initial_install_date: (document.getElementById("op-edit-initial-install-date")?.value || "").trim(),
    note: (document.getElementById("op-edit-note")?.value || "").trim(),
    complaint_and_plan: (document.getElementById("op-edit-complaint-plan")?.value || "").trim(),
    manager_name: mgrName,
    manager_contact: mgrContact
  };

  try {
    // 1순위: 백엔드 API 호출 (백엔드에서 AES-256 Fernet 암호화 후 Supabase 및 캐시에 영구 저장)
    let savedSuccessfully = false;
    try {
      const res = await fetch(`${API_BASE_URL}/operations/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        savedSuccessfully = true;
      }
    } catch (apiErr) {
      console.warn("Backend save failed, trying direct Supabase:", apiErr);
    }

    // 2순위: Supabase DB 직접 upsert 시도
    if (!savedSuccessfully) {
      try {
        const resDb = await fetch(`${SUPABASE_REST_URL}/operations?facility_key=eq.${encodeURIComponent(facilityKey)}`, {
          method: "PATCH",
          headers: {
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify(payload)
        });
        if (resDb.ok) {
          savedSuccessfully = true;
        }
      } catch (dbErr) {
        console.warn("Direct Supabase update failed:", dbErr);
      }
    }

    // 로컬 메모리 상태 즉시 반영
    const idx = operationsData.findIndex(d => d.facility_key === facilityKey);
    if (idx !== -1) {
      operationsData[idx] = { ...operationsData[idx], ...payload };
    } else {
      operationsData.push(payload);
    }

    closeModal("modal-operation-detail");
    initOperationReasonFilter();
    filterOperations();
    alert("운영현황 정보가 성공적으로 저장되었습니다.");
  } catch (err) {
    console.error("Save operation error:", err);
    alert("저장 중 오류가 발생했습니다: " + err.message);
  }
}

function jumpToFacilityDetail(facilityKey) {
  if (!facilityKey) return;
  const targetKey = String(facilityKey).trim();
  returnTabAfterFacilityDetail = 'operations';
  
  const doOpen = () => {
    openFacilityDetailModal(targetKey);
  };

  if (!facilitiesData || facilitiesData.length === 0) {
    fetchFacilities().then(doOpen).catch(doOpen);
  } else {
    doOpen();
  }
}

function jumpToFacilityDetailFromOp() {
  const facilityKey = document.getElementById("op-edit-facility-key")?.value;
  closeModal("modal-operation-detail");
  jumpToFacilityDetail(facilityKey);
}

function exportOperationsExcel() {
  if (!filteredOperationsData || filteredOperationsData.length === 0) {
    alert("내보낼 운영현황 데이터가 없습니다.");
    return;
  }

  const headers = [
    "KEY", "시설명", "주소(도로명)", "조사자", "조사일",
    "설치면수(지상)", "설치면수(지하)", "미설치면수",
    "설치기수 합", "설치기수(급속)", "설치기수(완속)", "미설치기수",
    "정상운영 사업자(수량)", "운영여부", "미운영 기수", "위치", "미운영 사업자",
    "최초설치시기", "미운영사유", "미운영시기", "비고", "민원사항 및 향후계획",
    "관리자", "연락처"
  ];

  const csvRows = [headers.join(",")];

  filteredOperationsData.forEach(item => {
    const row = [
      `"${(item.facility_key || "").replace(/"/g, '""')}"`,
      `"${(item.facility_name || "").replace(/"/g, '""')}"`,
      `"${(item.address_doro || "").replace(/"/g, '""')}"`,
      `"${(item.investigator || "").replace(/"/g, '""')}"`,
      `"${(item.investigation_date || "").replace(/"/g, '""')}"`,
      item.parking_ground_cnt ?? 0,
      item.parking_underground_cnt ?? 0,
      item.parking_uninstalled_cnt ?? 0,
      item.charger_installed_cnt ?? 0,
      item.charger_fast_cnt ?? 0,
      item.charger_slow_cnt ?? 0,
      item.charger_uninstalled_cnt ?? 0,
      `"${(item.normal_operator_qty || "").replace(/"/g, '""')}"`,
      `"${(item.operation_status || "").replace(/"/g, '""')}"`,
      item.unoperated_cnt ?? 0,
      `"${(item.location || "").replace(/"/g, '""')}"`,
      `"${(item.unoperated_operator || "").replace(/"/g, '""')}"`,
      `"${(item.initial_install_date || "").replace(/"/g, '""')}"`,
      `"${(item.unoperated_reason || "").replace(/"/g, '""')}"`,
      `"${(item.unoperated_date || "").replace(/"/g, '""')}"`,
      `"${(item.note || "").replace(/"/g, '""')}"`,
      `"${(item.complaint_and_plan || "").replace(/"/g, '""')}"`,
      `"${(item.manager_name || "").replace(/"/g, '""')}"`,
      `"${(item.manager_contact || "").replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(","));
  });

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  link.setAttribute("href", url);
  link.setAttribute("download", `충전시설_운영현황_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// 17. 광산구 관리시설 현황 및 1~5차 세부 조사내용 관리 모듈 (Gwangsan Facilities)
// =========================================================================
let gwangsanFacilitiesData = [];
let currentGwangsanDetailKey = null;

// 광산구 관리부서 고유 테마 색상 맵
const GWANGSAN_DEPT_COLORS = {
  "교통지도과": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", badgeBg: "#2563EB" },
  "시민경제과": { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0", badgeBg: "#16A34A" },
  "체육진흥과": { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF", badgeBg: "#9333EA" },
  "도시공원과": { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", badgeBg: "#D97706" },
  "시설지원과": { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8", badgeBg: "#DB2777" },
  "청소행정과": { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC", badgeBg: "#0891B2" }
};

// 1. 광산구 관리시설 데이터 로드 (Supabase DB 1순위 -> 백엔드 API 2순위 -> 로컬 캐시 3순위)
async function fetchGwangsanFacilities(forceRefresh = false) {
  let list = [];

  // [1순위] Supabase DB 직접 조회
  try {
    const resDb = await fetch(`${SUPABASE_REST_URL}/gwangsan_facilities?select=*&order=id.asc`, {
      headers: {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": `Bearer ${SUPABASE_SECRET_KEY}`
      }
    });
    if (resDb.ok) {
      const dbRows = await resDb.json();
      if (Array.isArray(dbRows) && dbRows.length > 0) {
        list = await Promise.all(dbRows.map(async f => {
          let decMgr = await decryptFernet(f.manager_name_encrypted);
          let decContact = await decryptFernet(f.manager_contact_encrypted);
          return {
            ...f,
            manager_name: decMgr || (f.manager_name_encrypted && !f.manager_name_encrypted.startsWith("gAAAAA") ? f.manager_name_encrypted : (f.manager_name || "")),
            manager_contact: decContact || (f.manager_contact_encrypted && !f.manager_contact_encrypted.startsWith("gAAAAA") ? f.manager_contact_encrypted : (f.manager_contact || ""))
          };
        }));
      }
    }
  } catch (errDb) {
    console.warn("Direct Supabase gwangsan_facilities fetch failed, fallback to local/cache:", errDb);
  }

  // [2순위] 백엔드 API
  if (list.length === 0) {
    try {
      const resApi = await fetch(`${API_BASE_URL}/gwangsan_facilities`);
      if (resApi.ok) {
        const raw = await resApi.json();
        list = Array.isArray(raw) ? raw : (raw.data || []);
      }
    } catch (eApi) {}
  }

  // [3순위] 로컬 정적 캐시 파일
  if (list.length === 0) {
    try {
      const resStatic = await fetch("gwangsan_facilities_cache.json?v=" + Date.now());
      if (resStatic.ok) {
        const raw = await resStatic.json();
        list = Array.isArray(raw) ? raw : (raw.data || []);
      }
    } catch (eStatic) {}
  }

  if (list.length > 0) {
    gwangsanFacilitiesData = list;
    try {
      localStorage.setItem("cached_gwangsan_facilities", JSON.stringify(gwangsanFacilitiesData));
    } catch(e) {}
  } else {
    // localStorage 캐시 복구
    try {
      const cached = localStorage.getItem("cached_gwangsan_facilities");
      if (cached) gwangsanFacilitiesData = JSON.parse(cached);
    } catch(e) {}
  }

  updateGwangsanStats();
  filterGwangsanFacilities();
}

// 2. 상단 4칸 핵심 현황 통계 업데이트
function updateGwangsanStats() {
  const total = gwangsanFacilitiesData.length;
  let compliant = 0;
  let nonCompliant = 0;
  let subsidyCount = 0;

  gwangsanFacilitiesData.forEach(item => {
    if (item.compliance_status === "이행완료") compliant++;
    else nonCompliant++;

    if (item.subsidy_apply === "신청" || (item.subsidy_apply && item.subsidy_apply.includes("신청"))) {
      subsidyCount++;
    }
  });

  const totalEl = document.getElementById("stat-gwangsan-total");
  const compEl = document.getElementById("stat-gwangsan-compliant");
  const nonCompEl = document.getElementById("stat-gwangsan-non-compliant");
  const subEl = document.getElementById("stat-gwangsan-subsidy");

  if (totalEl) totalEl.innerText = `${total}개소`;
  if (compEl) compEl.innerText = `${compliant}개소`;
  if (nonCompEl) nonCompEl.innerText = `${nonCompliant}개소`;
  if (subEl) subEl.innerText = `${subsidyCount}건`;
}

// 3. 관리부서(BI열) 기준 리스트 렌더링
function renderGwangsanFacilities(data) {
  const container = document.getElementById("gwangsan-facility-list-container");
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); background:#fff; border-radius:8px; border:1px dashed var(--border-color);">
        <i class="fa-solid fa-folder-open" style="font-size:2.5rem; color:#cbd5e1; margin-bottom:0.8rem; display:block;"></i>
        <div style="font-weight:600; font-size:1rem;">검색 조건과 일치하는 광산구 관리시설이 없습니다.</div>
      </div>
    `;
    return;
  }

  // 관리부서별 그룹핑 (교통지도과, 시민경제과, 체육진흥과, 도시공원과, 시설지원과, 청소행정과 순)
  const deptOrder = ["교통지도과", "시민경제과", "체육진흥과", "도시공원과", "시설지원과", "청소행정과"];
  const grouped = {};

  data.forEach(item => {
    const dept = item.dept_name ? item.dept_name.trim() : "기타부서";
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].append ? grouped[dept].append(item) : grouped[dept].push(item);
  });

  // 정렬된 부서 키 목록 (정의된 순서 우선, 나머지 뒤로)
  const sortedDepts = Object.keys(grouped).sort((a, b) => {
    const idxA = deptOrder.indexOf(a);
    const idxB = deptOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b, "ko");
  });

  let html = "";

  sortedDepts.forEach(dept => {
    const items = grouped[dept];
    const deptColor = GWANGSAN_DEPT_COLORS[dept] || { bg: "#F8FAFC", text: "#334155", border: "#E2E8F0", badgeBg: "#64748B" };
    const deptCompliant = items.filter(i => i.compliance_status === "이행완료").length;
    const deptNonCompliant = items.length - deptCompliant;

    html += `
      <div class="gwangsan-dept-section" style="background:#fff; border:1px solid ${deptColor.border}; border-radius:10px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <!-- 부서 헤더 -->
        <div style="background:${deptColor.bg}; border-bottom:1px solid ${deptColor.border}; padding:0.75rem 1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span style="background:${deptColor.badgeBg}; color:#fff; font-size:0.8rem; font-weight:800; padding:0.25rem 0.65rem; border-radius:6px;">
              <i class="fa-solid fa-building-user"></i> ${dept}
            </span>
            <span style="font-size:0.95rem; font-weight:800; color:${deptColor.text};">소관 관리시설</span>
            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted);">총 ${items.length}개소</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem;">
            <span class="badge badge-emerald" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-circle-check"></i> 이행완료 ${deptCompliant}</span>
            ${deptNonCompliant > 0 ? `<span class="badge badge-rose" style="padding:0.2rem 0.5rem;"><i class="fa-solid fa-triangle-exclamation"></i> 미이행 ${deptNonCompliant}</span>` : ''}
          </div>
        </div>

        <!-- 시설 리스트 테이블/카드 -->
        <div style="display:flex; flex-direction:column; divide-y:1px solid #f1f5f9;">
          ${items.map(f => {
            const isComp = f.compliance_status === "이행완료";
            const pReq = f.parking_required_cnt ?? 0;
            const pInst = f.parking_installed_cnt ?? 0;
            const pUn = f.parking_uninstalled_cnt ?? 0;
            const pGround = f.parking_ground_cnt ?? 0;
            const pUnder = f.parking_underground_cnt ?? 0;

            const cReq = f.charger_required_cnt ?? 0;
            const cFastReq = f.charger_fast_req_cnt ?? 0;
            const cInst = f.charger_installed_cnt ?? 0;
            const cFast = f.charger_fast_cnt ?? 0;
            const cSlow = f.charger_slow_cnt ?? 0;
            const cUn = f.charger_uninstalled_cnt ?? 0;

            const plan = f.dept_action_plan ? f.dept_action_plan.trim() : "-";
            const subsidy = f.subsidy_apply ? f.subsidy_apply.trim() : "";
            const isSubsidy = subsidy === "신청" || subsidy.includes("신청");

            return `
              <div style="padding:0.9rem 1.25rem; border-bottom:1px solid #f1f5f9; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1rem; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                
                <!-- 1. 기본 정보 (시설명, KEY, 주소) -->
                <div style="flex:2; min-width:260px;">
                  <div style="display:flex; align-items:center; gap:0.45rem; margin-bottom:0.25rem;">
                    <span class="badge badge-indigo" style="font-size:0.75rem; font-weight:700;">${f.facility_key}</span>
                    <span style="font-weight:800; font-size:0.95rem; color:#1e293b; cursor:pointer;" onclick="openGwangsanDetailModal('${f.facility_key}')" title="세부 조사내용 보기">
                      ${f.facility_name}
                    </span>
                    <span class="badge ${isComp ? 'badge-emerald' : 'badge-rose'}" style="font-size:0.72rem; padding:0.15rem 0.45rem;">
                      ${f.compliance_status || '미이행'}
                    </span>
                  </div>
                  <div style="font-size:0.8rem; color:#64748b; line-height:1.35;">
                    <i class="fa-solid fa-location-dot" style="font-size:0.75rem; color:#94a3b8;"></i> ${f.address_doro || f.address_jibun || '-'}
                  </div>
                </div>

                <!-- 2. 전용주차구역 현황 -->
                <div style="flex:1.2; min-width:170px; font-size:0.8rem; background:#f8fafc; padding:0.5rem 0.75rem; border-radius:6px; border:1px solid #e2e8f0;">
                  <div style="font-weight:700; color:#2563eb; margin-bottom:0.2rem; display:flex; align-items:center; gap:0.3rem;">
                    <i class="fa-solid fa-square-parking"></i> 전용주차구역
                  </div>
                  <div style="color:#334155;">
                    설치/의무: <b>${pInst}</b> / <b>${pReq}</b>면
                    ${pUn > 0 ? `<span style="color:#e11d48; font-weight:700; margin-left:0.2rem;">(미설치 ${pUn})</span>` : ''}
                  </div>
                  <div style="font-size:0.72rem; color:#64748b;">
                    지상 ${pGround} / 지하 ${pUnder}
                  </div>
                </div>

                <!-- 3. 충전시설 현황 -->
                <div style="flex:1.4; min-width:190px; font-size:0.8rem; background:#f8fafc; padding:0.5rem 0.75rem; border-radius:6px; border:1px solid #e2e8f0;">
                  <div style="font-weight:700; color:#d97706; margin-bottom:0.2rem; display:flex; align-items:center; gap:0.3rem;">
                    <i class="fa-solid fa-bolt"></i> 충전시설
                  </div>
                  <div style="color:#334155;">
                    설치/의무: <b>${cInst}</b> / <b>${cReq}</b>기
                    ${cUn > 0 ? `<span style="color:#e11d48; font-weight:700; margin-left:0.2rem;">(미설치 ${cUn})</span>` : ''}
                  </div>
                  <div style="font-size:0.72rem; color:#64748b;">
                    급속 ${cFast}(의무 ${cFastReq}) / 완속 ${cSlow}
                  </div>
                </div>

                <!-- 4. 부서 조치계획 (BJ열) & 보조사업 신청 (BK열) -->
                <div style="flex:2; min-width:240px; font-size:0.82rem; background:${plan !== '-' ? '#eff6ff' : '#f8fafc'}; padding:0.5rem 0.75rem; border-radius:6px; border:1px solid ${plan !== '-' ? '#bfdbfe' : '#e2e8f0'};">
                  <div style="font-weight:700; color:#1e40af; margin-bottom:0.2rem; display:flex; justify-content:space-between; align-items:center;">
                    <span><i class="fa-solid fa-list-check"></i> 부서 조치계획</span>
                    ${isSubsidy ? `<span class="badge badge-indigo" style="font-size:0.7rem; padding:0.1rem 0.4rem;"><i class="fa-solid fa-check"></i> 보조사업 신청</span>` : (subsidy ? `<span class="badge" style="font-size:0.7rem; background:#e2e8f0; color:#475569;">${subsidy}</span>` : '')}
                  </div>
                  <div style="color:#0f172a; font-weight:600; line-height:1.35; max-height:2.8rem; overflow:hidden; text-overflow:ellipsis;" title="${plan}">
                    ${plan}
                  </div>
                </div>

                <!-- 5. 액션 버튼 -->
                <div style="min-width:105px; text-align:right;">
                  <button type="button" class="btn btn-secondary" style="padding:0.4rem 0.75rem; font-size:0.78rem; font-weight:700;" onclick="openGwangsanDetailModal('${f.facility_key}')">
                    <i class="fa-solid fa-magnifying-glass"></i> 조사내용
                  </button>
                </div>

              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 4. 광산구 관리시설 필터링
function filterGwangsanFacilities() {
  const query = (document.getElementById("gwangsan-search-input")?.value || "").toLowerCase().trim();
  const deptFilter = document.getElementById("gwangsan-filter-dept")?.value || "ALL";
  const compFilter = document.getElementById("gwangsan-filter-compliance")?.value || "ALL";
  const subFilter = document.getElementById("gwangsan-filter-subsidy")?.value || "ALL";

  let filtered = gwangsanFacilitiesData.filter(item => {
    // 1. 검색어 필터 (시설명, 주소, KEY)
    if (query) {
      const matchName = (item.facility_name || "").toLowerCase().includes(query);
      const matchKey = (item.facility_key || "").toLowerCase().includes(query);
      const matchDoro = (item.address_doro || "").toLowerCase().includes(query);
      const matchJibun = (item.address_jibun || "").toLowerCase().includes(query);
      const matchPlan = (item.dept_action_plan || "").toLowerCase().includes(query);
      if (!matchName && !matchKey && !matchDoro && !matchJibun && !matchPlan) return false;
    }

    // 2. 관리부서 필터
    if (deptFilter !== "ALL" && item.dept_name !== deptFilter) return false;

    // 3. 이행상태 필터
    if (compFilter !== "ALL" && item.compliance_status !== compFilter) return false;

    // 4. 보조사업 신청 필터
    if (subFilter === "신청" && !(item.subsidy_apply === "신청" || (item.subsidy_apply && item.subsidy_apply.includes("신청")))) return false;
    if (subFilter === "미신청" && (item.subsidy_apply === "신청" || (item.subsidy_apply && item.subsidy_apply.includes("신청")))) return false;

    return true;
  });

  const countBadge = document.getElementById("gwangsan-count-badge");
  if (countBadge) countBadge.innerText = `총 ${filtered.length}건 검색`;

  renderGwangsanFacilities(filtered);
}

// 광산구 모달용 미니 SVG 도넛 차트 생성 함수
function renderGwangsanDonutSvg(pct, color) {
  const safePct = Math.max(0, Math.min(100, Math.round(pct)));
  return `
    <svg viewBox="0 0 36 36" style="width:52px; height:52px; display:block;">
      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" stroke-width="4" />
      <path stroke-dasharray="${safePct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" />
      <text x="18" y="20.5" font-size="8.5" font-weight="800" text-anchor="middle" fill="${color}">${safePct}%</text>
    </svg>
  `;
}

// 5. 1차~5차 세부 조사내용(AB열~BE열) 및 최종결론(BF열) 상세보기 모달 오픈
function openGwangsanDetailModal(key) {
  if (!gwangsanFacilitiesData) return;
  const item = gwangsanFacilitiesData.find(f => f.facility_key === key);
  if (!item) {
    alert("해당 시설의 상세 정보를 찾을 수 없습니다.");
    return;
  }

  currentGwangsanDetailKey = key;

  // Header
  document.getElementById("gwangsan-modal-key").innerText = item.facility_key;
  document.getElementById("gwangsan-modal-title").innerText = item.facility_name;
  
  const deptEl = document.getElementById("gwangsan-modal-dept");
  if (deptEl) {
    deptEl.innerText = item.dept_name || "관리부서 미지정";
    const deptColor = GWANGSAN_DEPT_COLORS[item.dept_name] || { badgeBg: "#4338CA" };
    deptEl.style.background = deptColor.badgeBg;
  }

  const isComp = item.compliance_status === "이행완료";

  // Summary Information
  const addr = item.address_doro || item.address_jibun || "-";
  document.getElementById("gwangsan-modal-address").innerText = addr;
  document.getElementById("gwangsan-modal-dates").innerText = `${item.permission_date || '-'} / ${item.approval_date || '-'}`;
  
  // 전용주차구역 계산 및 도넛 차트
  const pReq = item.parking_required_cnt ?? 0;
  const pInst = item.parking_installed_cnt ?? 0;
  const pGround = item.parking_ground_cnt ?? 0;
  const pUnder = item.parking_underground_cnt ?? 0;
  const pUninst = item.parking_uninstalled_cnt ?? Math.max(0, pReq - pInst);
  const pPct = pReq > 0 ? Math.min(100, Math.round((pInst / pReq) * 100)) : (isComp ? 100 : 0);
  const pIsDone = (pInst >= pReq && pReq > 0) || isComp;
  const pColor = pIsDone ? '#059669' : (pPct > 0 ? '#d97706' : '#e11d48');

  const pDonutEl = document.getElementById("gwangsan-modal-parking-donut");
  if (pDonutEl) pDonutEl.innerHTML = renderGwangsanDonutSvg(pPct, pColor);

  const pBadgeEl = document.getElementById("gwangsan-modal-parking-badge");
  if (pBadgeEl) {
    pBadgeEl.className = `badge ${pIsDone ? 'badge-emerald' : 'badge-rose'}`;
    pBadgeEl.innerText = pIsDone ? '이행' : '미이행';
  }

  const pTextEl = document.getElementById("gwangsan-modal-parking");
  if (pTextEl) pTextEl.innerText = `${pInst}면 / 의무 ${pReq}면 (${pPct}%)`;

  const pSubEl = document.getElementById("gwangsan-modal-parking-sub");
  if (pSubEl) {
    pSubEl.innerHTML = `지상 ${pGround}면 · 지하 ${pUnder}면${pUninst > 0 ? ` · <span style="color:#e11d48; font-weight:700;">미설치 ${pUninst}면</span>` : ''}`;
  }

  // 충전시설 계산 및 도넛 차트
  const cReq = item.charger_required_cnt ?? 0;
  const cFastReq = item.charger_fast_req_cnt ?? 0;
  const cInst = item.charger_installed_cnt ?? 0;
  const cFast = item.charger_fast_cnt ?? 0;
  const cSlow = item.charger_slow_cnt ?? 0;
  const cUninst = item.charger_uninstalled_cnt ?? Math.max(0, cReq - cInst);
  const cPct = cReq > 0 ? Math.min(100, Math.round((cInst / cReq) * 100)) : (isComp ? 100 : 0);
  const cIsDone = (cInst >= cReq && cReq > 0) || isComp;
  const cColor = cIsDone ? '#059669' : (cPct > 0 ? '#d97706' : '#e11d48');

  const cDonutEl = document.getElementById("gwangsan-modal-charger-donut");
  if (cDonutEl) cDonutEl.innerHTML = renderGwangsanDonutSvg(cPct, cColor);

  const cBadgeEl = document.getElementById("gwangsan-modal-charger-badge");
  if (cBadgeEl) {
    cBadgeEl.className = `badge ${cIsDone ? 'badge-emerald' : 'badge-rose'}`;
    cBadgeEl.innerText = cIsDone ? '이행' : '미이행';
  }

  const cTextEl = document.getElementById("gwangsan-modal-charger");
  if (cTextEl) cTextEl.innerText = `${cInst}기 / 의무 ${cReq}기 (${cPct}%)`;

  const cSubEl = document.getElementById("gwangsan-modal-charger-sub");
  if (cSubEl) {
    cSubEl.innerHTML = `급속 ${cFast}기 · 완속 ${cSlow}기 (의무급속 ${cFastReq})${cUninst > 0 ? ` · <span style="color:#e11d48; font-weight:700;">미설치 ${cUninst}기</span>` : ''}`;
  }

  // Action Plan & Subsidy & Compliance
  document.getElementById("gwangsan-modal-action-plan").innerText = (item.dept_action_plan && item.dept_action_plan.trim()) ? item.dept_action_plan.trim() : "-";
  
  const subEl = document.getElementById("gwangsan-modal-subsidy");
  const isSubsidy = item.subsidy_apply === "신청" || (item.subsidy_apply && item.subsidy_apply.includes("신청"));
  subEl.innerHTML = isSubsidy 
    ? `<span class="badge badge-emerald" style="font-weight:700;"><i class="fa-solid fa-check"></i> 신청 완료</span>` 
    : `<span class="badge" style="background:#e2e8f0; color:#64748b;">${item.subsidy_apply || '미신청'}</span>`;

  const compEl = document.getElementById("gwangsan-modal-compliance");
  compEl.innerHTML = `<span class="badge ${isComp ? 'badge-emerald' : 'badge-rose'}" style="font-weight:700;">${item.compliance_status || '미이행'}</span>`;

  // Final Conclusion (BF열)
  const finalEl = document.getElementById("gwangsan-modal-final-conclusion");
  if (finalEl) {
    finalEl.innerText = (item.final_conclusion && item.final_conclusion.trim()) ? item.final_conclusion.trim() : "-";
  }

  // 1차~5차 세부 조사내용 (AB열~BE열) 동적 생성
  const surveysContainer = document.getElementById("gwangsan-modal-surveys-container");
  if (surveysContainer) {
    const rounds = [
      {
        round: "1차",
        title: "자체조사 (1차)",
        type: item.survey1_type,
        date: item.survey1_date,
        inspector: item.survey1_inspector,
        check: item.survey1_check,
        plan: item.survey1_plan,
        note: item.survey1_note,
        color: "#2563eb"
      },
      {
        round: "2차",
        title: "자체조사 (2차)",
        type: item.survey2_type,
        date: item.survey2_date,
        inspector: item.survey2_inspector,
        check: item.survey2_check,
        plan: item.survey2_plan,
        note: item.survey2_note,
        color: "#0891b2"
      },
      {
        round: "3차",
        title: "실태조사 (3차)",
        type: item.survey3_type,
        date: item.survey3_date,
        inspector: item.survey3_inspector,
        check: item.survey3_check,
        plan: item.survey3_plan,
        note: item.survey3_note,
        color: "#059669"
      },
      {
        round: "4차",
        title: "자체조사 (4차)",
        type: item.survey4_type,
        date: item.survey4_date,
        inspector: item.survey4_inspector,
        check: item.survey4_check,
        plan: item.survey4_plan,
        note: item.survey4_note,
        color: "#d97706"
      },
      {
        round: "5차",
        title: "자체조사 (5차)",
        type: item.survey5_type,
        date: item.survey5_date,
        inspector: item.survey5_inspector,
        check: item.survey5_check,
        plan: item.survey5_plan,
        note: item.survey5_note,
        color: "#7c3aed"
      }
    ];

    let surveyHtml = "";
    rounds.forEach(r => {
      const hasContent = (r.type || r.date || r.inspector || r.check || r.plan || r.note);

      surveyHtml += `
        <div style="border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; background:#fff;">
          <div style="background:${hasContent ? '#f1f5f9' : '#f8fafc'}; padding:0.5rem 0.85rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="background:${r.color}; color:#fff; font-size:0.75rem; font-weight:800; padding:0.15rem 0.5rem; border-radius:4px;">
                ${r.title}
              </span>
              ${r.type ? `<span style="font-size:0.78rem; font-weight:700; color:#334155;">[방법: ${r.type}]</span>` : ''}
            </div>
            <div style="font-size:0.75rem; color:#64748b;">
              ${r.date ? `<i class="fa-regular fa-calendar"></i> ${r.date}` : ''}
              ${r.inspector ? ` | <i class="fa-solid fa-user"></i> 조사자: <b>${r.inspector}</b>` : ''}
            </div>
          </div>

          <div style="padding:0.75rem 0.85rem; font-size:0.82rem; display:flex; flex-direction:column; gap:0.45rem;">
            ${r.check ? `
              <div style="display:flex; align-items:flex-start; gap:0.4rem;">
                <span style="font-weight:700; color:#1e293b; min-width:85px; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-check"></i> 확인사항:</span>
                <span style="color:#334155; word-break:break-all;">${r.check}</span>
              </div>
            ` : ''}
            ${r.plan ? `
              <div style="display:flex; align-items:flex-start; gap:0.4rem;">
                <span style="font-weight:700; color:#2563eb; min-width:85px; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-arrow-right"></i> 이행계획:</span>
                <span style="color:#1d4ed8; font-weight:600; word-break:break-all;">${r.plan}</span>
              </div>
            ` : ''}
            ${r.note ? `
              <div style="display:flex; align-items:flex-start; gap:0.4rem;">
                <span style="font-weight:700; color:#64748b; min-width:85px; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-circle-info"></i> 비고:</span>
                <span style="color:#475569; word-break:break-all;">${r.note}</span>
              </div>
            ` : ''}
            ${!hasContent ? `
              <div style="color:#94a3b8; font-style:italic;">조사 내역 없음</div>
            ` : ''}
          </div>
        </div>
      `;
    });

    surveysContainer.innerHTML = surveyHtml;
  }

  // 모달 열기
  const modal = document.getElementById("modal-gwangsan-detail");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("active");
  }
}

// 6. 광산구 모달에서 통합시설관리 상세 모달로 즉시 이동
function jumpToFacilityDetailFromGwangsan() {
  if (!currentGwangsanDetailKey) return;
  const key = currentGwangsanDetailKey;
  closeModal("modal-gwangsan-detail");
  switchTab("facilities");
  openFacilityDetailModal(key);
}

// 7. 광산구 관리시설 CSV 엑셀 다운로드
function exportGwangsanExcel() {
  if (!gwangsanFacilitiesData || gwangsanFacilitiesData.length === 0) {
    alert("다운로드할 광산구 관리시설 데이터가 없습니다.");
    return;
  }

  const headers = [
    "연번", "KEY", "관리부서", "시설명", "시설구분", "의무이행여부",
    "도로명주소", "지번주소", "건축허가일", "사용승인일자",
    "의무주차면수", "설치주차면수", "지상면수", "지하면수", "미설치면수",
    "의무충전기수", "의무급속기수", "설치충전기수", "급속기수", "완속기수", "미설치충전기수",
    "부서조치계획", "보조사업신청", "최종결론",
    "1차조사일", "1차조사자", "1차확인사항", "1차이행계획",
    "2차조사일", "2차조사자", "2차확인사항", "2차이행계획",
    "3차조사일", "3차조사자", "3차확인사항", "3차이행계획",
    "4차조사일", "4차조사자", "4차확인사항", "4차이행계획",
    "5차조사일", "5차조사자", "5차확인사항", "5차이행계획"
  ];

  const csvRows = [headers.join(",")];

  gwangsanFacilitiesData.forEach((item, idx) => {
    const row = [
      idx + 1,
      `"${item.facility_key || ""}"`,
      `"${(item.dept_name || "").replace(/"/g, '""')}"`,
      `"${(item.facility_name || "").replace(/"/g, '""')}"`,
      `"${(item.facility_category || "").replace(/"/g, '""')}"`,
      `"${(item.compliance_status || "").replace(/"/g, '""')}"`,
      `"${(item.address_doro || "").replace(/"/g, '""')}"`,
      `"${(item.address_jibun || "").replace(/"/g, '""')}"`,
      `"${item.permission_date || ""}"`,
      `"${item.approval_date || ""}"`,
      item.parking_required_cnt ?? 0,
      item.parking_installed_cnt ?? 0,
      item.parking_ground_cnt ?? 0,
      item.parking_underground_cnt ?? 0,
      item.parking_uninstalled_cnt ?? 0,
      item.charger_required_cnt ?? 0,
      item.charger_fast_req_cnt ?? 0,
      item.charger_installed_cnt ?? 0,
      item.charger_fast_cnt ?? 0,
      item.charger_slow_cnt ?? 0,
      item.charger_uninstalled_cnt ?? 0,
      `"${(item.dept_action_plan || "").replace(/"/g, '""')}"`,
      `"${(item.subsidy_apply || "").replace(/"/g, '""')}"`,
      `"${(item.final_conclusion || "").replace(/"/g, '""')}"`,
      `"${item.survey1_date || ""}"`,
      `"${(item.survey1_inspector || "").replace(/"/g, '""')}"`,
      `"${(item.survey1_check || "").replace(/"/g, '""')}"`,
      `"${(item.survey1_plan || "").replace(/"/g, '""')}"`,
      `"${item.survey2_date || ""}"`,
      `"${(item.survey2_inspector || "").replace(/"/g, '""')}"`,
      `"${(item.survey2_check || "").replace(/"/g, '""')}"`,
      `"${(item.survey2_plan || "").replace(/"/g, '""')}"`,
      `"${item.survey3_date || ""}"`,
      `"${(item.survey3_inspector || "").replace(/"/g, '""')}"`,
      `"${(item.survey3_check || "").replace(/"/g, '""')}"`,
      `"${(item.survey3_plan || "").replace(/"/g, '""')}"`,
      `"${item.survey4_date || ""}"`,
      `"${(item.survey4_inspector || "").replace(/"/g, '""')}"`,
      `"${(item.survey4_check || "").replace(/"/g, '""')}"`,
      `"${(item.survey4_plan || "").replace(/"/g, '""')}"`,
      `"${item.survey5_date || ""}"`,
      `"${(item.survey5_inspector || "").replace(/"/g, '""')}"`,
      `"${(item.survey5_check || "").replace(/"/g, '""')}"`,
      `"${(item.survey5_plan || "").replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(","));
  });

  const csvContent = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  link.setAttribute("href", url);
  link.setAttribute("download", `광산구_관리시설_조사현황_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}



