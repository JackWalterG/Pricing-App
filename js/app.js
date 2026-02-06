/* ============================================
   INDUSTRY ROLE PRESETS
   ============================================ */
const CREATIVE_INDUSTRY_ROLES = [
    { role: 'Producer', hourlyRate: 105, fullDayRate: 1050, hours: 10 },
    { role: 'Director', hourlyRate: 185, fullDayRate: 1850, hours: 10 },
    { role: 'Camera Operator', hourlyRate: 90, fullDayRate: 900, hours: 10 },
    { role: 'Gaffer', hourlyRate: 78, fullDayRate: 775, hours: 10 },
    { role: 'Sound Mixer (Labor Only)', hourlyRate: 90, fullDayRate: 900, hours: 10 },
    { role: 'Editor', hourlyRate: 93, fullDayRate: 925, hours: 10 },
    { role: 'Sr. Editor', hourlyRate: 150, fullDayRate: 1500, hours: 10 },
    { role: 'Colorist', hourlyRate: 175, fullDayRate: 1750, hours: 10 },
    { role: 'Sound Designer', hourlyRate: 115, fullDayRate: 1150, hours: 10 },
    { role: 'Retoucher', hourlyRate: 80, fullDayRate: 800, hours: 10 }
];

/* ============================================
   STATE
   ============================================ */
let state = {
    projectName: '',
    packages: [],
    globalMarkupPercent: 20,
    globalShowMargin: true,
    nextPackageId: 1,
    nextItemId: 1,
    nextNestedMemberId: 1,
    templates: {},
    clients: {},
    customRoles: [],
    industryRoleOverrides: {}
};

const STANDARD_TIERS = [
    { key: 'good', name: 'Good', inheritFromPrevious: false },
    { key: 'better', name: 'Better', inheritFromPrevious: true },
    { key: 'best', name: 'Best', inheritFromPrevious: true }
];

/* ============================================
   UNDO/REDO HISTORY
   ============================================ */
const history = {
    past: [],
    future: [],
    maxSize: 50
};

function saveToHistory() {
    // Deep clone current state
    const snapshot = JSON.parse(JSON.stringify(state));
    history.past.push(snapshot);
    
    // Limit history size
    if (history.past.length > history.maxSize) {
        history.past.shift();
    }
    
    // Clear future on new action
    history.future = [];
    
    updateUndoRedoButtons();
}

function undo() {
    if (history.past.length === 0) return;
    
    // Save current state to future
    const currentSnapshot = JSON.parse(JSON.stringify(state));
    history.future.push(currentSnapshot);
    
    // Restore previous state
    state = history.past.pop();
    
    // Sync UI with restored state
    syncUIWithState();
    updateUndoRedoButtons();
    showSaveStatus('Undone');
}

function redo() {
    if (history.future.length === 0) return;
    
    // Save current state to past
    const currentSnapshot = JSON.parse(JSON.stringify(state));
    history.past.push(currentSnapshot);
    
    // Restore future state
    state = history.future.pop();
    
    // Sync UI with restored state
    syncUIWithState();
    updateUndoRedoButtons();
    showSaveStatus('Redone');
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) undoBtn.disabled = history.past.length === 0;
    if (redoBtn) redoBtn.disabled = history.future.length === 0;
}

function syncUIWithState() {
    document.getElementById('projectName').value = state.projectName;
    document.getElementById('globalMarkup').value = state.globalMarkupPercent;
    render();
    updateAllCalculations();
}

/* ============================================
   AUTO-SAVE
   ============================================ */
const STORAGE_KEY = 'pricingCalculatorState';
const STORAGE_VERSION = '3.0.0'; // Updated for custom markup, role presets, and package element features
const VERSION_KEY = 'pricingCalculatorVersion';

function saveToLocalStorage() {
    try {
        localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        showSaveStatus('Saved');
    } catch (e) {
        console.warn('Could not save to localStorage:', e);
        showSaveStatus('Save failed');
    }
}

function loadFromLocalStorage() {
    try {
        // Check version - if mismatch, start fresh
        const savedVersion = localStorage.getItem(VERSION_KEY);
        if (savedVersion !== STORAGE_VERSION) {
            console.warn('Storage version mismatch, starting fresh');
            return false;
        }
        
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.packages)) {
                state = parsed;
                
                // Ensure all required fields
                if (state.projectName === undefined) state.projectName = '';
                if (state.globalMarkupPercent === undefined) state.globalMarkupPercent = 20;
                if (state.globalShowMargin === undefined) state.globalShowMargin = true;
                if (state.nextPackageId === undefined) state.nextPackageId = 1;
                if (state.nextItemId === undefined) state.nextItemId = 1;
                if (state.nextNestedMemberId === undefined) state.nextNestedMemberId = 1;
                if (state.templates === undefined) state.templates = {};
                if (state.clients === undefined) state.clients = {};
                if (state.customRoles === undefined) state.customRoles = [];
                if (state.industryRoleOverrides === undefined) state.industryRoleOverrides = {};
                
                // Ensure all packages have new fields
                state.packages.forEach((pkg, index) => {
                    normalizePackage(pkg, index);
                    if (pkg.items) {
                        pkg.items.forEach(item => {
                            if (item.notes === undefined) item.notes = '';
                            // Migrate teamMembers to packageElements
                            if (item.type === 'hourly-product' && item.teamMembers && !item.packageElements) {
                                item.packageElements = item.teamMembers;
                                delete item.teamMembers;
                            }
                        });
                    }
                });
                
                // Recalculate max IDs and migrate old data
                state.packages.forEach(pkg => {
                    if (pkg.id >= state.nextPackageId) state.nextPackageId = pkg.id + 1;
                    if (pkg.items) {
                        pkg.items.forEach(item => {
                            if (item.id >= state.nextItemId) state.nextItemId = item.id + 1;
                            if (item.type === 'hourly-product' && !item.packageElements) item.packageElements = [];
                            if (item.packageElements) {
                                item.packageElements.forEach(member => {
                                    if (member.id >= state.nextNestedMemberId) state.nextNestedMemberId = member.id + 1;
                                    // Migrate old hourlyRate to new cost/sell structure
                                    if (member.hourlyRate !== undefined && member.costRate === undefined) {
                                        member.costRate = member.hourlyRate;
                                        member.sellRate = member.hourlyRate;
                                        delete member.hourlyRate;
                                    }
                                    if (member.hours === undefined) member.hours = 0;
                                    if (member.useCustomMarkup === undefined) member.useCustomMarkup = false;
                                    if (member.customMarkupPercent === undefined) member.customMarkupPercent = 0;
                                });
                            }
                        });
                    }
                });
                
                return true;
            }
        }
    } catch (e) {
        console.warn('Could not load from localStorage:', e);
    }
    return false;
}

// Debounced save function
let saveTimeout;
function debouncedSave() {
    showSaveStatus('Saving...');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToLocalStorage();
    }, 1000);
}

function showSaveStatus(text) {
    const statusEl = document.getElementById('saveStatus');
    const textEl = statusEl?.querySelector('.save-text');
    
    if (textEl) {
        textEl.textContent = text;
    }
    
    if (statusEl) {
        statusEl.classList.toggle('saving', text === 'Saving...');
    }
}

/* ============================================
   GENERIC CONFIRM MODAL
   ============================================ */
let actionConfirmCallback = null;

function showActionConfirm({ title, message, confirmText, cancelText, onConfirm }) {
    const modal = document.getElementById('actionConfirmModal');
    const titleEl = document.getElementById('action-confirm-title');
    const messageEl = document.getElementById('action-confirm-message');
    const confirmBtn = document.getElementById('actionConfirmAccept');
    const cancelBtn = document.getElementById('actionConfirmCancel');

    if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) return;

    titleEl.textContent = title || 'Confirm Action';
    messageEl.textContent = message || 'This action cannot be undone. Continue?';
    confirmBtn.textContent = confirmText || 'Continue';
    cancelBtn.textContent = cancelText || 'Cancel';
    cancelBtn.style.display = cancelText ? '' : 'none';

    actionConfirmCallback = typeof onConfirm === 'function' ? onConfirm : null;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    confirmBtn.focus();
}

function hideActionConfirm() {
    const modal = document.getElementById('actionConfirmModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    const cancelBtn = document.getElementById('actionConfirmCancel');
    if (cancelBtn) cancelBtn.style.display = '';
    actionConfirmCallback = null;
}

/* ============================================
   UTILITIES
   ============================================ */
function findPackage(packageId) {
    return state.packages.find(p => p.id === packageId);
}

function findItem(packageId, itemId) {
    const pkg = findPackage(packageId);
    return pkg?.items.find(i => i.id === itemId);
}

function formatCurrency(value) {
    return `$${parseFloat(value).toFixed(2)}`;
}

function getActivePackages() {
    return state.packages.filter(pkg => pkg.isActive !== false);
}

function getInactivePackages() {
    return state.packages.filter(pkg => pkg.isActive === false);
}

function getStandardTierConfig(tierKey) {
    return STANDARD_TIERS.find(tier => tier.key === tierKey);
}

function getTierKeyFromName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (normalized === 'good') return 'good';
    if (normalized === 'better') return 'better';
    if (normalized === 'best') return 'best';
    return 'custom';
}

function normalizePackage(pkg, index) {
    if (!pkg) return;
    if (pkg.name === undefined) pkg.name = 'Untitled';
    if (pkg.tierKey === undefined) pkg.tierKey = getTierKeyFromName(pkg.name);
    if (pkg.inheritFromPrevious === undefined) pkg.inheritFromPrevious = index > 0;
    if (pkg.isActive === undefined) pkg.isActive = true;
    if (!Array.isArray(pkg.items)) pkg.items = [];
    if (pkg.costBasis === undefined) pkg.costBasis = 0;
}

function insertPackageByTier(pkg) {
    const tierIndex = STANDARD_TIERS.findIndex(tier => tier.key === pkg.tierKey);
    if (tierIndex === -1) {
        state.packages.push(pkg);
        return;
    }
    let insertAt = state.packages.length;
    for (let i = 0; i < state.packages.length; i++) {
        const existingTierIndex = STANDARD_TIERS.findIndex(tier => tier.key === state.packages[i].tierKey);
        if (existingTierIndex > tierIndex) {
            insertAt = i;
            break;
        }
    }
    state.packages.splice(insertAt, 0, pkg);
}

function getInheritedPackagesForIndex(index, packages = getActivePackages()) {
    const pkg = packages[index];
    if (!pkg || !pkg.inheritFromPrevious || index <= 0) return [];
    return packages.slice(0, index);
}

function getInheritedItemNamesForIndex(index, packages = getActivePackages()) {
    const inheritedPackages = getInheritedPackagesForIndex(index, packages);
    const names = [];
    inheritedPackages.forEach(pkg => {
        pkg.items.forEach(item => {
            names.push(item.name || 'Untitled');
        });
    });
    return names;
}

function getInheritedPackageNamesForIndex(index, packages = getActivePackages()) {
    const inheritedPackages = getInheritedPackagesForIndex(index, packages);
    return inheritedPackages.map(pkg => pkg.name || 'Untitled');
}

/* ============================================
   NOTES MANAGEMENT
   ============================================ */
let currentNotesContext = { packageId: null, itemId: null };

function showNotesModal(packageId, itemId) {
    const item = findItem(packageId, itemId);
    if (!item) return;
    
    currentNotesContext = { packageId, itemId };
    
    const modal = document.getElementById('notesModal');
    const nameEl = document.getElementById('notesDeliverableName');
    const textarea = document.getElementById('notesTextarea');
    
    nameEl.textContent = item.name || 'Untitled Deliverable';
    textarea.value = item.notes || '';
    
    modal.hidden = false;
    textarea.focus();
    document.body.style.overflow = 'hidden';
}

function hideNotesModal() {
    const modal = document.getElementById('notesModal');
    modal.hidden = true;
    document.body.style.overflow = '';
    currentNotesContext = { packageId: null, itemId: null };
}

function saveNotes() {
    const { packageId, itemId } = currentNotesContext;
    if (packageId === null || itemId === null) return;
    
    const item = findItem(packageId, itemId);
    if (!item) return;
    
    const textarea = document.getElementById('notesTextarea');
    const newNotes = textarea.value.trim();
    
    if (item.notes !== newNotes) {
        saveToHistory();
        item.notes = newNotes;
        
        // Update notes button text
        const btn = document.querySelector(`[data-item-id="${itemId}"].btn-notes`);
        if (btn) {
            btn.textContent = newNotes ? 'Details ✓' : 'Details';
        }
        
        // Update the notes indicator in the header
        const hourlyContainer = document.querySelector(`[data-hourly-id="${itemId}"]`);
        const flatContainer = document.querySelector(`[data-flat-id="${itemId}"]`);
        const container = hourlyContainer || flatContainer;
        
        if (container) {
            const summaryEl = container.querySelector('.hourly-product-summary, .collapsible-summary');
            if (summaryEl) {
                // Remove existing indicator if present
                const existingIndicator = summaryEl.querySelector('.notes-indicator');
                if (existingIndicator) {
                    existingIndicator.remove();
                }
                
                // Add indicator if notes exist
                if (newNotes) {
                    const indicator = document.createElement('span');
                    indicator.className = 'notes-indicator';
                    indicator.title = 'Has details';
                    indicator.textContent = '📝';
                    summaryEl.appendChild(indicator);
                }
            }
        }
        
        debouncedSave();
    }
    
    hideNotesModal();
}

/* ============================================
   ROLE PRESETS MANAGEMENT
   ============================================ */
function showPresetsModal() {
    const modal = document.getElementById('presetsModal');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    renderPresetsList();
}

