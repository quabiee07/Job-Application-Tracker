/**
 * Job Application Tracker
 * Plain JavaScript (ES6+) with localStorage persistence.
 * Includes: color-coded avatars, animated counts, staggered card entrance,
 *           toast with icon + progress bar, keyboard shortcuts.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'job_tracker_applications_v1';
  const VALID_STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected'];

  // #2 — 8 deterministic avatar color classes
  const AVATAR_COLORS = [
    'avatar-blue', 'avatar-emerald', 'avatar-amber', 'avatar-rose',
    'avatar-violet', 'avatar-teal', 'avatar-orange', 'avatar-slate'
  ];

  const SAMPLE_APPLICATIONS = [
    { id: 'sample-1', company: 'Linear',  role: 'Staff Product Designer',          status: 'Interviewing', createdAt: Date.now() - 86400000 * 2 },
    { id: 'sample-2', company: 'Stripe',  role: 'Senior Software Engineer',        status: 'Applied',      createdAt: Date.now() - 86400000 * 5 },
    { id: 'sample-3', company: 'Vercel',  role: 'Frontend Infrastructure Lead',    status: 'Offer',        createdAt: Date.now() - 86400000 * 11 },
    { id: 'sample-4', company: 'GitHub',  role: 'Principal Developer Advocate',    status: 'Interviewing', createdAt: Date.now() - 86400000 * 16 },
    { id: 'sample-5', company: 'Airbnb',  role: 'Product Operations Manager',      status: 'Rejected',     createdAt: Date.now() - 86400000 * 22 },
    { id: 'sample-6', company: 'Notion',  role: 'Design Engineer',                 status: 'Applied',      createdAt: Date.now() - 86400000 * 28 }
  ];

  // State
  let applications = [];
  let searchQuery = '';
  let statusFilter = 'ALL';
  let pendingDeleteId = null;
  let previousCounts = { total: -1, applied: -1, interviewing: -1, offer: -1, rejected: -1 };

  // DOM refs
  const $ = id => document.getElementById(id);
  const totalCountEl        = $('total-count');
  const appliedCountEl      = $('applied-count');
  const interviewingCountEl = $('interviewing-count');
  const offerCountEl        = $('offer-count');
  const rejectedCountEl     = $('rejected-count');
  const statCardBtns        = document.querySelectorAll('.stat-card[data-filter]');

  const applicationsListEl  = $('applications-list');
  const emptyStateEl        = $('empty-state');
  const noResultsStateEl    = $('no-results-state');
  const noResultsMessageEl  = $('no-results-message');

  const searchInput         = $('search-input');
  const clearSearchBtn      = $('clear-search-btn');
  const searchShortcutEl    = $('search-shortcut');
  const statusFilterSelect  = $('status-filter');
  const filterFeedbackEl    = $('filter-feedback');
  const filterFeedbackTextEl = $('filter-feedback-text');
  const resetFiltersBtn     = $('reset-filters-btn');
  const clearSearchActionBtn = $('clear-search-action-btn');

  const openAddBtn   = $('open-add-btn');
  const emptyAddBtn  = $('empty-add-btn');
  const loadSamplesBtn = $('load-samples-btn');

  const appDialog       = $('application-dialog');
  const dialogTitleEl   = $('dialog-title');
  const dialogSubtitleEl = $('dialog-subtitle');
  const dialogCloseBtn  = $('dialog-close-btn');
  const dialogCancelBtn = $('dialog-cancel-btn');
  const appForm         = $('application-form');
  const appIdInput      = $('application-id');
  const companyInput    = $('company-input');
  const roleInput       = $('role-input');
  const statusInput     = $('status-input');
  const companyErrorEl  = $('company-error');
  const roleErrorEl     = $('role-error');
  const submitBtn       = $('dialog-submit-btn');

  const confirmDeleteDialog = $('confirm-delete-dialog');
  const deleteItemPreviewEl = $('delete-item-preview');
  const cancelDeleteBtn     = $('cancel-delete-btn');
  const confirmDeleteBtn    = $('confirm-delete-btn');

  const toastEl       = $('toast');
  const toastIconEl   = $('toast-icon');
  const toastMessageEl = $('toast-message');
  const toastProgressEl = $('toast-progress');
  let toastTimeout = null;

  /* ====================================================================== */
  /*  Helpers                                                                */
  /* ====================================================================== */

  function loadApplications() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed)
        ? parsed.filter(i => i && typeof i.company === 'string' && typeof i.role === 'string' && VALID_STATUSES.includes(i.status))
        : [];
    } catch { return []; }
  }

  function saveApplications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch {
      showToast('Could not save — storage full.', true);
    }
  }

  function generateId() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'app_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  function escapeHTML(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function formatRelativeTime(ts) {
    if (!ts) return '';
    const d = Math.max(0, Date.now() - ts);
    if (d < 60000)   return 'Just now';
    if (d < 3600000)  return Math.floor(d / 60000) + 'm ago';
    if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
    const days = Math.floor(d / 86400000);
    if (days === 1)  return 'Yesterday';
    if (days < 30)   return days + 'd ago';
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // #2 — deterministic color from company name
  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  // #5 — redesigned toast with icon + progress
  function showToast(message, isError = false) {
    if (toastTimeout) clearTimeout(toastTimeout);

    toastMessageEl.textContent = message;
    toastIconEl.classList.toggle('error', isError);
    toastIconEl.innerHTML = isError
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    // Restart progress bar animation
    toastProgressEl.style.animation = 'none';
    // Force reflow
    void toastProgressEl.offsetWidth;
    toastProgressEl.style.animation = '';

    toastEl.hidden = false;
    toastEl.style.animation = 'none';
    void toastEl.offsetWidth;
    toastEl.style.animation = '';

    toastTimeout = setTimeout(() => { toastEl.hidden = true; }, 2800);
  }

  /* ====================================================================== */
  /*  Stats with animated counts (#4)                                        */
  /* ====================================================================== */

  function animateCountIfChanged(el, newVal, key) {
    if (previousCounts[key] !== newVal) {
      el.textContent = newVal;
      el.classList.remove('bounce');
      void el.offsetWidth;           // force reflow to restart animation
      el.classList.add('bounce');
      previousCounts[key] = newVal;
    }
  }

  function updateStats() {
    let total = applications.length, applied = 0, interviewing = 0, offer = 0, rejected = 0;
    for (const a of applications) {
      if (a.status === 'Applied') applied++;
      else if (a.status === 'Interviewing') interviewing++;
      else if (a.status === 'Offer') offer++;
      else if (a.status === 'Rejected') rejected++;
    }

    animateCountIfChanged(totalCountEl, total, 'total');
    animateCountIfChanged(appliedCountEl, applied, 'applied');
    animateCountIfChanged(interviewingCountEl, interviewing, 'interviewing');
    animateCountIfChanged(offerCountEl, offer, 'offer');
    animateCountIfChanged(rejectedCountEl, rejected, 'rejected');

    statCardBtns.forEach(btn => {
      const active = btn.dataset.filter === statusFilter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  /* ====================================================================== */
  /*  Filtering & Rendering                                                  */
  /* ====================================================================== */

  function getFilteredApplications() {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter(a => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!q) return true;
      return a.company.toLowerCase().includes(q)
          || a.role.toLowerCase().includes(q)
          || a.status.toLowerCase().includes(q);
    });
  }

  function render() {
    updateStats();

    if (applications.length === 0) {
      applicationsListEl.innerHTML = '';
      emptyStateEl.hidden = false;
      noResultsStateEl.hidden = true;
      filterFeedbackEl.hidden = true;
      return;
    }

    emptyStateEl.hidden = true;
    const filtered = getFilteredApplications();
    const isFiltered = searchQuery.trim() !== '' || statusFilter !== 'ALL';

    if (isFiltered) {
      filterFeedbackEl.hidden = false;
      let t = `Showing ${filtered.length} of ${applications.length} applications`;
      if (searchQuery.trim()) t += ` matching "${searchQuery.trim()}"`;
      if (statusFilter !== 'ALL') t += ` in "${statusFilter}"`;
      filterFeedbackTextEl.textContent = t;
    } else {
      filterFeedbackEl.hidden = true;
    }

    if (filtered.length === 0) {
      applicationsListEl.innerHTML = '';
      noResultsStateEl.hidden = false;
      let m = 'No applications matched your search';
      if (searchQuery.trim()) m += ` for "${searchQuery.trim()}"`;
      if (statusFilter !== 'ALL') m += ` in status "${statusFilter}"`;
      m += '. Try adjusting your keywords or clearing filters.';
      noResultsMessageEl.textContent = m;
      return;
    }

    noResultsStateEl.hidden = true;
    const sorted = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // #8 — staggered animation delay per card
    const html = sorted.map((app, idx) => {
      const sc = escapeHTML(app.company);
      const sr = escapeHTML(app.role);
      const ss = escapeHTML(app.status);
      const cls = app.status.toLowerCase();
      const ini = sc.charAt(0).toUpperCase() || '?';
      const rt = formatRelativeTime(app.createdAt);
      const avatarCls = getAvatarColor(app.company);    // #2
      const delay = Math.min(idx * 40, 300);              // cap at 300ms

      return `
        <article class="application-card" data-id="${app.id}" data-status="${app.status}" role="listitem"
                 style="animation-delay:${delay}ms">
          <div class="app-main-info">
            <div class="company-avatar ${avatarCls}" aria-hidden="true">${ini}</div>
            <div class="app-details">
              <div class="app-company-row">
                <h3 class="app-company" title="${sc}">${sc}</h3>
              </div>
              <div class="app-meta-sub">
                <span class="app-role" title="${sr}">${sr}</span>
                ${rt ? `<span class="app-time-dot" aria-hidden="true">·</span><time class="app-time">${rt}</time>` : ''}
              </div>
            </div>
          </div>
          <div class="app-meta-actions">
            <span class="status-badge ${cls}">${ss}</span>
            <div class="app-buttons">
              <button type="button" class="action-btn action-btn-edit" data-action="edit" data-id="${app.id}"
                      aria-label="Edit ${sr} at ${sc}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>Edit</span>
              </button>
              <button type="button" class="action-btn action-btn-delete" data-action="delete" data-id="${app.id}"
                      aria-label="Delete ${sr} at ${sc}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </article>`;
    }).join('');

    applicationsListEl.innerHTML = html;
  }

  /* ====================================================================== */
  /*  Dialogs                                                                */
  /* ====================================================================== */

  function resetForm() {
    appForm.reset(); appIdInput.value = '';
    companyErrorEl.textContent = ''; roleErrorEl.textContent = '';
    companyInput.classList.remove('has-error'); roleInput.classList.remove('has-error');
  }

  function openAddModal() {
    resetForm();
    dialogTitleEl.textContent = 'Add Application';
    dialogSubtitleEl.textContent = 'Record details of your new job submission';
    submitBtn.textContent = 'Add Application';
    statusInput.value = 'Applied';
    appDialog.showModal();
    companyInput.focus();
  }

  function openEditModal(id) {
    const app = applications.find(i => i.id === id);
    if (!app) return;
    resetForm();
    dialogTitleEl.textContent = 'Edit Application';
    dialogSubtitleEl.textContent = `Update details for ${app.company}`;
    submitBtn.textContent = 'Save Changes';
    appIdInput.value = app.id;
    companyInput.value = app.company;
    roleInput.value = app.role;
    statusInput.value = app.status;
    appDialog.showModal();
    companyInput.focus();
  }

  function closeAppDialog() { appDialog.close(); resetForm(); }

  function openDeleteConfirmModal(id) {
    const app = applications.find(i => i.id === id);
    if (!app) return;
    pendingDeleteId = id;
    deleteItemPreviewEl.innerHTML = `
      <div class="delete-preview-company">${escapeHTML(app.company)}</div>
      <div class="delete-preview-role">${escapeHTML(app.role)} · <span class="status-badge ${app.status.toLowerCase()}">${escapeHTML(app.status)}</span></div>`;
    confirmDeleteDialog.showModal();
    cancelDeleteBtn.focus();
  }

  function closeDeleteConfirmModal() {
    confirmDeleteDialog.close();
    pendingDeleteId = null;
    deleteItemPreviewEl.innerHTML = '';
  }

  /* ====================================================================== */
  /*  Form                                                                   */
  /* ====================================================================== */

  function handleFormSubmit(e) {
    e.preventDefault();
    const cv = companyInput.value.trim();
    const rv = roleInput.value.trim();
    const sv = statusInput.value;
    const eid = appIdInput.value;
    let err = false;

    if (!cv) { companyErrorEl.textContent = 'Please enter a company name.'; companyInput.classList.add('has-error'); err = true; }
    else     { companyErrorEl.textContent = ''; companyInput.classList.remove('has-error'); }

    if (!rv) { roleErrorEl.textContent = 'Please enter a role or position.'; roleInput.classList.add('has-error'); err = true; }
    else     { roleErrorEl.textContent = ''; roleInput.classList.remove('has-error'); }

    if (!VALID_STATUSES.includes(sv)) err = true;
    if (err) { (!cv ? companyInput : roleInput).focus(); return; }

    if (eid) {
      const idx = applications.findIndex(i => i.id === eid);
      if (idx !== -1) {
        applications[idx] = { ...applications[idx], company: cv, role: rv, status: sv, updatedAt: Date.now() };
        saveApplications(); render(); closeAppDialog();
        showToast(`Updated "${cv}" application.`);
      }
    } else {
      applications.unshift({ id: generateId(), company: cv, role: rv, status: sv, createdAt: Date.now() });
      saveApplications(); render(); closeAppDialog();
      showToast(`Added "${cv}" to your pipeline.`);
    }
  }

  /* ====================================================================== */
  /*  Delete                                                                 */
  /* ====================================================================== */

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const target = applications.find(i => i.id === pendingDeleteId);
    const name = target ? target.company : 'Application';
    applications = applications.filter(i => i.id !== pendingDeleteId);
    saveApplications(); render(); closeDeleteConfirmModal();
    showToast(`Deleted "${name}".`);
  }

  /* ====================================================================== */
  /*  Event Listeners                                                        */
  /* ====================================================================== */

  openAddBtn.addEventListener('click', openAddModal);
  emptyAddBtn.addEventListener('click', openAddModal);

  loadSamplesBtn.addEventListener('click', () => {
    applications = [...SAMPLE_APPLICATIONS];
    saveApplications(); render();
    showToast('Loaded 6 sample applications.');
  });

  dialogCloseBtn.addEventListener('click', closeAppDialog);
  dialogCancelBtn.addEventListener('click', closeAppDialog);
  appForm.addEventListener('submit', handleFormSubmit);

  // Backdrop click closes dialogs
  function onBackdropClick(dialog, closeFn) {
    dialog.addEventListener('click', e => {
      const r = dialog.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) closeFn();
    });
  }
  onBackdropClick(appDialog, closeAppDialog);
  onBackdropClick(confirmDeleteDialog, closeDeleteConfirmModal);

  cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
  confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

  // Delegated card actions
  applicationsListEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit')   openEditModal(btn.dataset.id);
    if (btn.dataset.action === 'delete') openDeleteConfirmModal(btn.dataset.id);
  });

  // Stat card filter clicks
  statCardBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilter = btn.dataset.filter;
      statusFilterSelect.value = statusFilter;
      render();
    });
  });

  // Search
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value;
    const has = searchQuery.length > 0;
    clearSearchBtn.hidden = !has;
    if (searchShortcutEl) searchShortcutEl.style.display = has ? 'none' : 'flex';
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchQuery = ''; searchInput.value = '';
    clearSearchBtn.hidden = true;
    if (searchShortcutEl) searchShortcutEl.style.display = 'flex';
    searchInput.focus(); render();
  });

  statusFilterSelect.addEventListener('change', e => { statusFilter = e.target.value; render(); });

  function resetAllFilters() {
    searchQuery = ''; statusFilter = 'ALL';
    searchInput.value = ''; clearSearchBtn.hidden = true;
    if (searchShortcutEl) searchShortcutEl.style.display = 'flex';
    statusFilterSelect.value = 'ALL';
    render();
  }

  resetFiltersBtn.addEventListener('click', resetAllFilters);
  clearSearchActionBtn.addEventListener('click', resetAllFilters);

  // Live validation
  companyInput.addEventListener('input', () => { if (companyInput.value.trim()) { companyErrorEl.textContent = ''; companyInput.classList.remove('has-error'); } });
  roleInput.addEventListener('input',   () => { if (roleInput.value.trim())    { roleErrorEl.textContent = '';    roleInput.classList.remove('has-error'); } });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    const modal = appDialog.open || confirmDeleteDialog.open;
    const tag = (document.activeElement || {}).tagName || '';
    const typing = /^(INPUT|SELECT|TEXTAREA)$/i.test(tag);

    if (!modal && !typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault(); searchInput.focus(); searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
      e.preventDefault(); resetAllFilters(); searchInput.blur();
    }
  });

  /* ====================================================================== */
  /*  Init                                                                   */
  /* ====================================================================== */
  applications = loadApplications();
  render();

})();
