/* OLKD Admin – client logic for the YAML config editor. */

// ── State ─────────────────────────────────────────────────────────────────
var token         = sessionStorage.getItem('admin_token') || '';
var activeSection = 'app';
var files         = [];
var activeFile    = null;
var dirty         = false;
var loading       = false;
var editor        = null;

// ── DOM ───────────────────────────────────────────────────────────────────
var loginPage    = document.getElementById('login-page');
var appEl        = document.getElementById('app');
var loginForm    = document.getElementById('login-form');
var tokenInput   = document.getElementById('token-input');
var loginError   = document.getElementById('login-error');
var listView     = document.getElementById('list-view');
var editView     = document.getElementById('edit-view');
var fileBody     = document.getElementById('file-table-body');
var searchInput  = document.getElementById('search-input');
var editTitle    = document.getElementById('edit-title');
var errorAlert   = document.getElementById('error-alert');
var errorMsg     = document.getElementById('error-msg');
var successAlert = document.getElementById('success-alert');
var successMsg   = document.getElementById('success-msg');
var sectionTitle = document.getElementById('section-title');
var saveBtn      = document.getElementById('save-btn');
var saveLabel    = document.getElementById('save-label');
var backBtn      = document.getElementById('back-btn');
var addBtn       = document.getElementById('add-btn');
var logoutBtn    = document.getElementById('logout-btn');

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ── Auth ──────────────────────────────────────────────────────────────────
function authHeaders(extra) {
  var h = Object.assign({}, extra || {});
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

async function apiFetch(url, opts) {
  opts = opts || {};
  opts.headers = authHeaders(opts.headers);
  var res = await fetch(url, opts);
  if (res.status === 401) { doLogout(); return null; }
  return res;
}

// ── Boot ──────────────────────────────────────────────────────────────────
async function init() {
  if (!token) { showLogin(); return; }
  var res = await apiFetch('/admin/api/verify', { method: 'POST' });
  if (!res) return;
  showApp();
  await loadSection('app');
}

function showLogin() {
  show(loginPage);
  hide(appEl);
  loginError.textContent = '';
  tokenInput.value = '';
  setTimeout(function() { tokenInput.focus(); }, 50);
}

function showApp() {
  hide(loginPage);
  show(appEl);
  if (!editor) initEditor();
}

function doLogout() {
  token = '';
  sessionStorage.removeItem('admin_token');
  showLogin();
}

loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  var t = tokenInput.value.trim();
  if (!t) return;
  var res = await fetch('/admin/api/verify', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + t }
  });
  if (res.status === 401) {
    loginError.textContent = 'Ungültiger Token.';
    return;
  }
  token = t;
  sessionStorage.setItem('admin_token', t);
  showApp();
  await loadSection('app');
});

logoutBtn.addEventListener('click', function(e) { e.preventDefault(); doLogout(); });

// ── Section switching ─────────────────────────────────────────────────────
function switchSection(section) {
  if (section === activeSection && !listView.classList.contains('hidden')) return false;
  if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return false;
  dirty = false;
  loadSection(section);
  return false;
}

async function loadSection(section) {
  activeSection = section;
  activeFile = null;

  document.getElementById('nav-app').classList.toggle('active', section === 'app');
  document.getElementById('nav-layers').classList.toggle('active', section === 'layers');

  var labels = { app: 'App-Konfigurationen', layers: 'Layer-Konfigurationen' };
  sectionTitle.textContent = labels[section];

  searchInput.value = '';
  showListView();
  await fetchFileList();
}

// ── List view ─────────────────────────────────────────────────────────────
function showListView() {
  show(listView);
  hide(editView);
  show(document.getElementById('search-form'));
}

async function fetchFileList() {
  var res = await apiFetch('/admin/api/configs/' + activeSection);
  if (!res) return;
  var data = await res.json();
  files = data.files || [];
  renderTable();
}