function hidePresetsModal() {
    const modal = document.getElementById('presetsModal');
    modal.hidden = true;
    document.body.style.overflow = '';
    hidePresetEditor();
}

function renderPresetsList() {
    // Render industry standard roles (now editable)
    const industryList = document.getElementById('industryRolesList');
    if (industryList) {
        industryList.innerHTML = '';
        CREATIVE_INDUSTRY_ROLES.forEach((role, index) => {
            // Check if this role has been overridden
            const override = state.industryRoleOverrides && state.industryRoleOverrides[role.role];
            const displayRole = override || role;
            const isModified = override !== undefined;
            
            const item = document.createElement('div');
            item.className = `preset-item preset-editable ${isModified ? 'preset-modified' : ''}`;
            item.innerHTML = `
                <div class="preset-info">
                    <strong>${displayRole.role}${isModified ? ' <span class="modified-badge">Modified</span>' : ''}</strong>
                    <span>Cost: $${displayRole.costRate || displayRole.hourlyRate}/hr · Sell: $${displayRole.sellRate || displayRole.hourlyRate}/hr (${displayRole.hours} hrs)</span>
                </div>
                <div class="preset-actions">
                    <button class="btn-edit-preset btn-edit-industry-preset" data-role="${role.role}" title="Edit this preset">Edit</button>
                    ${isModified ? `<button class="btn-reset-preset btn-reset-industry-preset" data-role="${role.role}" title="Reset to default">Reset</button>` : ''}
                </div>
            `;
            industryList.appendChild(item);
        });
    }
    
    // Render custom roles (editable)
    const customList = document.getElementById('customRolesList');
    if (customList) {
        customList.innerHTML = '';
        if (!state.customRoles || state.customRoles.length === 0) {
            customList.innerHTML = '<p class="empty-state-small">No custom roles yet. Click "Add New" to create one.</p>';
        } else {
            state.customRoles.forEach((role, index) => {
                const item = document.createElement('div');
                item.className = 'preset-item preset-editable';
                item.innerHTML = `
                    <div class="preset-info">
                        <strong>${role.role}</strong>
                        <span>$${role.hourlyRate}/hr${role.fullDayRate ? ` · $${role.fullDayRate}/day` : ''}</span>
                    </div>
                    <div class="preset-actions">
                        <button class="btn-edit-preset" data-index="${index}" title="Edit this preset">Edit</button>
                        <button class="btn-delete-preset" data-index="${index}" title="Delete this preset">Delete</button>
                    </div>
                `;
                customList.appendChild(item);
            });
        }
    }
}

function addCustomRole() {
    showPresetEditor({ mode: 'custom-new' });
}

function editCustomRole(index) {
    if (!state.customRoles || !state.customRoles[index]) return;
    showPresetEditor({ mode: 'custom-edit', index });
}

function deleteCustomRole(index) {
    if (!state.customRoles || !state.customRoles[index]) return;
    const role = state.customRoles[index];
    showActionConfirm({
        title: 'Delete role preset?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Delete preset',
        onConfirm: () => {
            saveToHistory();
            state.customRoles.splice(index, 1);
            debouncedSave();
            renderPresetsList();
            showSaveStatus('Custom role deleted');
        }
    });
}

function editIndustryRole(roleName) {
    showPresetEditor({ mode: 'industry-edit', roleName });
}

function resetIndustryRole(roleName) {
    if (!state.industryRoleOverrides || !state.industryRoleOverrides[roleName]) return;

    showActionConfirm({
        title: 'Reset industry role?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Reset role',
        onConfirm: () => {
            saveToHistory();
            delete state.industryRoleOverrides[roleName];
            debouncedSave();
            renderPresetsList();
            showSaveStatus('Industry role reset to default');
        }
    });
}

/* ============================================
   PRESET EDITOR (INLINE)
   ============================================ */
let presetEditorState = {
    mode: null,
    index: null,
    roleName: null
};

function showPresetEditor({ mode, index = null, roleName = null }) {
    const editor = document.getElementById('presetEditor');
    const title = document.getElementById('presetEditorTitle');
    const error = document.getElementById('presetEditorError');
    const roleInput = document.getElementById('presetRoleName');
    const hourlyInput = document.getElementById('presetHourlyRate');
    const fullDayInput = document.getElementById('presetFullDayRate');
    const costInput = document.getElementById('presetCostRate');
    const sellInput = document.getElementById('presetSellRate');
    const hoursInput = document.getElementById('presetHours');
    const customFields = document.querySelector('.preset-fields-custom');
    const industryFields = document.querySelector('.preset-fields-industry');

    if (!editor || !title || !roleInput || !hourlyInput || !fullDayInput || !costInput || !sellInput || !hoursInput) return;

    presetEditorState = { mode, index, roleName };

    if (error) {
        error.hidden = true;
        error.textContent = '';
    }

    if (mode === 'custom-new') {
        title.textContent = 'Add Role Preset';
        roleInput.value = '';
        hourlyInput.value = '';
        fullDayInput.value = '';
        hoursInput.value = '10';
        roleInput.disabled = false;
        if (customFields) customFields.hidden = false;
        if (industryFields) industryFields.hidden = true;
    }

    if (mode === 'custom-edit') {
        const role = state.customRoles[index];
        title.textContent = 'Edit Role Preset';
        roleInput.value = role?.role || '';
        hourlyInput.value = role?.hourlyRate ?? '';
        fullDayInput.value = role?.fullDayRate ?? '';
        hoursInput.value = role?.hours ?? '10';
        roleInput.disabled = false;
        if (customFields) customFields.hidden = false;
        if (industryFields) industryFields.hidden = true;
    }

    if (mode === 'industry-edit') {
        const originalRole = CREATIVE_INDUSTRY_ROLES.find(r => r.role === roleName);
        const currentRole = (state.industryRoleOverrides && state.industryRoleOverrides[roleName]) || originalRole;
        title.textContent = 'Edit Industry Role';
        roleInput.value = currentRole?.role || roleName || '';
        costInput.value = currentRole?.costRate ?? currentRole?.hourlyRate ?? '';
        sellInput.value = currentRole?.sellRate ?? currentRole?.hourlyRate ?? '';
        hoursInput.value = currentRole?.hours ?? '10';
        roleInput.disabled = true;
        if (customFields) customFields.hidden = true;
        if (industryFields) industryFields.hidden = false;
    }

    editor.hidden = false;
    roleInput.focus();
}

function hidePresetEditor() {
    const editor = document.getElementById('presetEditor');
    const error = document.getElementById('presetEditorError');
    if (editor) editor.hidden = true;
    if (error) {
        error.hidden = true;
        error.textContent = '';
    }
    presetEditorState = { mode: null, index: null, roleName: null };
}

function showPresetEditorError(message) {
    const error = document.getElementById('presetEditorError');
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
}

function savePresetEditor() {
    const roleInput = document.getElementById('presetRoleName');
    const hourlyInput = document.getElementById('presetHourlyRate');
    const fullDayInput = document.getElementById('presetFullDayRate');
    const costInput = document.getElementById('presetCostRate');
    const sellInput = document.getElementById('presetSellRate');
    const hoursInput = document.getElementById('presetHours');

    if (!roleInput || !hourlyInput || !fullDayInput || !costInput || !sellInput || !hoursInput) return;

    const roleName = roleInput.value.trim();
    const hours = parseFloat(hoursInput.value);
    const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 10;

    if (presetEditorState.mode === 'custom-new' || presetEditorState.mode === 'custom-edit') {
        const hourlyRate = parseFloat(hourlyInput.value);
        const fullDayRate = parseFloat(fullDayInput.value);

        if (!roleName) {
            showPresetEditorError('Role name is required.');
            return;
        }
        if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
            showPresetEditorError('Hourly rate must be a positive number.');
            return;
        }

        const computedFullDay = Number.isFinite(fullDayRate) && fullDayRate > 0
            ? fullDayRate
            : hourlyRate * safeHours;

        saveToHistory();
        if (!state.customRoles) state.customRoles = [];

        const payload = {
            role: roleName,
            hourlyRate: hourlyRate,
            fullDayRate: computedFullDay,
            hours: safeHours
        };

        if (presetEditorState.mode === 'custom-new') {
            state.customRoles.push(payload);
            showSaveStatus('Custom role added');
        } else if (presetEditorState.mode === 'custom-edit') {
            state.customRoles[presetEditorState.index] = payload;
            showSaveStatus('Custom role updated');
        }

        debouncedSave();
        renderPresetsList();
        hidePresetEditor();
        return;
    }

    if (presetEditorState.mode === 'industry-edit') {
        const costRate = parseFloat(costInput.value);
        const sellRate = parseFloat(sellInput.value);

        if (!Number.isFinite(costRate) || costRate < 0) {
            showPresetEditorError('Cost rate must be 0 or greater.');
            return;
        }
        if (!Number.isFinite(sellRate) || sellRate < 0) {
            showPresetEditorError('Sell rate must be 0 or greater.');
            return;
        }

        const originalRole = presetEditorState.roleName;
        if (!originalRole) return;

        saveToHistory();
        if (!state.industryRoleOverrides) state.industryRoleOverrides = {};

        state.industryRoleOverrides[originalRole] = {
            role: originalRole,
            costRate: costRate,
            sellRate: sellRate,
            hourlyRate: sellRate,
            fullDayRate: sellRate * safeHours,
            hours: safeHours
        };

        debouncedSave();
        renderPresetsList();
        showSaveStatus('Industry role customized');
        hidePresetEditor();
    }
}

/* ============================================
   TEMPLATES MANAGEMENT
   ============================================ */
function saveAsTemplate(templateName) {
    if (!templateName.trim()) {
        alert('Please enter a template name');
        return;
    }
    
    saveToHistory();
    
    // Save current pricing structure (packages and markup)
    const templateData = {
        packages: JSON.parse(JSON.stringify(state.packages)),
        globalMarkupPercent: state.globalMarkupPercent,
        savedAt: new Date().toISOString()
    };
    
    state.templates[templateName] = templateData;
    debouncedSave();
    showSaveStatus('Template saved');
    updateTemplateDropdown();
}

function loadTemplate(templateName) {
    if (!state.templates[templateName]) {
        alert('Template not found');
        return;
    }

    showActionConfirm({
        title: 'Load template?',
        message: 'This will replace your current estimate. Continue?',
        confirmText: 'Load template',
        onConfirm: () => {
            saveToHistory();
            
            const template = state.templates[templateName];
            state.packages = JSON.parse(JSON.stringify(template.packages));
            state.globalMarkupPercent = template.globalMarkupPercent;

            state.packages.forEach((pkg, index) => normalizePackage(pkg, index));
            
            // Reset next IDs and recalculate
            state.nextItemId = 1;
            state.nextNestedMemberId = 1;
            state.packages.forEach(pkg => {
                if (pkg.id >= state.nextPackageId) state.nextPackageId = pkg.id + 1;
                if (pkg.items) {
                    pkg.items.forEach(item => {
                        if (item.id >= state.nextItemId) state.nextItemId = item.id + 1;
                        if (item.teamMembers) {
                            item.teamMembers.forEach(member => {
                                if (member.id >= state.nextNestedMemberId) state.nextNestedMemberId = member.id + 1;
                            });
                        }
                    });
                }
            });
            
            document.getElementById('globalMarkup').value = state.globalMarkupPercent;
            render();
            updateAllCalculations();
            debouncedSave();
            showSaveStatus('Template loaded');
        }
    });
}

function deleteTemplate(templateName) {
    showActionConfirm({
        title: 'Delete template?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Delete template',
        onConfirm: () => {
            delete state.templates[templateName];
            debouncedSave();
            updateTemplateDropdown();
            showSaveStatus('Template deleted');
        }
    });
}

function updateTemplateDropdown() {
    const dropdown = document.getElementById('templateSelect');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Select template...</option>';
    Object.keys(state.templates).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        dropdown.appendChild(option);
    });
}

/* ============================================
   CLIENT HISTORY MANAGEMENT
   ============================================ */
function saveToClientHistory(clientName) {
    if (!clientName.trim()) {
        alert('Please enter a client name');
        return;
    }
    
    if (!state.clients[clientName]) {
        state.clients[clientName] = [];
    }
    
    const clientEntry = {
        projectName: state.projectName,
        packages: JSON.parse(JSON.stringify(state.packages)),
        globalMarkupPercent: state.globalMarkupPercent,
        savedAt: new Date().toISOString()
    };
    
    state.clients[clientName].push(clientEntry);
    debouncedSave();
    showSaveStatus(`Saved to ${clientName}`);
    updateClientDropdown();
}

function loadClientHistory(clientName, index) {
    if (!state.clients[clientName] || !state.clients[clientName][index]) {
        alert('Client history not found');
        return;
    }
    
    showActionConfirm({
        title: 'Load project?',
        message: 'This will replace your current estimate. Continue?',
        confirmText: 'Load project',
        onConfirm: () => {
            saveToHistory();
            
            const entry = state.clients[clientName][index];
            state.projectName = entry.projectName;
            state.packages = JSON.parse(JSON.stringify(entry.packages));
            state.globalMarkupPercent = entry.globalMarkupPercent;

            state.packages.forEach((pkg, index) => normalizePackage(pkg, index));
            
            document.getElementById('projectName').value = state.projectName;
            document.getElementById('globalMarkup').value = state.globalMarkupPercent;
            render();
            updateAllCalculations();
            debouncedSave();
            showSaveStatus('Client history loaded');
        }
    });
}

