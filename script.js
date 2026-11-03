/**
 * Job Application Tracker
 * Plain JavaScript (ES6+) with localStorage persistence
 * Optimized for a mature, modern, and clean user experience.
 */

(function () {
  'use strict';

  // Constants & Storage Key
  const STORAGE_KEY = 'job_tracker_applications_v1';
  const VALID_STATUSES = ['Applied', 'Interviewing', 'Offer', 'Rejected'];

  // High-quality sample data to preview the interface if user clicks "Load Sample Data"
  const SAMPLE_APPLICATIONS = [
    {
      id: 'sample-1',
      company: 'Linear',
      role: 'Staff Product Designer',
      status: 'Interviewing',
      createdAt: Date.now() - 86400000 * 2
    },
    {
      id: 'sample-2',
      company: 'Stripe',
      role: 'Senior Software Engineer, Platform',
      status: 'Applied',
      createdAt: Date.now() - 86400000 * 5
    },
    {
      id: 'sample-3',
      company: 'Vercel',
      role: 'Frontend Infrastructure Lead',
      status: 'Offer',
      createdAt: Date.now() - 86400000 * 11
    },
    {
      id: 'sample-4',
      company: 'GitHub',
      role: 'Principal Developer Advocate',
      status: 'Interviewing',
      createdAt: Date.now() - 86400000 * 16
    },
    {
      id: 'sample-5',
      company: 'Airbnb',
      role: 'Product Operations Manager',
      status: 'Rejected',
      createdAt: Date.now() - 86400000 * 22
    }
  ];

  // State
  let applications = [];
  let searchQuery = '';
  let statusFilter = 'ALL';
  let pendingDeleteId = null;

  // DOM Elements
  const totalCountEl = document.getElementById('total-count');
  const appliedCountEl = document.getElementById('applied-count');
  const interviewingCountEl = document.getElementById('interviewing-count');
  const offerCountEl = document.getElementById('offer-count');
  const rejectedCountEl = document.getElementById('rejected-count');
  const statCardBtns = document.querySelectorAll('.stat-card[data-filter]');

  const applicationsListEl = document.getElementById('applications-list');
  const emptyStateEl = document.getElementById('empty-state');
  const noResultsStateEl = document.getElementById('no-results-state');
  const noResultsMessageEl = document.getElementById('no-results-message');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const searchShortcutEl = document.getElementById('search-shortcut');
  const statusFilterSelect = document.getElementById('status-filter');
  const filterFeedbackEl = document.getElementById('filter-feedback');
  const filterFeedbackTextEl = document.getElementById('filter-feedback-text');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const clearSearchActionBtn = document.getElementById('clear-search-action-btn');

  const openAddBtn = document.getElementById('open-add-btn');
  const emptyAddBtn = document.getElementById('empty-add-btn');
  const loadSamplesBtn = document.getElementById('load-samples-btn');

  // Application Dialog Elements
  const appDialog = document.getElementById('application-dialog');
  const dialogTitleEl = document.getElementById('dialog-title');
  const dialogSubtitleEl = document.getElementById('dialog-subtitle');
  const dialogCloseBtn = document.getElementById('dialog-close-btn');
  const dialogCancelBtn = document.getElementById('dialog-cancel-btn');
  const appForm = document.getElementById('application-form');
  const appIdInput = document.getElementById('application-id');
  const companyInput = document.getElementById('company-input');
  const roleInput = document.getElementById('role-input');
  const statusInput = document.getElementById('status-input');
  const companyErrorEl = document.getElementById('company-error');
  const roleErrorEl = document.getElementById('role-error');
  const submitBtn = document.getElementById('dialog-submit-btn');

  // Delete Confirmation Dialog Elements
  const confirmDeleteDialog = document.getElementById('confirm-delete-dialog');
  const deleteItemPreviewEl = document.getElementById('delete-item-preview');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  // Toast Element
  const toastEl = document.getElementById('toast');
  let toastTimeout = null;

  /* ==========================================================================
     Helper Functions
     ========================================================================== */

  /**
   * Safely load applications array from localStorage
   */
  function loadApplications() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => (
          item &&
          typeof item.company === 'string' &&
          typeof item.role === 'string' &&
          VALID_STATUSES.includes(item.status)
        ));
      }
      return [];
    } catch (err) {
      console.error('Error reading from localStorage:', err);
      return [];
    }
  }

  /**
   * Save current applications array to localStorage
   */
  function saveApplications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
      showToast('Could not save data to browser storage.', true);
    }
  }

  /**
   * Generate a unique ID
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'app_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Escape HTML entities to prevent XSS injection
   */
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format relative timestamp nicely for display
   */
  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const dayMs = 86400000;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    if (diff < dayMs) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    const days = Math.floor(diff / dayMs);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Show a temporary toast message
   */
  function showToast(message, isError = false) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.style.backgroundColor = isError ? 'var(--color-danger)' : '#0f172a';
    
    toastTimeout = setTimeout(() => {
      toastEl.hidden = true;
    }, 2800);
  }

  /* ==========================================================================
     Stats & Counts
     ========================================================================== */

  /**
   * Update all counters at the top of the page
   */
  function updateStats() {
    const total = applications.length;
    let applied = 0;
    let interviewing = 0;
    let offer = 0;
    let rejected = 0;

    for (const app of applications) {
      switch (app.status) {
        case 'Applied':
          applied++;
          break;
        case 'Interviewing':
          interviewing++;
          break;
        case 'Offer':
          offer++;
          break;
        case 'Rejected':
          rejected++;
          break;
      }
    }

    totalCountEl.textContent = total;
    appliedCountEl.textContent = applied;
    interviewingCountEl.textContent = interviewing;
    offerCountEl.textContent = offer;
    rejectedCountEl.textContent = rejected;

    // Synchronize active highlights on stat cards
    statCardBtns.forEach(btn => {
      const filter = btn.dataset.filter;
      const isActive = (filter === statusFilter);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /* ==========================================================================
     Filtering & Rendering
     ========================================================================== */

  /**
   * Filter applications by search string and status dropdown
   */
  function getFilteredApplications() {
    const query = searchQuery.trim().toLowerCase();

    return applications.filter(app => {
      const matchesStatus = (statusFilter === 'ALL') || (app.status === statusFilter);
      if (!matchesStatus) return false;

      if (!query) return true;

      const compMatch = app.company.toLowerCase().includes(query);
      const roleMatch = app.role.toLowerCase().includes(query);
      const statusMatch = app.status.toLowerCase().includes(query);

      return compMatch || roleMatch || statusMatch;
    });
  }

  /**
   * Render the application cards
   */
  function render() {
    updateStats();

    // If completely empty (no applications stored in system)
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

    // Show/hide feedback banner
    if (isFiltered) {
      filterFeedbackEl.hidden = false;
      let text = `Showing ${filtered.length} of ${applications.length} applications`;
      if (searchQuery.trim()) {
        text += ` matching "${searchQuery.trim()}"`;
      }
      if (statusFilter !== 'ALL') {
        text += ` in "${statusFilter}"`;
      }
      filterFeedbackTextEl.textContent = text;
    } else {
      filterFeedbackEl.hidden = true;
    }

    // If search/filter returns zero matches
    if (filtered.length === 0) {
      applicationsListEl.innerHTML = '';
      noResultsStateEl.hidden = false;
      let msg = 'No applications matched your search';
      if (searchQuery.trim()) msg += ` for "${searchQuery.trim()}"`;
      if (statusFilter !== 'ALL') msg += ` in status "${statusFilter}"`;
      msg += '. Try adjusting your keywords or clearing the active filter.';
      noResultsMessageEl.textContent = msg;
      return;
    }

    noResultsStateEl.hidden = true;

    // Render cards (newest first)
    const sorted = [...filtered].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const html = sorted.map(app => {
      const safeCompany = escapeHTML(app.company);
      const safeRole = escapeHTML(app.role);
      const safeStatus = escapeHTML(app.status);
      const statusClass = app.status.toLowerCase();
      const initial = safeCompany.charAt(0).toUpperCase() || '?';
      const relativeTime = formatRelativeTime(app.createdAt);

      return `
        <article class="application-card" data-id="${app.id}" role="listitem">
          <div class="app-main-info">
            <div class="company-avatar" aria-hidden="true">${initial}</div>
            <div class="app-details">
              <div class="app-company-row">
                <h3 class="app-company" title="${safeCompany}">${safeCompany}</h3>
              </div>
              <div class="app-meta-sub">
                <span class="app-role" title="${safeRole}">${safeRole}</span>
                ${relativeTime ? `<span class="app-time-dot" aria-hidden="true">•</span><time class="app-time">${relativeTime}</time>` : ''}
              </div>
            </div>
          </div>

          <div class="app-meta-actions">
            <span class="status-badge ${statusClass}">${safeStatus}</span>
            <div class="app-buttons">
              <button 
                type="button" 
                class="action-btn action-btn-edit" 
                data-action="edit" 
                data-id="${app.id}"
                aria-label="Edit application for ${safeRole} at ${safeCompany}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit</span>
              </button>

              <button 
                type="button" 
                class="action-btn action-btn-delete" 
                data-action="delete" 
                data-id="${app.id}"
                aria-label="Delete application for ${safeRole} at ${safeCompany}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    applicationsListEl.innerHTML = html;
  }

  /* ==========================================================================
     Modal / Dialog Handling
     ========================================================================== */

  /**
   * Reset form errors and field values
   */
  function resetForm() {
    appForm.reset();
    appIdInput.value = '';
    companyErrorEl.textContent = '';
    roleErrorEl.textContent = '';
    companyInput.classList.remove('has-error');
    roleInput.classList.remove('has-error');
  }

  /**
   * Open the modal for Adding a new application
   */
  function openAddModal() {
    resetForm();
    dialogTitleEl.textContent = 'Add Application';
    dialogSubtitleEl.textContent = 'Record details of your new job submission';
    submitBtn.textContent = 'Add Application';
    statusInput.value = 'Applied';
    appDialog.showModal();
    companyInput.focus();
  }

  /**
   * Open the modal for Editing an existing application
   */
  function openEditModal(id) {
    const app = applications.find(item => item.id === id);
    if (!app) return;

    resetForm();
    dialogTitleEl.textContent = 'Edit Application';
    dialogSubtitleEl.textContent = `Update application details for ${app.company}`;
    submitBtn.textContent = 'Save Changes';

    appIdInput.value = app.id;
    companyInput.value = app.company;
    roleInput.value = app.role;
    statusInput.value = app.status;

    appDialog.showModal();
    companyInput.focus();
  }

  /**
   * Close the application dialog
   */
  function closeAppDialog() {
    appDialog.close();
    resetForm();
  }

  /**
   * Open Delete Confirmation Modal
   */
  function openDeleteConfirmModal(id) {
    const app = applications.find(item => item.id === id);
    if (!app) return;

    pendingDeleteId = id;
    deleteItemPreviewEl.innerHTML = `
      <div class="delete-preview-company">${escapeHTML(app.company)}</div>
      <div class="delete-preview-role">${escapeHTML(app.role)} • <span class="status-badge ${app.status.toLowerCase()}">${escapeHTML(app.status)}</span></div>
    `;

    confirmDeleteDialog.showModal();
    cancelDeleteBtn.focus();
  }

  /**
   * Close Delete Confirmation Modal
   */
  function closeDeleteConfirmModal() {
    confirmDeleteDialog.close();
    pendingDeleteId = null;
    deleteItemPreviewEl.innerHTML = '';
  }

  /* ==========================================================================
     Form Validation & Submission
     ========================================================================== */

  function handleFormSubmit(e) {
    e.preventDefault();

    const companyVal = companyInput.value.trim();
    const roleVal = roleInput.value.trim();
    const statusVal = statusInput.value;
    const existingId = appIdInput.value;

    let hasError = false;

    // Validate Company
    if (!companyVal) {
      companyErrorEl.textContent = 'Please enter a company name.';
      companyInput.classList.add('has-error');
      hasError = true;
    } else {
      companyErrorEl.textContent = '';
      companyInput.classList.remove('has-error');
    }

    // Validate Role
    if (!roleVal) {
      roleErrorEl.textContent = 'Please enter a role or position title.';
      roleInput.classList.add('has-error');
      hasError = true;
    } else {
      roleErrorEl.textContent = '';
      roleInput.classList.remove('has-error');
    }

    // Validate Status
    if (!VALID_STATUSES.includes(statusVal)) {
      hasError = true;
    }

    if (hasError) {
      if (!companyVal) {
        companyInput.focus();
      } else if (!roleVal) {
        roleInput.focus();
      }
      return;
    }

    if (existingId) {
      // Edit existing application
      const index = applications.findIndex(item => item.id === existingId);
      if (index !== -1) {
        applications[index] = {
          ...applications[index],
          company: companyVal,
          role: roleVal,
          status: statusVal,
          updatedAt: Date.now()
        };
        saveApplications();
        render();
        closeAppDialog();
        showToast(`Updated application for "${companyVal}".`);
      }
    } else {
      // Add new application
      const newApp = {
        id: generateId(),
        company: companyVal,
        role: roleVal,
        status: statusVal,
        createdAt: Date.now()
      };
      applications.unshift(newApp);
      saveApplications();
      render();
      closeAppDialog();
      showToast(`Added application for "${companyVal}".`);
    }
  }

  /* ==========================================================================
     Delete Application
     ========================================================================== */

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;

    const targetApp = applications.find(item => item.id === pendingDeleteId);
    const companyName = targetApp ? targetApp.company : 'Application';

    applications = applications.filter(item => item.id !== pendingDeleteId);
    saveApplications();
    render();
    closeDeleteConfirmModal();
    showToast(`Deleted "${companyName}".`);
  }

  /* ==========================================================================
     Event Listeners & Interaction
     ========================================================================== */

  // Add Application button triggers
  openAddBtn.addEventListener('click', openAddModal);
  emptyAddBtn.addEventListener('click', openAddModal);

  // Load sample applications
  loadSamplesBtn.addEventListener('click', () => {
    applications = [...SAMPLE_APPLICATIONS];
    saveApplications();
    render();
    showToast('Loaded 5 sample job applications.');
  });

  // Dialog Close & Cancel buttons
  dialogCloseBtn.addEventListener('click', closeAppDialog);
  dialogCancelBtn.addEventListener('click', closeAppDialog);
  appForm.addEventListener('submit', handleFormSubmit);

  // Close dialog on backdrop click
  appDialog.addEventListener('click', (e) => {
    const rect = appDialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeAppDialog();
    }
  });

  // Delete modal triggers
  cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
  confirmDeleteBtn.addEventListener('click', handleConfirmDelete);

  confirmDeleteDialog.addEventListener('click', (e) => {
    const rect = confirmDeleteDialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      closeDeleteConfirmModal();
    }
  });

  // Delegated clicks for Edit / Delete on cards
  applicationsListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'edit') {
      openEditModal(id);
    } else if (action === 'delete') {
      openDeleteConfirmModal(id);
    }
  });

  // Stat Card click to filter
  statCardBtns.forEach(cardBtn => {
    cardBtn.addEventListener('click', () => {
      const targetFilter = cardBtn.dataset.filter;
      statusFilter = targetFilter;
      statusFilterSelect.value = targetFilter;
      render();
    });
  });

  // Real-time search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    const hasValue = searchQuery.length > 0;
    clearSearchBtn.hidden = !hasValue;
    if (searchShortcutEl) {
      searchShortcutEl.style.display = hasValue ? 'none' : 'flex';
    }
    render();
  });

  // Clear search button
  clearSearchBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    if (searchShortcutEl) {
      searchShortcutEl.style.display = 'flex';
    }
    searchInput.focus();
    render();
  });

  // Status Filter Select
  statusFilterSelect.addEventListener('change', (e) => {
    statusFilter = e.target.value;
    render();
  });

  // Reset Filters button
  function resetAllFilters() {
    searchQuery = '';
    statusFilter = 'ALL';
    searchInput.value = '';
    clearSearchBtn.hidden = true;
    if (searchShortcutEl) {
      searchShortcutEl.style.display = 'flex';
    }
    statusFilterSelect.value = 'ALL';
    render();
  }

  resetFiltersBtn.addEventListener('click', resetAllFilters);
  clearSearchActionBtn.addEventListener('click', resetAllFilters);

  // Live validation clean-up on input
  companyInput.addEventListener('input', () => {
    if (companyInput.value.trim()) {
      companyErrorEl.textContent = '';
      companyInput.classList.remove('has-error');
    }
  });

  roleInput.addEventListener('input', () => {
    if (roleInput.value.trim()) {
      roleErrorEl.textContent = '';
      roleInput.classList.remove('has-error');
    }
  });

  // Global Keyboard Shortcuts (Modern power-user UX)
  document.addEventListener('keydown', (e) => {
    const isModalOpen = appDialog.open || confirmDeleteDialog.open;
    const activeTagName = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isTyping = activeTagName === 'input' || activeTagName === 'select' || activeTagName === 'textarea';

    // Shortcut "/" or "Cmd+K" / "Ctrl+K" to focus search
    if (!isModalOpen && !isTyping && (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }

    // Escape clears search when focused
    if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
      e.preventDefault();
      resetAllFilters();
      searchInput.blur();
    }
  });

  /* ==========================================================================
     Initialization
     ========================================================================== */
  applications = loadApplications();
  render();

})();