function renderTable() {
  var query = searchInput.value.toLowerCase();
  var filtered = files.filter(function(f) { return f.toLowerCase().indexOf(query) > -1; });
  fileBody.innerHTML = '';
  filtered.forEach(function(name) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><a href="#">' + escHtml(name) + '</a></td>' +
      '<td class="actions">' +
        '<button class="btn btn-default btn-xs">' +
          '<svg class="icon"><use href="#i-pencil"/></svg> Bearbeiten' +
        '</button>' +
        '<button class="btn btn-danger btn-xs">' +
          '<svg class="icon"><use href="#i-trash"/></svg> Löschen' +
        '</button>' +
      '</td>';
    tr.querySelector('a').addEventListener('click', function(e) { e.preventDefault(); openEdit(name); });
    tr.querySelectorAll('button')[0].addEventListener('click', function() { openEdit(name); });
    tr.querySelectorAll('button')[1].addEventListener('click', function() { deleteFile(name); });
    fileBody.appendChild(tr);
  });
}

addBtn.addEventListener('click', function() {
  var name = prompt('Dateiname (ohne .yaml):');
  if (!name || !name.trim()) return;
  createFile(name.trim());
});

async function createFile(name) {
  var res = await apiFetch(
    '/admin/api/configs/' + activeSection + '/' + encodeURIComponent(name),
    { method: 'POST', body: '', headers: { 'Content-Type': 'text/plain' } }
  );
  if (!res) return;
  var data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  await fetchFileList();
  openEdit(name.endsWith('.yaml') ? name : name + '.yaml');
}

async function deleteFile(name) {
  if (!confirm('"' + name + '" wirklich löschen?')) return;
  var res = await apiFetch(
    '/admin/api/configs/' + activeSection + '/' + encodeURIComponent(name),
    { method: 'DELETE' }
  );
  if (!res) return;
  var data = await res.json();
  if (!res.ok) { alert(data.error); return; }
  if (activeSection === 'layers') await apiFetch('/admin/api/reload', { method: 'POST' });
  await fetchFileList();
}

// ── Edit view ─────────────────────────────────────────────────────────────
function showEditView() {
  hide(listView);
  show(editView);
  hide(document.getElementById('search-form'));
  hideAlerts();
}

async function openEdit(name) {
  var res = await apiFetch('/admin/api/configs/' + activeSection + '/' + encodeURIComponent(name));
  if (!res) return;
  var data = await res.json();
  if (data.error) { alert(data.error); return; }

  activeFile = name;
  dirty = false;
  editTitle.textContent = name;
  setEditorContent(data.content);
  showEditView();
  editor.refresh();
}

backBtn.addEventListener('click', function() {
  if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  dirty = false;
  showListView();
});

// ── Editor ────────────────────────────────────────────────────────────────
function initEditor() {
  editor = CodeMirror(document.getElementById('editor-container'), {
    mode: 'yaml',
    lineNumbers: true,
    indentWithTabs: false,
    tabSize: 2,
    indentUnit: 2,
    value: ''
  });
  editor.on('change', function() {
    if (!loading) dirty = true;
  });
}

function setEditorContent(content) {
  loading = true;
  editor.setValue(content);
  editor.clearHistory();
  loading = false;
}

// ── Save ──────────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', saveFile);

async function saveFile() {
  if (!activeFile) return;
  hideAlerts();
  saveBtn.disabled = true;
  saveLabel.textContent = 'Speichern…';

  var content = editor.getValue();
  var res = await apiFetch(
    '/admin/api/configs/' + activeSection + '/' + encodeURIComponent(activeFile),
    { method: 'PUT', body: content, headers: { 'Content-Type': 'text/plain' } }
  );
  saveBtn.disabled = false;
  saveLabel.textContent = 'Speichern';
  if (!res) return;

  var data = await res.json();
  if (!res.ok) {
    errorMsg.textContent = data.error || 'Unbekannter Fehler';
    show(errorAlert);
    return;
  }

  if (activeSection === 'layers') await apiFetch('/admin/api/reload', { method: 'POST' });

  dirty = false;
  successMsg.textContent = data.message;
  show(successAlert);
  setTimeout(function() { hide(successAlert); }, 4000);
  await fetchFileList();
}

// ── Keyboard shortcut ─────────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && !editView.classList.contains('hidden')) {
    e.preventDefault();
    if (!saveBtn.disabled) saveFile();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────
function hideAlerts() {
  hide(errorAlert);
  hide(successAlert);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