function updateClientDropdown() {
    const dropdown = document.getElementById('clientSelect');
    if (!dropdown) return;
    
    dropdown.innerHTML = '<option value="">Select client...</option>';
    const clientNames = Object.keys(state.clients);
    clientNames.forEach(clientName => {
        const option = document.createElement('option');
        option.value = clientName;
        option.textContent = clientName;
        dropdown.appendChild(option);
    });
}

function showClientProjects(clientName) {
    const projectSelect = document.getElementById('projectSelect');
    const projectRow = document.getElementById('projectRow');
    
    if (!projectSelect || !projectRow) return;
    
    projectRow.style.display = 'flex';
    projectSelect.innerHTML = '<option value="">Select project...</option>';
    
    if (state.clients[clientName]) {
        state.clients[clientName].forEach((entry, idx) => {
            const date = new Date(entry.savedAt).toLocaleDateString();
            const projectName = entry.projectName || 'Untitled';
            const option = document.createElement('option');
            option.value = `${clientName}|${idx}`;
            option.textContent = `${projectName} (${date})`;
            projectSelect.appendChild(option);
        });
    }
}

function deleteClientHistory(clientName) {
    showActionConfirm({
        title: 'Delete client history?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Delete history',
        onConfirm: () => {
            delete state.clients[clientName];
            debouncedSave();
            updateClientDropdown();
            showSaveStatus('Client history deleted');
        }
    });
}



/* ============================================
   CALCULATIONS
   ============================================ */
function calculateBaseAmount(item) {
    if (item.type === 'package-element') {
        // For package elements, use costRate for base calculation
        return item.costRate ? item.costRate * item.hours : 0;
    } else if (item.type === 'hourly-product') {
        return calculateHourlyProductBaseAmount(item);
    } else if (item.type === 'flat-product') {
        return item.price ? item.price : 0;
    }
    return 0;
}

function calculateHourlyProductBaseAmount(item) {
    if (!item.packageElements || item.packageElements.length === 0) return 0;
    return item.packageElements.reduce((sum, member) => {
        return sum + (member.costRate ? member.costRate * member.hours : 0);
    }, 0);
}

function calculateMarkupAmount(item) {
    if (item.type === 'flat-product') {
        // Flat products use global markup
        const base = calculateBaseAmount(item);
        return base * (state.globalMarkupPercent / 100);
    }
    
    if (item.type === 'package-element') {
        // For package elements, check if custom markup is enabled
        if (item.useCustomMarkup && item.customMarkupPercent !== undefined) {
            const base = calculateBaseAmount(item);
            return base * (item.customMarkupPercent / 100);
        } else {
            // Use global markup
            const base = calculateBaseAmount(item);
            return base * (state.globalMarkupPercent / 100);
        }
    }
    
    // For hourly products, sum up the markup from all package elements
    if (item.type === 'hourly-product') {
        if (!item.packageElements || item.packageElements.length === 0) return 0;
        return item.packageElements.reduce((sum, member) => {
            const costTotal = (member.costRate || 0) * (member.hours || 0);
            if (member.useCustomMarkup && member.customMarkupPercent !== undefined) {
                // Use custom markup percentage
                return sum + (costTotal * (member.customMarkupPercent / 100));
            } else {
                // Use global markup percentage
                return sum + (costTotal * (state.globalMarkupPercent / 100));
            }
        }, 0);
    }
    
    return 0;
}

function calculatePackageTotals(packageId) {
    const pkg = findPackage(packageId);
    if (!pkg) return { base: 0, markup: 0, final: 0, profit: 0, margin: 0 };
    
    let baseTotal = 0;
    let markupTotal = 0;
    
    pkg.items.forEach(item => {
        const itemBase = calculateBaseAmount(item);
        const itemMarkup = calculateMarkupAmount(item);
        baseTotal += itemBase;
        markupTotal += itemMarkup;
    });
    
    const finalTotal = baseTotal + markupTotal;
    const costBasis = pkg.costBasis || 0;
    const profit = finalTotal - costBasis - baseTotal;
    const margin = finalTotal > 0 ? (profit / finalTotal) * 100 : 0;
    
    return {
        base: baseTotal,
        markup: markupTotal,
        final: finalTotal,
        profit: profit,
        margin: margin
    };
}

/* ============================================
   STATE UPDATES
   ============================================ */
function updateProjectName(value) {
    saveToHistory();
    state.projectName = value;
    debouncedSave();
}

function updateGlobalMarkup() {
    saveToHistory();
    const input = document.getElementById('globalMarkup');
    state.globalMarkupPercent = parseFloat(input.value) || 0;
    updateAllCalculations();
    debouncedSave();
}

function updatePackageName(packageId, value, commit = false) {
    const pkg = findPackage(packageId);
    if (!pkg) return;

    const newName = value && value.trim() ? value.trim() : 'Untitled';
    if (commit && pkg.name !== newName) {
        saveToHistory();
    }

    pkg.name = newName;

    const packageEl = document.querySelector(`.package[data-package-id="${packageId}"]`);
    if (packageEl) {
        packageEl.setAttribute('aria-label', `${newName} pricing tier`);
        const titleInput = packageEl.querySelector('.package-title-input');
        if (titleInput && titleInput !== document.activeElement) {
            titleInput.value = newName;
        }
        const label = packageEl.querySelector(`#add-items-label-${packageId}`);
        if (label) label.textContent = `Add Items to ${newName}`;
        const itemsContainer = packageEl.querySelector(`#items-${packageId}`);
        if (itemsContainer) itemsContainer.setAttribute('aria-label', `Deliverables in ${newName}`);
    }

    updateInheritedItemsDisplay();
    updateAllCalculations();

    if (commit) {
        debouncedSave();
    }
}

function updatePackageActionsVisibility() {
    const blankCanvas = document.getElementById('blankCanvas');
    const activePackages = getActivePackages();
    const hasActivePackages = activePackages.length > 0;

    if (blankCanvas) blankCanvas.hidden = hasActivePackages;
}

function togglePackageActive(packageId) {
    const pkg = findPackage(packageId);
    if (!pkg) return;

    const activePackages = getActivePackages();
    if (pkg.isActive !== false && activePackages.length <= 1) {
        showActionConfirm({
            title: 'Cannot minimize last tier',
            message: 'At least one active tier is required.',
            confirmText: 'OK',
            cancelText: '',
            onConfirm: () => {}
        });
        return;
    }

    saveToHistory();
    pkg.isActive = !pkg.isActive;
    render();
    updateAllCalculations();
    debouncedSave();
}

function deletePackagePermanently(packageId) {
    const pkg = findPackage(packageId);
    if (!pkg) return;

    showActionConfirm({
        title: 'Delete tier?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Delete tier',
        onConfirm: () => {
            saveToHistory();
            state.packages = state.packages.filter(p => p.id !== packageId);
            render();
            updateAllCalculations();
            debouncedSave();
        }
    });
}

function resetPackageTier(packageId) {
    const pkg = findPackage(packageId);
    if (!pkg) return;

    showActionConfirm({
        title: 'Reset tier?',
        message: 'This action cannot be undone. Continue?',
        confirmText: 'Reset tier',
        onConfirm: () => {
            saveToHistory();
            pkg.items = [];
            pkg.costBasis = 0;
            pkg.inheritFromPrevious = false;
            pkg.isActive = true;
            render();
            updateAllCalculations();
            debouncedSave();
        }
    });
}

function addNextTierFromPackage(packageId, nextTierKey) {
    const nextTier = getStandardTierConfig(nextTierKey);
    if (!nextTier) return;

    const existing = state.packages.find(pkg => pkg.tierKey === nextTierKey);
    if (existing) {
        if (existing.isActive === false) {
            saveToHistory();
            existing.isActive = true;
            render();
            updateAllCalculations();
            debouncedSave();
        }
        return;
    }

    addStandardTier(nextTierKey);
}

function openLibraryPanelForLoad() {
    const libraryPanel = document.getElementById('libraryPanel');
    if (libraryPanel) {
        libraryPanel.removeAttribute('hidden');
    }

    const dropdownMenu = document.getElementById('dropdownMenu');
    if (dropdownMenu) {
        dropdownMenu.setAttribute('hidden', '');
    }

    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
        clientSelect.focus();
    }
}

/* ============================================
   INHERITANCE HELPERS
   ============================================ */
function updateInheritedItemsDisplay() {
    const activePackages = getActivePackages();
    activePackages.forEach((pkg, index) => {
        const packageEl = document.querySelector(`.package[data-package-id="${pkg.id}"]`);
        if (!packageEl) return;

        const inheritedEl = packageEl.querySelector('.inherited-items');
        const inheritedItems = getInheritedItemNamesForIndex(index, activePackages);

            if (pkg.isActive !== false && pkg.inheritFromPrevious && inheritedItems.length > 0) {
            if (inheritedEl) {
                inheritedEl.innerHTML = `<strong>Inherited:</strong> ${inheritedItems.join(', ')}`;
            } else {
                const header = packageEl.querySelector('.package-header');
                const newInheritedEl = document.createElement('div');
                newInheritedEl.className = 'inherited-items';
                newInheritedEl.innerHTML = `<strong>Inherited:</strong> ${inheritedItems.join(', ')}`;
                header.insertAdjacentElement('afterend', newInheritedEl);
            }
        } else if (inheritedEl) {
            inheritedEl.remove();
        }
    });
}

function closeAllTierMenus() {
    document.querySelectorAll('.tier-menu').forEach(menu => {
        menu.hidden = true;
    });
}

function toggleTierMenu(packageId) {
    const menu = document.querySelector(`.tier-menu[data-package-id="${packageId}"]`);
    if (!menu) return;

    const isHidden = menu.hidden;
    closeAllTierMenus();
    menu.hidden = !isHidden;
}

function updateEmptyStates() {
    const activePackages = getActivePackages();
    activePackages.forEach(pkg => {
        const packageEl = document.querySelector(`.package[data-package-id="${pkg.id}"]`);
        if (packageEl) {
            const itemsSection = packageEl.querySelector('.items-section');
            let emptyState = itemsSection.querySelector('.empty-state');
            
            if (pkg.items.length === 0) {
                if (!emptyState) {
                    emptyState = document.createElement('div');
                    emptyState.className = 'empty-state';
                    emptyState.textContent = 'No deliverables yet. Add a flat-rate or hourly item above.';
                    const itemsContainer = itemsSection.querySelector(`#items-${pkg.id}`);
                    itemsContainer.parentNode.insertBefore(emptyState, itemsContainer);
                }
            } else if (emptyState) {
                emptyState.remove();
            }
        }
    });
}

function renderInactivePackagesList() {
    const container = document.getElementById('inactivePackages');
    const list = document.getElementById('inactivePackagesList');
    if (!container || !list) return;

    const inactivePackages = getInactivePackages();
    container.hidden = inactivePackages.length === 0;
    list.innerHTML = '';

    inactivePackages.forEach(pkg => {
        const pill = document.createElement('div');
        pill.className = 'inactive-package-pill';
        pill.innerHTML = `
            <span>${pkg.name || 'Untitled'}</span>
            <button class="btn-restore-package" data-package-id="${pkg.id}" aria-label="Restore ${pkg.name}">Restore</button>
        `;
        list.appendChild(pill);
    });
}

/* ============================================
   PACKAGE CRUD
   ============================================ */
function addStandardTier(tierKey) {
    const config = getStandardTierConfig(tierKey);
    if (!config) return;

    if (state.packages.some(pkg => pkg.tierKey === tierKey)) {
        return;
    }

    saveToHistory();
    const newPackage = {
        id: state.nextPackageId++,
        name: config.name,
        tierKey: config.key,
        inheritFromPrevious: config.inheritFromPrevious,
        isActive: true,
        items: [],
        costBasis: 0
    };

    insertPackageByTier(newPackage);
    render();
    updateAllCalculations();
    debouncedSave();
    showSaveStatus(`${config.name} package added`);
}

function addPackage() {
    const name = prompt('Enter package name (e.g., Premium, Deluxe):');
    if (name && name.trim()) {
        saveToHistory();
        state.packages.push({
            id: state.nextPackageId++,
            name: name.trim(),
            tierKey: 'custom',
            inheritFromPrevious: state.packages.length > 0,
            isActive: true,
            items: [],
            costBasis: 0
        });
        render();
        updateAllCalculations();
        debouncedSave();
    }
}

function removePackage(packageId) {
    if (state.packages.length === 1) {
        alert('Must keep at least one package');
        return;
    }
    saveToHistory();
    state.packages = state.packages.filter(p => p.id !== packageId);
    render();
    debouncedSave();
}

/* ============================================
   ITEM CRUD
   ============================================ */
function addItem(packageId, type) {
    const pkg = findPackage(packageId);
    if (pkg) {
        saveToHistory();
        const newItem = {
            id: state.nextItemId++,
            type: type,
            name: '',
            hourlyRate: 0,
            hours: 0,
            price: 0,
            notes: ''
        };
        if (type === 'hourly-product') {
            newItem.packageElements = [];
        }
        pkg.items.push(newItem);
        renderItemsForPackage(packageId);
        updateEmptyStates();
        updateInheritedItemsDisplay();
        updateAllCalculations();
        debouncedSave();
    }
}

function updateItem(packageId, itemId, field, value) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item) {
            // Only save to history on first change (debounced)
            if (item[field] !== value) {
                saveToHistory();
            }
            item[field] = value;
            
            // Update header display for hourly products
            if (item.type === 'hourly-product' && field === 'name') {
                const summary = document.querySelector(`[data-hourly-id="${itemId}"] .hourly-product-summary`);
                if (summary) summary.textContent = value || 'Untitled Deliverable';
                    updateInheritedItemsDisplay();
            }

            // Update header display for flat products
            if (item.type === 'flat-product' && field === 'name') {
                const summary = document.querySelector(`[data-flat-id="${itemId}"] .collapsible-summary`);
                if (summary) summary.textContent = value || 'Untitled Product';
                    updateInheritedItemsDisplay();
            }

            // Update flat product totals display
            if (item.type === 'flat-product' && field === 'price') {
                const summaryEl = document.getElementById(`flat-summary-${itemId}`);
                if (summaryEl) {
                    const base = item.price ? item.price : 0;
                    const markup = calculateMarkupAmount(item);
                    const final = base + markup;
                    summaryEl.textContent = `Base: $${base.toFixed(2)}, Total: $${final.toFixed(2)}`;
                }
            }

            updateAllCalculations();
            debouncedSave();
        }
    }
}

function removeItem(packageId, itemId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        saveToHistory();
        pkg.items = pkg.items.filter(i => i.id !== itemId);
        renderItemsForPackage(packageId);
        updateEmptyStates();
        updateInheritedItemsDisplay();
        updateAllCalculations();
        debouncedSave();
    }
}

function renderItemsForPackage(packageId) {
    const pkg = findPackage(packageId);
    const container = document.getElementById(`items-${packageId}`);
    if (container) {
        container.innerHTML = '';
        pkg.items.forEach(item => {
            container.appendChild(createItemElement(packageId, item));
        });
    }
}

/* ============================================
   PACKAGE ELEMENT CRUD (formerly nested team members)
   ============================================ */
function addNestedTeamMember(packageId, itemId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item) {
            saveToHistory();
            if (!item.packageElements) item.packageElements = [];
            item.packageElements.push({
                id: state.nextNestedMemberId++,
                name: '',
                costRate: 0,
                sellRate: 0,
                hours: 0,
                useCustomMarkup: false,
                customMarkupPercent: 0
            });
            renderNestedMembersForItem(packageId, itemId);
            updateAllCalculations();
            debouncedSave();
        }
    }
}

function duplicateNestedTeamMember(packageId, itemId, memberId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item && item.packageElements) {
            const member = item.packageElements.find(m => m.id === memberId);
            if (member) {
                saveToHistory();
                const duplicate = {
                    ...member,
                    id: state.nextNestedMemberId++,
                    name: member.name ? `${member.name} (Copy)` : ''
                };
                item.packageElements.push(duplicate);
                renderNestedMembersForItem(packageId, itemId);
                updateAllCalculations();
                debouncedSave();
            }
        }
    }
}

function updateNestedTeamMember(packageId, itemId, memberId, field, value) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item && item.packageElements) {
            const member = item.packageElements.find(m => m.id === memberId);
            if (member) {
                if (member[field] !== value) {
                    saveToHistory();
                }
                
                // Handle linked field updates for cost/sell/markup
                if (field === 'sellRate') {
                    member.sellRate = value;
                    // Calculate new markup percentage from sell and cost
                    if (member.costRate > 0) {
                        member.customMarkupPercent = ((value - member.costRate) / member.costRate) * 100;
                    }
                    // Update the markup field in DOM without re-rendering
                    updateNestedMemberFieldInDOM(packageId, itemId, memberId, 'customMarkupPercent', member.customMarkupPercent);
                } else if (field === 'customMarkupPercent') {
                    member.customMarkupPercent = value;
                    // Calculate new sell rate from cost and markup
                    if (member.costRate >= 0) {
                        const markupMultiplier = 1 + (value / 100);
                        member.sellRate = member.costRate * markupMultiplier;
                    }
                    // Update the sell rate field in DOM without re-rendering
                    updateNestedMemberFieldInDOM(packageId, itemId, memberId, 'sellRate', member.sellRate);
                } else if (field === 'costRate') {
                    member.costRate = value;
                    // If custom markup is in use, recalculate sell rate
                    if (member.useCustomMarkup && member.customMarkupPercent !== undefined) {
                        const markupMultiplier = 1 + (member.customMarkupPercent / 100);
                        member.sellRate = value * markupMultiplier;
                    } else {
                        // Otherwise keep sell rate in sync with cost
                        member.sellRate = value;
                        // Recalculate markup % based on new values
                        if (value > 0) {
                            member.customMarkupPercent = ((member.sellRate - value) / value) * 100;
                        }
                    }
                    // Update dependent fields in DOM without re-rendering
                    updateNestedMemberFieldInDOM(packageId, itemId, memberId, 'sellRate', member.sellRate);
                    updateNestedMemberFieldInDOM(packageId, itemId, memberId, 'customMarkupPercent', member.customMarkupPercent);
                } else if (field === 'useCustomMarkup') {
                    member.useCustomMarkup = value;
                    if (!value) {
                        // Reset to global markup - sync sell with cost
                        member.sellRate = member.costRate;
                        member.customMarkupPercent = 0;
                    } else {
                        // Enable custom markup - calculate percentage from current values
                        if (member.costRate > 0) {
                            const totalCost = member.costRate * (member.hours || 1);
                            const totalSell = member.sellRate * (member.hours || 1);
                            const markup = totalSell - totalCost;
                            member.customMarkupPercent = totalCost > 0 ? (markup / totalCost) * 100 : state.globalMarkupPercent;
                        } else {
                            member.customMarkupPercent = state.globalMarkupPercent;
                        }
                    }
                } else {
                    member[field] = value;
                }

                updateAllCalculations();
                debouncedSave();
            }
        }
    }
}

function updateNestedMemberFieldInDOM(packageId, itemId, memberId, fieldName, value) {
    // Find the specific input field in the DOM and update it without re-rendering
    const input = document.querySelector(`[data-member-id="${memberId}"][data-field="${fieldName}"]`);
    if (input && input !== document.activeElement) {
        // Only update if it's not the currently focused field
        input.value = typeof value === 'number' ? value.toFixed(2) : value;
    }
}

function removeNestedTeamMember(packageId, itemId, memberId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item && item.packageElements) {
            saveToHistory();
            item.packageElements = item.packageElements.filter(m => m.id !== memberId);
            renderNestedMembersForItem(packageId, itemId);
            updateAllCalculations();
            debouncedSave();
        }
    }
}

function renderNestedMembersForItem(packageId, itemId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        const container = document.getElementById(`nested-members-${itemId}`);
        if (container) {
            // Save focus state before re-rendering
            const activeElement = document.activeElement;
            let focusInfo = null;
            
            if (activeElement && container.contains(activeElement)) {
                const memberId = activeElement.closest('.nested-team-member')?.dataset.memberId;
                const fieldName = activeElement.dataset.field;
                const selectionStart = activeElement.selectionStart;
                const selectionEnd = activeElement.selectionEnd;
                
                focusInfo = {
                    memberId,
                    fieldName,
                    selectionStart,
                    selectionEnd
                };
            }
            
            container.innerHTML = '';
            if (item && item.packageElements && item.packageElements.length > 0) {
                item.packageElements.forEach(member => {
                    container.appendChild(createNestedTeamMemberElement(packageId, itemId, member));
                });
            }
            
            // Restore focus if we had it
            if (focusInfo && focusInfo.memberId && focusInfo.fieldName) {
                const memberElement = container.querySelector(`[data-member-id="${focusInfo.memberId}"]`);
                if (memberElement) {
                    const inputToFocus = memberElement.querySelector(`[data-field="${focusInfo.fieldName}"]`);
                    if (inputToFocus) {
                        inputToFocus.focus();
                        if (typeof focusInfo.selectionStart === 'number') {
                            inputToFocus.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                        }
                    }
                }
            }
        }
    }
}

/* ============================================
   ELEMENT CREATORS
   ============================================ */
function createPackageElement(pkg, index) {
    const div = document.createElement('div');
    const tierClass = pkg.tierKey || 'custom';
    div.className = `package tier-${tierClass}${pkg.isActive === false ? ' package-inactive' : ''}`;
    div.setAttribute('role', 'listitem');
    div.setAttribute('aria-label', `${pkg.name} pricing tier`);
    div.setAttribute('data-package-id', pkg.id);

    const inheritanceToggleHtml = index > 0
        ? `
            <label class="tier-menu-item tier-menu-checkbox">
                <input type="checkbox" class="inherit-toggle-input" data-package-id="${pkg.id}" ${pkg.inheritFromPrevious ? 'checked' : ''}>
                <span>Include previous tiers</span>
            </label>
        `
        : '';

    const nextTierConfig = (() => {
        const currentIndex = STANDARD_TIERS.findIndex(tier => tier.key === pkg.tierKey);
        if (currentIndex === -1 || currentIndex >= STANDARD_TIERS.length - 1) return null;
        return STANDARD_TIERS[currentIndex + 1];
    })();

    const nextTierLabel = nextTierConfig ? `Add ${nextTierConfig.name}` : '';
    const nextTierAlreadyActive = nextTierConfig
        ? state.packages.some(existingPkg => existingPkg.tierKey === nextTierConfig.key && existingPkg.isActive !== false)
        : false;
    const nextTierButtonHtml = nextTierConfig
        ? `
            <button class="btn btn-primary package-action-btn package-add-tier-floating btn-add-next-tier" data-package-id="${pkg.id}" data-next-tier="${nextTierConfig.key}" aria-label="${nextTierLabel}" ${nextTierAlreadyActive ? 'disabled' : ''}>+ Tier</button>
        `
        : '';


    const emptyStateHtml = pkg.items.length === 0 
        ? `<div class="empty-state" role="status">No deliverables yet. Add a flat-rate or hourly item above.</div>` 
        : '';

    div.innerHTML = `
        <header class="package-header">
            <div class="package-header-left">
                <div class="package-title">
                    <input type="text" class="package-title-input" data-package-id="${pkg.id}" value="${pkg.name}" aria-label="Package name">
                </div>
            </div>
            <div class="package-actions-right">
                ${nextTierButtonHtml}
                <div class="package-menu">
                    <button class="btn btn-icon package-action-icon btn-tier-menu" data-package-id="${pkg.id}" aria-label="Open tier menu" title="Tier settings">☰</button>
                    <div class="tier-menu" data-package-id="${pkg.id}" hidden>
                        ${inheritanceToggleHtml}
                        <button class="tier-menu-item btn-reset-tier" data-package-id="${pkg.id}">Reset tier</button>
                        <button class="tier-menu-item btn-minimize-package" data-package-id="${pkg.id}">Minimize tier</button>
                        <button class="tier-menu-item btn-delete-package" data-package-id="${pkg.id}">Delete tier</button>
                    </div>
                </div>
            </div>
        </header>

        <div class="items-section">
            <span class="section-label" id="add-items-label-${pkg.id}">Add Items to ${pkg.name}</span>
            <div class="add-item-buttons" role="group" aria-labelledby="add-items-label-${pkg.id}">
                <button class="btn btn-add-flat-product" data-package-id="${pkg.id}" aria-label="Add flat rate deliverable to ${pkg.name}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    Flat Rate
                </button>
                <button class="btn btn-add-hourly-product" data-package-id="${pkg.id}" aria-label="Add hour-based deliverable to ${pkg.name}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Hour-Based
                </button>
            </div>
            ${emptyStateHtml}
            <div id="items-${pkg.id}" role="list" aria-label="Deliverables in ${pkg.name}">
                <!-- Items rendered here -->
            </div>
        </div>

        <div class="package-cost-basis" style="display: ${state.globalShowMargin ? 'block' : 'none'}">
            <label for="cost-basis-${pkg.id}">Hard Costs</label>
            <div class="input-with-prefix">
                <span class="input-prefix">$</span>
                <input type="number" id="cost-basis-${pkg.id}" class="cost-basis-input" data-package-id="${pkg.id}" min="0" step="0.01" value="${pkg.costBasis || 0}" placeholder="0.00" aria-label="Hard costs for ${pkg.name}">
            </div>
        </div>

        <div class="package-totals" aria-live="polite" aria-atomic="true">
            <div class="totals-row">
                <span class="totals-label">Base Total</span>
                <span class="totals-value" id="base-total-${pkg.id}">$0.00</span>
            </div>
            <div id="custom-markup-breakdown-${pkg.id}"></div>
            <div class="totals-row">
                <span class="totals-label">Markup (${state.globalMarkupPercent}%)</span>
                <span class="totals-value" id="markup-total-${pkg.id}">$0.00</span>
            </div>
            <div class="totals-row final">
                <span class="totals-label">Final Total</span>
                <span class="totals-value" id="final-total-${pkg.id}">$0.00</span>
            </div>
            <div class="totals-row margin-row" id="margin-row-${pkg.id}" style="display: ${state.globalShowMargin ? 'flex' : 'none'}">
                <span class="totals-label">Margin</span>
                <span class="totals-value" id="margin-total-${pkg.id}">--%</span>
            </div>
        </div>
    `;

    const itemsContainer = div.querySelector(`#items-${pkg.id}`);
    if (itemsContainer) {
        pkg.items.forEach(item => {
            itemsContainer.appendChild(createItemElement(pkg.id, item));
        });
    }

    return div;
}

function createItemElement(packageId, item) {
    if (item.type === 'hourly-product') {
        return createHourlyProductElement(packageId, item);
    }
    if (item.type === 'flat-product') {
        return createFlatProductElement(packageId, item);
    }
}

function createHourlyProductElement(packageId, item) {
    const div = document.createElement('div');
    div.className = 'hourly-product-container draggable-item';
    div.setAttribute('data-hourly-id', item.id);
    div.setAttribute('role', 'listitem');
    div.setAttribute('draggable', 'true');

    const base = calculateHourlyProductBaseAmount(item);
    const markup = calculateMarkupAmount(item);
    const final = base + markup;
    const itemName = item.name || 'Untitled Hourly Based Deliverable';
    const contentId = `hourly-content-${item.id}`;
    const hasNotes = item.notes && item.notes.trim().length > 0;

    div.innerHTML = `
        <button class="hourly-product-header" aria-expanded="false" aria-controls="${contentId}">
            <div class="hourly-product-header-main">
                <span class="hourly-product-toggle" aria-hidden="true">▶</span>
                <span class="hourly-product-summary">${itemName}${hasNotes ? '<span class="notes-indicator" title="Has details">📝</span>' : ''}</span>
            </div>
            <span class="hourly-product-totals">
                <span id="hourly-summary-${item.id}">Base: $${base.toFixed(2)} · Markup: $${markup.toFixed(2)} · Total: $${final.toFixed(2)}</span>
            </span>
        </button>

        <div id="${contentId}" class="hourly-product-content" role="region" aria-label="${itemName} details">
            <div class="field-group full" style="margin-bottom: var(--space-16);">
                <div class="form-group">
                    <label for="hourly-name-${item.id}">Deliverable Name</label>
                    <input type="text" id="hourly-name-${item.id}" placeholder="e.g., Website Redesign" value="${item.name}" class="item-input" data-package-id="${packageId}" data-item-id="${item.id}" data-field="name">
                </div>
            </div>

            <div style="margin-bottom: var(--space-16);">
                <span class="section-label" id="elements-label-${item.id}">Package Elements</span>
                <div id="nested-members-${item.id}" role="list" aria-labelledby="elements-label-${item.id}">
                    <!-- Nested package elements rendered here -->
                </div>
                <button class="btn-add-nested-member" data-package-id="${packageId}" data-item-id="${item.id}" aria-label="Add package element to ${itemName}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                    Add Package Element
                </button>
            </div>

            <div style="display: flex; gap: var(--space-8); margin-bottom: var(--space-12);">
                <button class="btn-notes" data-package-id="${packageId}" data-item-id="${item.id}" aria-label="Edit notes for ${itemName}">
                    Details${item.notes ? ' ✓' : ''}
                </button>
            </div>

            <button class="btn-remove-item" data-package-id="${packageId}" data-item-id="${item.id}" aria-label="Remove ${itemName}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove Deliverable
            </button>
        </div>
    `;

    const nestedContainer = div.querySelector(`#nested-members-${item.id}`);
    if (nestedContainer && item.packageElements && item.packageElements.length > 0) {
        item.packageElements.forEach(member => {
            nestedContainer.appendChild(createNestedTeamMemberElement(packageId, item.id, member));
        });
    }

    return div;
}

function createFlatProductElement(packageId, item) {
    const div = document.createElement('div');
    div.className = 'collapsible-container draggable-item';
    div.setAttribute('data-flat-id', item.id);
    div.setAttribute('role', 'listitem');
    div.setAttribute('draggable', 'true');

    const base = item.price ? item.price : 0;
    const markup = calculateMarkupAmount(item);
    const final = base + markup;
    const itemName = item.name || 'Untitled Flat Rate Deliverable';
    const contentId = `flat-content-${item.id}`;
    const hasNotes = item.notes && item.notes.trim().length > 0;

    div.innerHTML = `
        <button class="collapsible-header" aria-expanded="false" aria-controls="${contentId}">
            <div class="collapsible-header-main">
                <span class="collapsible-toggle" aria-hidden="true">▶</span>
                <span class="collapsible-summary">${itemName}${hasNotes ? '<span class="notes-indicator" title="Has details">📝</span>' : ''}</span>
            </div>
            <span class="collapsible-totals">
                <span id="flat-summary-${item.id}">Base: $${base.toFixed(2)} · Total: $${final.toFixed(2)}</span>
            </span>
        </button>

        <div id="${contentId}" class="collapsible-content" role="region" aria-label="${itemName} details">
            <div class="field-group full" style="margin-bottom: var(--space-16);">
                <div class="form-group">
                    <label for="flat-name-${item.id}">Product Name</label>
                    <input type="text" id="flat-name-${item.id}" placeholder="e.g., Design Assets" value="${item.name}" class="item-input" data-package-id="${packageId}" data-item-id="${item.id}" data-field="name">
                </div>
            </div>

            <div class="field-group full" style="margin-bottom: var(--space-16);">
                <div class="form-group">
                    <label for="flat-price-${item.id}">Sale Price</label>
                    <div class="input-with-suffix">
                        <input type="number" id="flat-price-${item.id}" placeholder="500" min="0" step="1" value="${item.price}" class="item-input" data-package-id="${packageId}" data-item-id="${item.id}" data-field="price" style="padding-left: 24px;">
                        <span class="input-suffix" style="left: 12px; right: auto;">$</span>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: var(--space-8); margin-bottom: var(--space-12);">
                <button class="btn-notes" data-package-id="${packageId}" data-item-id="${item.id}" aria-label="Edit notes for ${itemName}">
                    Details${item.notes ? ' ✓' : ''}
                </button>
            </div>

            <button class="btn-remove-item" data-package-id="${packageId}" data-item-id="${item.id}" aria-label="Remove ${itemName}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove Deliverable
            </button>
        </div>
    `;

    return div;
}

function createNestedTeamMemberElement(packageId, itemId, member) {
    const div = document.createElement('div');
    div.className = 'nested-team-member';
    div.setAttribute('role', 'listitem');

    // Calculate values
    const costRate = member.costRate || 0;
    const sellRate = member.sellRate || costRate;
    const hours = member.hours || 0;
    const base = costRate * hours;
    
    // Calculate markup based on whether custom markup is used
    let markup, markupPercent;
    if (member.useCustomMarkup) {
        markupPercent = member.customMarkupPercent || 0;
        markup = base * (markupPercent / 100);
    } else {
        markup = (sellRate * hours) - base;
        markupPercent = base > 0 ? ((sellRate - costRate) / costRate * 100) : 0;
    }
    
    const total = base + markup;
    const memberName = member.name || 'Unnamed element';
    
    // Get combined role list (industry presets + custom roles)
    const allRoles = [...CREATIVE_INDUSTRY_ROLES, ...(state.customRoles || [])];
    
    // Build role dropdown options
    let roleOptions = '<option value="">Select role preset...</option>';
    roleOptions += '<optgroup label="Industry Standard Roles">';
    CREATIVE_INDUSTRY_ROLES.forEach(role => {
        roleOptions += `<option value="${role.role}">${role.role} - $${role.hourlyRate}/hr ($${role.fullDayRate}/day)</option>`;
    });
    roleOptions += '</optgroup>';
    
    if (state.customRoles && state.customRoles.length > 0) {
        roleOptions += '<optgroup label="Custom Roles">';
        state.customRoles.forEach(role => {
            roleOptions += `<option value="${role.role}">${role.role} - $${role.hourlyRate}/hr${role.fullDayRate ? ` ($${role.fullDayRate}/day)` : ''}</option>`;
        });
        roleOptions += '</optgroup>';
    }
    
    // Custom markup indicator badge
    const customMarkupBadge = member.useCustomMarkup 
        ? `<span class="custom-markup-badge" title="Custom markup: ${markupPercent.toFixed(1)}% (overriding global ${state.globalMarkupPercent}%)">Custom ${markupPercent.toFixed(1)}%</span>`
        : '';

    div.innerHTML = `
        <div class="nested-team-member-header">
            <div class="role-preset-selector">
                <label for="role-preset-${member.id}">Role Preset</label>
                <select id="role-preset-${member.id}" class="role-preset-select" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}">
                    ${roleOptions}
                </select>
            </div>
            ${customMarkupBadge}
        </div>
        
        <div class="nested-team-member-fields">
            <div class="form-group">
                <label for="member-name-${member.id}">Name</label>
                <input type="text" id="member-name-${member.id}" placeholder="e.g., Developer" value="${member.name}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="name">
            </div>
            <div class="form-group">
                <label for="member-hours-${member.id}">Hours</label>
                <input type="number" id="member-hours-${member.id}" placeholder="10" min="0" step="0.25" value="${member.hours}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="hours">
            </div>
        </div>
        
        <div class="cost-sell-markup-fields">
            <div class="form-group">
                <label for="member-cost-${member.id}">Cost /hr</label>
                <div class="input-with-suffix">
                    <input type="number" id="member-cost-${member.id}" placeholder="100" min="0" step="1" value="${costRate}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="costRate" style="padding-left: 24px;">
                    <span class="input-suffix" style="left: 12px; right: auto;">$</span>
                </div>
            </div>
            <div class="form-group">
                <label for="member-sell-${member.id}">Sell /hr</label>
                <div class="input-with-suffix">
                    <input type="number" id="member-sell-${member.id}" placeholder="120" min="0" step="1" value="${sellRate}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="sellRate" style="padding-left: 24px;" ${!member.useCustomMarkup ? 'readonly' : ''}>
                    <span class="input-suffix" style="left: 12px; right: auto;">$</span>
                </div>
            </div>
            <div class="form-group">
                <label for="member-markup-${member.id}">Markup %</label>
                <div class="input-with-suffix">
                    <input type="number" id="member-markup-${member.id}" placeholder="${state.globalMarkupPercent}" min="0" step="0.1" value="${markupPercent.toFixed(1)}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="customMarkupPercent" style="padding-right: 24px;" ${!member.useCustomMarkup ? 'readonly' : ''}>
                    <span class="input-suffix" style="right: 12px;">%</span>
                </div>
            </div>
        </div>
        
        <div class="custom-markup-controls">
            <label class="checkbox-label">
                <input type="checkbox" class="custom-markup-checkbox" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" ${member.useCustomMarkup ? 'checked' : ''}>
                <span>Use custom markup (overrides global)</span>
            </label>
            ${member.useCustomMarkup ? `<button class="btn-reset-markup" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" title="Reset to global markup">Reset to Global</button>` : ''}
        </div>

        <div class="nested-member-footer">
            <div class="nested-member-summary" aria-live="polite">
                Base: $${base.toFixed(2)} | Markup: $${markup.toFixed(2)} | Total: $${total.toFixed(2)}
            </div>
            <div class="nested-member-actions">
                <button class="btn-duplicate-nested-member" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" aria-label="Duplicate ${memberName}" title="Duplicate this package element">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Duplicate
                </button>
                <button class="btn-remove-nested-member" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" aria-label="Remove ${memberName}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Remove
                </button>
            </div>
        </div>
    `;

    return div;
}

/* ============================================
   CALCULATIONS UPDATE
   ============================================ */
function updateAllCalculations() {
    state.globalMarkupPercent = parseFloat(document.getElementById('globalMarkup').value) || 0;

    const activePackages = getActivePackages();
    activePackages.forEach((pkg, index) => {

        let baseTotal = 0;
        let markupTotal = 0;
        const customMarkupItems = [];

        pkg.items.forEach(item => {
            const base = calculateBaseAmount(item);
            const markup = calculateMarkupAmount(item);
            baseTotal += base;
            markupTotal += markup;

            // Track items with custom markup for breakdown
            if (item.type === 'hourly-product' && item.packageElements) {
                item.packageElements.forEach(member => {
                    if (member.useCustomMarkup && member.customMarkupPercent !== undefined) {
                        const memberBase = (member.costRate || 0) * (member.hours || 0);
                        const memberMarkup = memberBase * (member.customMarkupPercent / 100);
                        customMarkupItems.push({
                            name: member.name || 'Unnamed',
                            markup: memberMarkup,
                            percent: member.customMarkupPercent
                        });
                    }
                });
            }

            if (item.type === 'hourly-product') {
                const summaryEl = document.getElementById(`hourly-summary-${item.id}`);
                if (summaryEl) {
                    summaryEl.textContent = `Base: $${base.toFixed(2)}, Markup: $${markup.toFixed(2)}, Total: $${(base + markup).toFixed(2)}`;
                }
            } else {
                const baseEl = document.getElementById(`item-base-${item.id}`);
                const markupEl = document.getElementById(`item-markup-${item.id}`);
                const totalEl = document.getElementById(`item-total-${item.id}`);
                if (baseEl) baseEl.textContent = `$${base.toFixed(2)}`;
                if (markupEl) markupEl.textContent = `$${markup.toFixed(2)}`;
                if (totalEl) totalEl.textContent = `$${(base + markup).toFixed(2)}`;
            }
        });

        // Add items from previous tiers if inheritance is enabled
        const inheritedPackages = getInheritedPackagesForIndex(index, activePackages);
        inheritedPackages.forEach(inheritedPkg => {
            inheritedPkg.items.forEach(item => {
                baseTotal += calculateBaseAmount(item);
                markupTotal += calculateMarkupAmount(item);
                // Track custom markup items from inherited packages
                if (item.type === 'hourly-product' && item.packageElements) {
                    item.packageElements.forEach(member => {
                        if (member.useCustomMarkup && member.customMarkupPercent !== undefined) {
                            const memberBase = (member.costRate || 0) * (member.hours || 0);
                            const memberMarkup = memberBase * (member.customMarkupPercent / 100);
                            customMarkupItems.push({
                                name: member.name || 'Unnamed',
                                markup: memberMarkup,
                                percent: member.customMarkupPercent
                            });
                        }
                    });
                }
            });
        });

        // Render custom markup breakdown
        const breakdownContainer = document.getElementById(`custom-markup-breakdown-${pkg.id}`);
        if (breakdownContainer) {
            if (customMarkupItems.length > 0) {
                breakdownContainer.innerHTML = customMarkupItems.map(item => `
                    <div class="totals-row totals-row-custom-markup">
                        <span class="totals-label totals-label-indent">${item.name} (${item.percent.toFixed(1)}%)</span>
                        <span class="totals-value">$${item.markup.toFixed(2)}</span>
                    </div>
                `).join('');
            } else {
                breakdownContainer.innerHTML = '';
            }
        }

        const finalTotal = baseTotal + markupTotal;
        const costBasis = pkg.costBasis || 0;
        const profit = finalTotal - costBasis - baseTotal;
        const margin = finalTotal > 0 ? (profit / finalTotal) * 100 : 0;

        const baseTotalEl = document.getElementById(`base-total-${pkg.id}`);
        const markupTotalEl = document.getElementById(`markup-total-${pkg.id}`);
        const finalTotalEl = document.getElementById(`final-total-${pkg.id}`);
        const marginEl = document.getElementById(`margin-total-${pkg.id}`);

        if (baseTotalEl) baseTotalEl.textContent = `$${baseTotal.toFixed(2)}`;
        if (markupTotalEl) {
            markupTotalEl.textContent = `$${markupTotal.toFixed(2)}`;
            markupTotalEl.closest('.totals-row').querySelector('.totals-label').textContent = `Markup (${state.globalMarkupPercent}%)`;
        }
        if (finalTotalEl) finalTotalEl.textContent = `$${finalTotal.toFixed(2)}`;
        if (marginEl) marginEl.textContent = `${margin.toFixed(1)}%`;
    });
}

/* ============================================
   EXPORT / IMPORT
   ============================================ */
function downloadItemsAsCSV() {
    const rows = [];

    // Metadata row
    rows.push(['PRICING CALCULATOR EXPORT']);
    rows.push(['Project Name', state.projectName || 'Untitled Project']);
    rows.push(['Exported', new Date().toISOString().split('T')[0]]);
    rows.push(['Global Markup %', state.globalMarkupPercent]);
    rows.push([]);

    // Summary section
    rows.push(['=== SUMMARY BY PACKAGE ===']);
    rows.push(['Package', 'Cost Basis', 'Base Total', 'Markup', 'Final Total', 'Profit', 'Margin %']);
    
    const activePackages = getActivePackages();
    activePackages.forEach((pkg, index) => {
        let baseTotal = 0;
        let markupTotal = 0;

        pkg.items.forEach(item => {
            baseTotal += calculateBaseAmount(item);
            markupTotal += calculateMarkupAmount(item);
        });

        // Add previous tiers if inheritance is enabled
        const inheritedPackages = getInheritedPackagesForIndex(index, activePackages);
        inheritedPackages.forEach(inheritedPkg => {
            inheritedPkg.items.forEach(item => {
                baseTotal += calculateBaseAmount(item);
                markupTotal += calculateMarkupAmount(item);
            });
        });

        const finalTotal = baseTotal + markupTotal;
        const costBasis = pkg.costBasis || 0;
        const profit = finalTotal - costBasis - baseTotal;
        const margin = finalTotal > 0 ? (profit / finalTotal) * 100 : 0;

        rows.push([
            pkg.name,
            formatCurrency(costBasis),
            formatCurrency(baseTotal),
            formatCurrency(markupTotal),
            formatCurrency(finalTotal),
            formatCurrency(profit),
            `${margin.toFixed(1)}%`
        ]);
    });

    rows.push([]);

    // Items section
    rows.push(['=== ITEMS DETAIL ===']);
    rows.push(['Package', 'Item Type', 'Item Name', 'Unit Price', 'Quantity', 'Base Amount', 'Markup %', 'Markup Amount', 'Final Amount', 'Description']);

    activePackages.forEach(pkg => {
        pkg.items.forEach(item => {
            const base = calculateBaseAmount(item);
            const markup = calculateMarkupAmount(item);
            const final = base + markup;

            if (item.type === 'flat-product') {
                rows.push([
                    pkg.name,
                    'Flat Rate',
                    item.name || 'Untitled',
                    formatCurrency(item.price),
                    '1',
                    formatCurrency(item.price),
                    '0%',
                    formatCurrency(0),
                    formatCurrency(item.price),
                    'Flat-price deliverable'
                ]);
            } else if (item.type === 'hourly-product') {
                rows.push([
                    pkg.name,
                    'Hourly',
                    item.name || 'Untitled',
                    '',
                    '',
                    formatCurrency(base),
                    state.globalMarkupPercent + '%',
                    formatCurrency(markup),
                    formatCurrency(final),
                    `Container for package elements (${item.packageElements?.length || 0} elements)`
                ]);
            }
        });
    });

    rows.push([]);

    // Package elements section
    rows.push(['=== PACKAGE ELEMENTS (Nested) ===']);
    rows.push(['Package', 'Parent Item', 'Element Name', 'Cost Rate', 'Sell Rate', 'Hours', 'Base Amount', 'Markup %', 'Markup Amount', 'Final Amount', 'Custom Markup', 'Calculation']);

    activePackages.forEach(pkg => {
        pkg.items.forEach(item => {
            if (item.type === 'hourly-product' && item.packageElements && item.packageElements.length > 0) {
                item.packageElements.forEach(member => {
                    const costRate = member.costRate || 0;
                    const sellRate = member.sellRate || costRate;
                    const hours = member.hours || 0;
                    const base = costRate * hours;
                    
                    let markup, markupPercent;
                    if (member.useCustomMarkup) {
                        markupPercent = member.customMarkupPercent || 0;
                        markup = base * (markupPercent / 100);
                    } else {
                        markup = (sellRate * hours) - base;
                        markupPercent = base > 0 ? ((sellRate - costRate) / costRate * 100) : 0;
                    }
                    
                    const final = base + markup;
                    const customMarkupStatus = member.useCustomMarkup ? `Yes (${markupPercent.toFixed(1)}%)` : `No (Global ${state.globalMarkupPercent}%)`;

                    rows.push([
                        pkg.name,
                        item.name || 'Untitled',
                        member.name || 'Unnamed',
                        formatCurrency(costRate),
                        formatCurrency(sellRate),
                        hours.toFixed(2),
                        formatCurrency(base),
                        markupPercent.toFixed(1) + '%',
                        formatCurrency(markup),
                        formatCurrency(final),
                        customMarkupStatus,
                        `Cost: ${formatCurrency(costRate)}/hr × ${hours.toFixed(2)} hrs = ${formatCurrency(base)} → Sell: ${formatCurrency(sellRate)}/hr`
                    ]);
                });
            }
        });
    });

    rows.push([]);

    // Notes section
    rows.push(['=== DELIVERABLE NOTES ===']);
    rows.push(['Package', 'Deliverable', 'Notes']);

    activePackages.forEach(pkg => {
        pkg.items.forEach(item => {
            if (item.notes && item.notes.trim()) {
                rows.push([
                    pkg.name,
                    item.name || 'Untitled',
                    item.notes
                ]);
            }
        });
    });

    // Convert to CSV
    const csv = rows.map((row, rowIndex) => {
        return row.map((v, colIndex) => {
            const s = String(v ?? '');
            if (/[,"\n]/.test(s)) {
                return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
        }).join(',');
    }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectSlug = state.projectName ? state.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'untitled';
    a.download = `${projectSlug}-pricing-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function downloadStateAsJSON() {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state, null, 2))}`;
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    const projectSlug = state.projectName ? state.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'untitled';
    a.setAttribute('download', `${projectSlug}-pricing-state.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function downloadSimpleText() {
    const lines = [''];
    
    // Process each package tier
    activePackages.forEach((pkg, index) => {
        if (!pkg) return;

        // Add tier header in uppercase
        lines.push((pkg.name || 'Untitled').toUpperCase());
        
        // Only show items specific to this tier (not inherited)
        pkg.items.forEach((item, itemIndex) => {
            lines.push(item.name || 'Untitled');
            if (item.notes && item.notes.trim()) {
                lines.push(item.notes.trim());
            }
            // Add blank line after each deliverable except the last one
            if (itemIndex < pkg.items.length - 1) {
                lines.push('');
            }
        });
        
        // Add extra blank lines between tiers (except after the last one)
        if (index < activePackages.length - 1) {
            lines.push('');
            lines.push('');
        }
    });
    
    // Create and download the file
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const projectSlug = state.projectName ? state.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : 'untitled';
    a.download = `${projectSlug}-simple-text-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function showResetConfirmation() {
    const modal = document.getElementById('confirmModal');
    modal.hidden = false;
    document.getElementById('confirmReset').focus();
    
    // Trap focus in modal
    document.body.style.overflow = 'hidden';
}

function hideResetConfirmation() {
    const modal = document.getElementById('confirmModal');
    modal.hidden = true;
    document.body.style.overflow = '';
    document.getElementById('resetAll').focus();
}

function resetEverything() {
    saveToHistory();
    
    // Preserve templates and clients
    const savedTemplates = state.templates;
    const savedClients = state.clients;
    const savedCustomRoles = state.customRoles || [];
    const savedIndustryOverrides = state.industryRoleOverrides || {};
    
    // Reset to initial state but keep templates and clients
    state = {
        projectName: '',
        packages: [],
        globalMarkupPercent: 20,
        globalShowMargin: true,
        nextPackageId: 1,
        nextItemId: 1,
        nextNestedMemberId: 1,
        templates: savedTemplates,
        clients: savedClients,
        customRoles: savedCustomRoles,
        industryRoleOverrides: savedIndustryOverrides
    };
    
    // Save updated state (preserving templates/clients)
    debouncedSave();
    
    // Update UI
    document.getElementById('projectName').value = '';
    document.getElementById('globalMarkup').value = 20;
    const globalMarginToggle = document.getElementById('globalMarginToggle');
    if (globalMarginToggle) globalMarginToggle.checked = true;
    
    render();
    updateAllCalculations();
    hideResetConfirmation();
    showSaveStatus('Reset complete');
}

function loadStateFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported || !Array.isArray(imported.packages)) {
                alert('Invalid file format. Expected JSON with packages array.');
                return;
            }

            // Fully restore state
            state = imported;

            // Ensure all required fields are present
            if (state.projectName === undefined) state.projectName = '';
            if (state.globalMarkupPercent === undefined) state.globalMarkupPercent = 20;
            if (state.globalShowMargin === undefined) state.globalShowMargin = true;
            if (state.nextPackageId === undefined) state.nextPackageId = 1;
            if (state.nextItemId === undefined) state.nextItemId = 1;
            if (state.nextNestedMemberId === undefined) state.nextNestedMemberId = 1;
            if (state.templates === undefined) state.templates = {};
            if (state.clients === undefined) state.clients = {};
            if (state.customRoles === undefined) state.customRoles = [];
            if (state.industryRoleOverrides === undefined) state.industryRoleOverrides = {};

            // Ensure all packages have new fields
            state.packages.forEach((pkg, index) => {
                normalizePackage(pkg, index);
                if (pkg.items) {
                    pkg.items.forEach(item => {
                        if (item.notes === undefined) item.notes = '';
                    });
                }
            });

            // Update project name input field
            document.getElementById('projectName').value = state.projectName;

            // Recalculate max IDs from imported data
            state.packages.forEach(pkg => {
                if (pkg.id >= state.nextPackageId) state.nextPackageId = pkg.id + 1;
                if (pkg.items) {
                    pkg.items.forEach(item => {
                        if (item.id >= state.nextItemId) state.nextItemId = item.id + 1;
                        // Migrate teamMembers to packageElements if needed
                        if (item.type === 'hourly-product' && item.teamMembers && !item.packageElements) {
                            item.packageElements = item.teamMembers;
                            delete item.teamMembers;
                        }
                        if (item.type === 'hourly-product' && !item.packageElements) item.packageElements = [];
                        if (item.packageElements) {
                            item.packageElements.forEach(member => {
                                if (member.id >= state.nextNestedMemberId) state.nextNestedMemberId = member.id + 1;
                                // Migrate old hourlyRate to new cost/sell structure
                                if (member.hourlyRate !== undefined && member.costRate === undefined) {
                                    member.costRate = member.hourlyRate;
                                    member.sellRate = member.hourlyRate;
                                    delete member.hourlyRate;
                                }
                                if (member.hours === undefined) member.hours = 0;
                                if (member.useCustomMarkup === undefined) member.useCustomMarkup = false;
                                if (member.customMarkupPercent === undefined) member.customMarkupPercent = 0;
                            });
                        }
                    });
                }
            });

            // Update the markup input field
            document.getElementById('globalMarkup').value = state.globalMarkupPercent;

            // Full re-render
            render();
            updateAllCalculations();

            alert('State loaded successfully!');
        } catch (err) {
            console.error(err);
            alert(`Could not read JSON file: ${err.message}`);
        }
    };
    reader.readAsText(file);

    // Reset file input
    document.getElementById('jsonUpload').value = '';
}

/* ============================================
   DRAG AND DROP
   ============================================ */
let draggedItem = null;
let draggedFromPackageId = null;

function enableDragAndDrop() {
    const grid = document.getElementById('packagesGrid');
    if (!grid) return;

    // Add dragstart event to items
    grid.addEventListener('dragstart', (e) => {
        const itemContainer = e.target.closest('[data-hourly-id], [data-flat-id]');
        if (!itemContainer) return;

        const itemId = parseInt(itemContainer.dataset.hourlyId || itemContainer.dataset.flatId);
        const packageEl = itemContainer.closest('.package');
        const packageId = parseInt(packageEl.querySelector('[data-package-id]').dataset.packageId);

        draggedItem = { itemId, type: itemContainer.dataset.hourlyId ? 'hourly' : 'flat' };
        draggedFromPackageId = packageId;
        
        itemContainer.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', itemContainer.innerHTML);
    });

    // Add dragend event
    grid.addEventListener('dragend', (e) => {
        const itemContainer = e.target.closest('[data-hourly-id], [data-flat-id]');
        if (itemContainer) {
            itemContainer.classList.remove('dragging');
        }
        
        // Clean up drag-over states
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        // Clean up insertion indicators
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        
        draggedItem = null;
        draggedFromPackageId = null;
    });

    // Add dragover event to drop zones
    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.items-section');
        if (dropZone && draggedItem) {
            e.dataTransfer.dropEffect = 'move';
            
            // Add visual feedback to the container
            const itemsContainer = dropZone.querySelector('[id^="items-"]');
            if (itemsContainer) {
                itemsContainer.classList.add('drag-over');
            }
            
            // Show insertion indicator on specific items
            const targetItem = e.target.closest('[data-hourly-id], [data-flat-id]');
            if (targetItem) {
                const targetRect = targetItem.getBoundingClientRect();
                const targetMiddle = targetRect.top + targetRect.height / 2;
                
                // Remove previous indicators
                document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
                    el.classList.remove('drag-over-top', 'drag-over-bottom');
                });
                
                // Add indicator based on position
                if (e.clientY < targetMiddle) {
                    targetItem.classList.add('drag-over-top');
                } else {
                    targetItem.classList.add('drag-over-bottom');
                }
            }
        }
    });

    // Add dragenter event
    grid.addEventListener('dragenter', (e) => {
        const dropZone = e.target.closest('.items-section');
        if (dropZone && draggedItem) {
            const itemsContainer = dropZone.querySelector('[id^="items-"]');
            if (itemsContainer) {
                itemsContainer.classList.add('drag-over');
            }
        }
    });

    // Add dragleave event
    grid.addEventListener('dragleave', (e) => {
        const dropZone = e.target.closest('.items-section');
        if (dropZone) {
            const itemsContainer = dropZone.querySelector('[id^="items-"]');
            if (itemsContainer && !itemsContainer.contains(e.relatedTarget)) {
                itemsContainer.classList.remove('drag-over');
            }
        }
    });

    // Add drop event
    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        
        const dropZone = e.target.closest('.items-section');
        if (!dropZone || !draggedItem) return;

        const targetPackageEl = dropZone.closest('.package');
        const addButton = targetPackageEl.querySelector('[data-package-id]');
        const targetPackageId = parseInt(addButton.dataset.packageId);

        // Clean up visual feedback
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
        
        // Clean up insertion indicators
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        // Find the drop target position
        const targetItem = e.target.closest('[data-hourly-id], [data-flat-id]');
        const itemsContainer = dropZone.querySelector('[id^="items-"]');
        
        if (targetPackageId === draggedFromPackageId) {
            // Reorder within the same package
            reorderItemInPackage(draggedFromPackageId, draggedItem.itemId, targetItem, itemsContainer, e.clientY);
        } else {
            // Move between packages
            moveItemBetweenPackages(draggedFromPackageId, targetPackageId, draggedItem.itemId, targetItem, itemsContainer, e.clientY);
        }
    });
}

function reorderItemInPackage(packageId, itemId, targetItem, itemsContainer, clientY) {
    const pkg = findPackage(packageId);
    if (!pkg) return;

    const itemIndex = pkg.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const [movedItem] = pkg.items.splice(itemIndex, 1);
    
    // Determine insertion position
    let insertIndex = pkg.items.length;
    
    if (targetItem) {
        const targetItemId = parseInt(targetItem.dataset.hourlyId || targetItem.dataset.flatId);
        const targetIndex = pkg.items.findIndex(item => item.id === targetItemId);
        
        if (targetIndex !== -1) {
            const targetRect = targetItem.getBoundingClientRect();
            const targetMiddle = targetRect.top + targetRect.height / 2;
            
            // Insert before or after based on cursor position
            if (clientY < targetMiddle) {
                insertIndex = targetIndex;
            } else {
                insertIndex = targetIndex + 1;
            }
        }
    }
    
    saveToHistory();
    pkg.items.splice(insertIndex, 0, movedItem);

    // Re-render and update
    render();
    updateEmptyStates();
    updateAllCalculations();
    debouncedSave();
    
    // Re-enable drag and drop after re-render
    enableDragAndDrop();
    
    showSaveStatus('Item reordered');
}

function moveItemBetweenPackages(fromPackageId, toPackageId, itemId, targetItem, itemsContainer, clientY) {
    const fromPackage = findPackage(fromPackageId);
    const toPackage = findPackage(toPackageId);

    if (!fromPackage || !toPackage) return;

    // Find and remove the item from the source package
    const itemIndex = fromPackage.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    saveToHistory();
    
    const [movedItem] = fromPackage.items.splice(itemIndex, 1);
    
    // Determine insertion position in target package
    let insertIndex = toPackage.items.length;
    
    if (targetItem) {
        const targetItemId = parseInt(targetItem.dataset.hourlyId || targetItem.dataset.flatId);
        const targetIndex = toPackage.items.findIndex(item => item.id === targetItemId);
        
        if (targetIndex !== -1) {
            const targetRect = targetItem.getBoundingClientRect();
            const targetMiddle = targetRect.top + targetRect.height / 2;
            
            // Insert before or after based on cursor position
            if (clientY < targetMiddle) {
                insertIndex = targetIndex;
            } else {
                insertIndex = targetIndex + 1;
            }
        }
    }
    
    toPackage.items.splice(insertIndex, 0, movedItem);

    // Re-render and update
    render();
    updateEmptyStates();
    updateAllCalculations();
    debouncedSave();
    
    // Re-enable drag and drop after re-render
    enableDragAndDrop();
    
    showSaveStatus('Item moved');
}

/* ============================================
   RENDERING
   ============================================ */
function render() {
    const grid = document.getElementById('packagesGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const activePackages = getActivePackages();
    grid.classList.toggle('packages-grid-centered', activePackages.length < 3);
    activePackages.forEach((pkg, index) => {
        const pkgEl = createPackageElement(pkg, index);
        grid.appendChild(pkgEl);
    });
    
    // Enable drag and drop after rendering
    enableDragAndDrop();

    updatePackageActionsVisibility();
    updateEmptyStates();
    updateInheritedItemsDisplay();
    renderInactivePackagesList();
}

/* ============================================
   EVENT LISTENERS
   ============================================ */
function attachEventListeners() {
    const grid = document.getElementById('packagesGrid');
    if (!grid) {
        return;
    }
    
    // Click event delegation
    grid.addEventListener('click', e => {
        if (e.target.classList.contains('btn-tier-menu') || e.target.closest('.btn-tier-menu')) {
            const btn = e.target.classList.contains('btn-tier-menu') ? e.target : e.target.closest('.btn-tier-menu');
            const packageId = parseInt(btn.dataset.packageId);
            e.stopPropagation();
            toggleTierMenu(packageId);
            return false;
        }

        if (e.target.classList.contains('btn-add-next-tier') || e.target.closest('.btn-add-next-tier')) {
            const btn = e.target.classList.contains('btn-add-next-tier') ? e.target : e.target.closest('.btn-add-next-tier');
            const packageId = parseInt(btn.dataset.packageId);
            const nextTierKey = btn.dataset.nextTier;
            addNextTierFromPackage(packageId, nextTierKey);
            return false;
        }

        if (e.target.classList.contains('btn-toggle-package') || e.target.closest('.btn-toggle-package')) {
            const btn = e.target.classList.contains('btn-toggle-package') ? e.target : e.target.closest('.btn-toggle-package');
            const packageId = parseInt(btn.dataset.packageId);
            togglePackageActive(packageId);
            return false;
        }

        if (e.target.classList.contains('btn-minimize-package') || e.target.closest('.btn-minimize-package')) {
            const btn = e.target.classList.contains('btn-minimize-package') ? e.target : e.target.closest('.btn-minimize-package');
            const packageId = parseInt(btn.dataset.packageId);
            togglePackageActive(packageId);
            closeAllTierMenus();
            return false;
        }

        if (e.target.classList.contains('btn-delete-package') || e.target.closest('.btn-delete-package')) {
            const btn = e.target.classList.contains('btn-delete-package') ? e.target : e.target.closest('.btn-delete-package');
            const packageId = parseInt(btn.dataset.packageId);
            deletePackagePermanently(packageId);
            closeAllTierMenus();
            return false;
        }

        if (e.target.classList.contains('btn-reset-tier') || e.target.closest('.btn-reset-tier')) {
            const btn = e.target.classList.contains('btn-reset-tier') ? e.target : e.target.closest('.btn-reset-tier');
            const packageId = parseInt(btn.dataset.packageId);
            resetPackageTier(packageId);
            closeAllTierMenus();
            return false;
        }

        if (e.target.classList.contains('btn-add-flat-product') || e.target.closest('.btn-add-flat-product')) {
            const btn = e.target.classList.contains('btn-add-flat-product') ? e.target : e.target.closest('.btn-add-flat-product');
            const packageId = parseInt(btn.dataset.packageId);
            addItem(packageId, 'flat-product');
            return false;
        }
        if (e.target.classList.contains('btn-add-hourly-product') || e.target.closest('.btn-add-hourly-product')) {
            const btn = e.target.classList.contains('btn-add-hourly-product') ? e.target : e.target.closest('.btn-add-hourly-product');
            const packageId = parseInt(btn.dataset.packageId);
            addItem(packageId, 'hourly-product');
            return false;
        }
        if (e.target.classList.contains('btn-remove-item') || e.target.closest('.btn-remove-item')) {
            const btn = e.target.classList.contains('btn-remove-item') ? e.target : e.target.closest('.btn-remove-item');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            removeItem(packageId, itemId);
            return false;
        }

        // Accessible hourly product toggle
        const hourlyHeader = e.target.closest('.hourly-product-header');
        if (hourlyHeader) {
            const container = hourlyHeader.closest('[data-hourly-id]');
            if (container) {
                const isExpanded = container.classList.toggle('expanded');
                const content = container.querySelector('.hourly-product-content');
                content.classList.toggle('expanded');
                hourlyHeader.setAttribute('aria-expanded', isExpanded);
                return false;
            }
        }

        // Accessible flat product toggle
        const collapsibleHeader = e.target.closest('.collapsible-header');
        if (collapsibleHeader) {
            const container = collapsibleHeader.closest('[data-flat-id]');
            if (container) {
                const isExpanded = container.classList.toggle('expanded');
                const content = container.querySelector('.collapsible-content');
                content.classList.toggle('expanded');
                collapsibleHeader.setAttribute('aria-expanded', isExpanded);
                return false;
            }
        }

        if (e.target.classList.contains('btn-add-nested-member') || e.target.closest('.btn-add-nested-member')) {
            const btn = e.target.classList.contains('btn-add-nested-member') ? e.target : e.target.closest('.btn-add-nested-member');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            addNestedTeamMember(packageId, itemId);
            return false;
        }

        if (e.target.classList.contains('btn-remove-nested-member') || e.target.closest('.btn-remove-nested-member')) {
            const btn = e.target.classList.contains('btn-remove-nested-member') ? e.target : e.target.closest('.btn-remove-nested-member');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            const memberId = parseInt(btn.dataset.memberId);
            removeNestedTeamMember(packageId, itemId, memberId);
            return false;
        }

        if (e.target.classList.contains('btn-duplicate-nested-member') || e.target.closest('.btn-duplicate-nested-member')) {
            const btn = e.target.classList.contains('btn-duplicate-nested-member') ? e.target : e.target.closest('.btn-duplicate-nested-member');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            const memberId = parseInt(btn.dataset.memberId);
            duplicateNestedTeamMember(packageId, itemId, memberId);
            return false;
        }

        if (e.target.classList.contains('btn-reset-markup') || e.target.closest('.btn-reset-markup')) {
            const btn = e.target.classList.contains('btn-reset-markup') ? e.target : e.target.closest('.btn-reset-markup');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            const memberId = parseInt(btn.dataset.memberId);
            
            const pkg = findPackage(packageId);
            if (pkg) {
                const item = pkg.items.find(i => i.id === itemId);
                if (item && item.packageElements) {
                    const member = item.packageElements.find(m => m.id === memberId);
                    if (member) {
                        saveToHistory();
                        member.useCustomMarkup = false;
                        member.customMarkupPercent = 0;
                        member.sellRate = member.costRate;
                        renderNestedMembersForItem(packageId, itemId);
                        updateAllCalculations();
                        debouncedSave();
                    }
                }
            }
            return false;
        }

        if (e.target.classList.contains('btn-notes') || e.target.closest('.btn-notes')) {
            const btn = e.target.classList.contains('btn-notes') ? e.target : e.target.closest('.btn-notes');
            const packageId = parseInt(btn.dataset.packageId);
            const itemId = parseInt(btn.dataset.itemId);
            showNotesModal(packageId, itemId);
            return false;
        }

        if (e.target.classList.contains('btn-remove-package')) {
            const packageId = parseInt(e.target.dataset.packageId);
            removePackage(packageId);
            return false;
        }
    });

    // Input event delegation
    grid.addEventListener('input', e => {
        if (e.target.classList.contains('package-title-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            updatePackageName(packageId, e.target.value, false);
        }

        if (e.target.classList.contains('item-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            const itemId = parseInt(e.target.dataset.itemId);
            const field = e.target.dataset.field;
            const value = e.target.dataset.field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
            updateItem(packageId, itemId, field, value);
        }

        if (e.target.classList.contains('nested-member-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            const itemId = parseInt(e.target.dataset.itemId);
            const memberId = parseInt(e.target.dataset.memberId);
            const field = e.target.dataset.field;
            const value = e.target.dataset.field === 'name' ? e.target.value : parseFloat(e.target.value) || 0;
            updateNestedTeamMember(packageId, itemId, memberId, field, value);
        }

        if (e.target.classList.contains('cost-basis-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            const value = parseFloat(e.target.value) || 0;
            const pkg = findPackage(packageId);
            if (pkg && pkg.costBasis !== value) {
                saveToHistory();
                pkg.costBasis = value;
                updateAllCalculations();
                debouncedSave();
            }
        }

    });

    // Change event delegation for checkboxes and selects
    grid.addEventListener('change', e => {
        if (e.target.classList.contains('package-title-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            updatePackageName(packageId, e.target.value, true);
        }

        if (e.target.classList.contains('inherit-toggle-input')) {
            const packageId = parseInt(e.target.dataset.packageId);
            const pkg = findPackage(packageId);
            if (pkg) {
                saveToHistory();
                pkg.inheritFromPrevious = e.target.checked;
                updateInheritedItemsDisplay();
                updateAllCalculations();
                debouncedSave();
            }
        }

        if (e.target.classList.contains('custom-markup-checkbox')) {
            const packageId = parseInt(e.target.dataset.packageId);
            const itemId = parseInt(e.target.dataset.itemId);
            const memberId = parseInt(e.target.dataset.memberId);
            updateNestedTeamMember(packageId, itemId, memberId, 'useCustomMarkup', e.target.checked);
            // Re-render to show/hide related controls
            renderNestedMembersForItem(packageId, itemId);
        }

        if (e.target.classList.contains('role-preset-select')) {
            const roleName = e.target.value;
            if (!roleName) return;
            
            const packageId = parseInt(e.target.dataset.packageId);
            const itemId = parseInt(e.target.dataset.itemId);
            const memberId = parseInt(e.target.dataset.memberId);
            
            // Find the role in combined list (check for overridden industry roles first)
            let selectedRole = null;
            
            // Check if this industry role has been customized
            if (state.industryRoleOverrides && state.industryRoleOverrides[roleName]) {
                selectedRole = state.industryRoleOverrides[roleName];
            } else {
                const allRoles = [...CREATIVE_INDUSTRY_ROLES, ...(state.customRoles || [])];
                selectedRole = allRoles.find(r => r.role === roleName);
            }
            
            if (selectedRole) {
                const pkg = findPackage(packageId);
                if (pkg) {
                    const item = pkg.items.find(i => i.id === itemId);
                    if (item && item.packageElements) {
                        const member = item.packageElements.find(m => m.id === memberId);
                        if (member) {
                            saveToHistory();
                            member.name = selectedRole.role;
                            member.costRate = selectedRole.costRate || selectedRole.hourlyRate;
                            member.sellRate = selectedRole.sellRate || selectedRole.hourlyRate;
                            member.hours = selectedRole.hours || 10;
                            
                            // Check if cost and sell are different - if so, enable custom markup
                            if (member.costRate !== member.sellRate) {
                                member.useCustomMarkup = true;
                                // Calculate markup percentage
                                if (member.costRate > 0) {
                                    member.customMarkupPercent = ((member.sellRate - member.costRate) / member.costRate) * 100;
                                }
                            } else {
                                member.useCustomMarkup = false;
                                member.customMarkupPercent = 0;
                            }
                            
                            renderNestedMembersForItem(packageId, itemId);
                            updateAllCalculations();
                            debouncedSave();
                        }
                    }
                }
            }
            
            // Reset dropdown
            e.target.value = '';
        }
    });

    // Global margin toggle listener
    const globalMarginToggle = document.getElementById('globalMarginToggle');
    if (globalMarginToggle) {
        globalMarginToggle.addEventListener('change', (e) => {
            saveToHistory();
            state.globalShowMargin = e.target.checked;
            render();
            debouncedSave();
        });
    }
    
    // Library panel toggle
    const libraryToggle = document.getElementById('libraryToggle');
    const libraryPanel = document.getElementById('libraryPanel');
    if (libraryToggle && libraryPanel) {
        libraryToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            libraryPanel.toggleAttribute('hidden');
            // Close dropdown menu if open
            const dropdownMenu = document.getElementById('dropdownMenu');
            if (dropdownMenu) dropdownMenu.setAttribute('hidden', '');
        });
        
        // Close library panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.library-dropdown')) {
                libraryPanel.setAttribute('hidden', '');
            }
        });
    }
    
    // Dropdown menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');
    if (menuToggle && dropdownMenu) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.toggleAttribute('hidden');
            // Close library panel if open
            if (libraryPanel) libraryPanel.setAttribute('hidden', '');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu')) {
                dropdownMenu.setAttribute('hidden', '');
            }
        });
    }
    
    // Template controls
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadTemplate(e.target.value);
                e.target.value = '';
            }
        });
    }
    
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => {
            const name = prompt('Enter template name:');
            if (name && name.trim()) {
                saveAsTemplate(name.trim());
            }
        });
    }
    
    // Client controls
    const clientSelect = document.getElementById('clientSelect');
    const saveToClientBtn = document.getElementById('saveToClientBtn');
    
    if (clientSelect) {
        clientSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                showClientProjects(e.target.value);
                // Enable save to client button when client is selected
                if (saveToClientBtn) {
                    saveToClientBtn.disabled = false;
                    saveToClientBtn.textContent = `Save to ${e.target.value}`;
                }
            } else {
                // Disable button when no client selected
                if (saveToClientBtn) {
                    saveToClientBtn.disabled = true;
                    saveToClientBtn.textContent = 'Save to Client';
                }
                const projectRow = document.getElementById('projectRow');
                if (projectRow) projectRow.style.display = 'none';
            }
        });
    }
    
    const newClientBtn = document.getElementById('newClientBtn');
    if (newClientBtn) {
        newClientBtn.addEventListener('click', () => {
            const name = prompt('Enter new client name:');
            if (name && name.trim()) {
                saveToClientHistory(name.trim());
                // Select the newly created client
                if (clientSelect) {
                    clientSelect.value = name.trim();
                    if (saveToClientBtn) {
                        saveToClientBtn.disabled = false;
                        saveToClientBtn.textContent = `Save to ${name.trim()}`;
                    }
                }
            }
        });
    }
    
    if (saveToClientBtn) {
        saveToClientBtn.addEventListener('click', () => {
            const selectedClient = clientSelect ? clientSelect.value : '';
            if (selectedClient) {
                saveToClientHistory(selectedClient);
            }
        });
    }
    
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
        projectSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                const [clientName, index] = e.target.value.split('|');
                loadClientHistory(clientName, parseInt(index));
                e.target.value = '';
                const projectRow = document.getElementById('projectRow');
                if (projectRow) projectRow.style.display = 'none';
                const libraryPanel = document.getElementById('libraryPanel');
                if (libraryPanel) libraryPanel.setAttribute('hidden', '');
                // Reset client select
                if (clientSelect) clientSelect.value = '';
                if (saveToClientBtn) {
                    saveToClientBtn.disabled = true;
                    saveToClientBtn.textContent = 'Save to Client';
                }
            }
        });
    }

    // Global markup listener
    const globalMarkupEl = document.getElementById('globalMarkup');
    if (globalMarkupEl) {
        globalMarkupEl.addEventListener('input', updateGlobalMarkup);
    }
    
    // Project name listener
    const projectNameEl = document.getElementById('projectName');
    if (projectNameEl) {
        projectNameEl.addEventListener('input', (e) => {
            updateProjectName(e.target.value);
        });
    }
    
    // Export buttons
    document.getElementById('downloadCsv').addEventListener('click', downloadItemsAsCSV);
    document.getElementById('downloadJson').addEventListener('click', downloadStateAsJSON);
    document.getElementById('downloadSimpleText').addEventListener('click', downloadSimpleText);
    document.getElementById('jsonUpload').addEventListener('change', loadStateFromJSON);
    
    // Undo/Redo buttons
    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z / Cmd+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Ctrl+Shift+Z / Cmd+Shift+Z for redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            redo();
        }
        // Ctrl+Y / Cmd+Y for redo (alternative)
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });
    
    // File upload label keyboard support
    const fileUploadLabel = document.querySelector('.file-upload-label .btn');
    if (fileUploadLabel) {
        fileUploadLabel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('jsonUpload').click();
            }
        });
    }
    
    // Reset button and modal
    document.getElementById('resetAll').addEventListener('click', showResetConfirmation);
    document.getElementById('confirmReset').addEventListener('click', resetEverything);
    document.getElementById('cancelReset').addEventListener('click', hideResetConfirmation);

    // Action confirm modal
    const actionConfirmModal = document.getElementById('actionConfirmModal');
    const actionConfirmAccept = document.getElementById('actionConfirmAccept');
    const actionConfirmCancel = document.getElementById('actionConfirmCancel');
    if (actionConfirmAccept) {
        actionConfirmAccept.addEventListener('click', () => {
            const callback = actionConfirmCallback;
            hideActionConfirm();
            if (callback) callback();
        });
    }
    if (actionConfirmCancel) {
        actionConfirmCancel.addEventListener('click', hideActionConfirm);
    }
    if (actionConfirmModal) {
        actionConfirmModal.addEventListener('click', (e) => {
            if (e.target.id === 'actionConfirmModal') {
                hideActionConfirm();
            }
        });
    }
    
    // Close modal on overlay click or Escape key
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') {
            hideResetConfirmation();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!document.getElementById('confirmModal').hidden) {
                hideResetConfirmation();
            }
            if (!document.getElementById('notesModal').hidden) {
                hideNotesModal();
            }
            if (!document.getElementById('actionConfirmModal').hidden) {
                hideActionConfirm();
            }
        }
    });
    
    // Notes modal buttons
    document.getElementById('saveNotes').addEventListener('click', saveNotes);
    document.getElementById('cancelNotes').addEventListener('click', hideNotesModal);
    
    // Close notes modal on overlay click
    document.getElementById('notesModal').addEventListener('click', (e) => {
        if (e.target.id === 'notesModal') {
            hideNotesModal();
        }
    });
    
    // Manage Presets modal
    const managePresetsBtn = document.getElementById('managePresetsBtn');
    if (managePresetsBtn) {
        managePresetsBtn.addEventListener('click', showPresetsModal);
    }
    
    const closePresetsBtn = document.getElementById('closePresetsBtn');
    if (closePresetsBtn) {
        closePresetsBtn.addEventListener('click', hidePresetsModal);
    }
    
    const addCustomRoleBtn = document.getElementById('addCustomRoleBtn');
    if (addCustomRoleBtn) {
        addCustomRoleBtn.addEventListener('click', addCustomRole);
    }

    const presetEditorSave = document.getElementById('presetEditorSave');
    const presetEditorCancel = document.getElementById('presetEditorCancel');
    if (presetEditorSave) {
        presetEditorSave.addEventListener('click', savePresetEditor);
    }
    if (presetEditorCancel) {
        presetEditorCancel.addEventListener('click', hidePresetEditor);
    }
    
    // Presets modal - delegation for edit/delete buttons
    const presetsModal = document.getElementById('presetsModal');
    if (presetsModal) {
        presetsModal.addEventListener('click', (e) => {
            if (e.target.id === 'presetsModal') {
                hidePresetsModal();
            }
            
            if (e.target.classList.contains('btn-edit-preset')) {
                const index = parseInt(e.target.dataset.index);
                editCustomRole(index);
            }
            
            if (e.target.classList.contains('btn-delete-preset')) {
                const index = parseInt(e.target.dataset.index);
                deleteCustomRole(index);
            }
            
            if (e.target.classList.contains('btn-edit-industry-preset')) {
                const roleName = e.target.dataset.role;
                editIndustryRole(roleName);
            }
            
            if (e.target.classList.contains('btn-reset-industry-preset')) {
                const roleName = e.target.dataset.role;
                resetIndustryRole(roleName);
            }
        });
    }
    
    // Close presets modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!document.getElementById('presetsModal').hidden) {
                hidePresetsModal();
            }
        }
    });

    // Close tier menus on outside click or Escape
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.package-menu')) {
            closeAllTierMenus();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllTierMenus();
        }
    });

    // Blank canvas actions
    const blankAddPackageBtn = document.getElementById('blankAddPackageBtn');
    if (blankAddPackageBtn) {
        blankAddPackageBtn.addEventListener('click', () => {
            addStandardTier('good');
        });
    }

    const blankLoadEstimateBtn = document.getElementById('blankLoadEstimateBtn');
    if (blankLoadEstimateBtn) {
        blankLoadEstimateBtn.addEventListener('click', () => {
            openLibraryPanelForLoad();
        });
    }

    // Inactive package restore
    const inactivePackagesList = document.getElementById('inactivePackagesList');
    if (inactivePackagesList) {
        inactivePackagesList.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-restore-package');
            if (!btn) return;
            const packageId = parseInt(btn.dataset.packageId);
            const pkg = findPackage(packageId);
            if (pkg) {
                saveToHistory();
                pkg.isActive = true;
                render();
                updateAllCalculations();
                debouncedSave();
            }
        });
    }

}

/* ============================================
   INITIALIZATION
   ============================================ */
function init() {
    // Try to load from localStorage first
    const loaded = loadFromLocalStorage();
    
    attachEventListeners();
    
    // Initialize templates and clients dropdowns
    updateTemplateDropdown();
    updateClientDropdown();
    
    if (loaded) {
        // Sync UI with loaded state
        const projectNameEl = document.getElementById('projectName');
        if (projectNameEl) projectNameEl.value = state.projectName;
        
        const markupEl = document.getElementById('globalMarkup');
        if (markupEl) markupEl.value = state.globalMarkupPercent;
        
        const globalMarginToggle = document.getElementById('globalMarginToggle');
        if (globalMarginToggle) globalMarginToggle.checked = state.globalShowMargin;
    }
    
    render();
    updateAllCalculations();
    updateUndoRedoButtons();
    
    if (loaded) {
        showSaveStatus('Restored');
    }
}

// Start the app
init();
