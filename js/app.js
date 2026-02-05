/* ============================================
   STATE
   ============================================ */
let state = {
    projectName: '',
    packages: [
        { id: 1, name: 'Good', items: [], costBasis: 0 },
        { id: 2, name: 'Better', items: [], costBasis: 0 },
        { id: 3, name: 'Best', items: [], costBasis: 0 }
    ],
    globalMarkupPercent: 20,
    globalShowMargin: true,
    nextPackageId: 4,
    nextItemId: 1,
    nextNestedMemberId: 1,
    templates: {},
    clients: {}
};

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
const STORAGE_VERSION = '2.0.0'; // Updated for new features
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
                if (state.nextPackageId === undefined) state.nextPackageId = 4;
                if (state.nextItemId === undefined) state.nextItemId = 1;
                if (state.nextNestedMemberId === undefined) state.nextNestedMemberId = 1;
                if (state.templates === undefined) state.templates = {};
                if (state.clients === undefined) state.clients = {};
                
                // Ensure all packages have new fields
                state.packages.forEach(pkg => {
                    if (pkg.costBasis === undefined) pkg.costBasis = 0;
                    if (pkg.items) {
                        pkg.items.forEach(item => {
                            if (item.notes === undefined) item.notes = '';
                        });
                    }
                });
                
                // Recalculate max IDs
                state.packages.forEach(pkg => {
                    if (pkg.id >= state.nextPackageId) state.nextPackageId = pkg.id + 1;
                    if (pkg.items) {
                        pkg.items.forEach(item => {
                            if (item.id >= state.nextItemId) state.nextItemId = item.id + 1;
                            if (item.type === 'hourly-product' && !item.teamMembers) item.teamMembers = [];
                            if (item.teamMembers) {
                                item.teamMembers.forEach(member => {
                                    if (member.id >= state.nextNestedMemberId) state.nextNestedMemberId = member.id + 1;
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
    
    // Warn user that current estimate will be replaced
    if (!confirm('Loading this template will replace your current estimate. Continue?')) {
        return;
    }
    
    saveToHistory();
    
    const template = state.templates[templateName];
    state.packages = JSON.parse(JSON.stringify(template.packages));
    state.globalMarkupPercent = template.globalMarkupPercent;
    
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

function deleteTemplate(templateName) {
    if (!confirm(`Delete template "${templateName}"?`)) return;
    delete state.templates[templateName];
    debouncedSave();
    updateTemplateDropdown();
    showSaveStatus('Template deleted');
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
    
    // Warn user that current estimate will be replaced
    if (!confirm('Loading this project will replace your current estimate. Continue?')) {
        return;
    }
    
    saveToHistory();
    
    const entry = state.clients[clientName][index];
    state.projectName = entry.projectName;
    state.packages = JSON.parse(JSON.stringify(entry.packages));
    state.globalMarkupPercent = entry.globalMarkupPercent;
    
    document.getElementById('projectName').value = state.projectName;
    document.getElementById('globalMarkup').value = state.globalMarkupPercent;
    render();
    updateAllCalculations();
    debouncedSave();
    showSaveStatus('Client history loaded');
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
    if (!confirm(`Delete all history for "${clientName}"?`)) return;
    delete state.clients[clientName];
    debouncedSave();
    updateClientDropdown();
    showSaveStatus('Client history deleted');
}



/* ============================================
   CALCULATIONS
   ============================================ */
function calculateBaseAmount(item) {
    if (item.type === 'team-member') {
        return item.hourlyRate ? item.hourlyRate * item.hours : 0;
    } else if (item.type === 'hourly-product') {
        return calculateHourlyProductBaseAmount(item);
    } else if (item.type === 'flat-product') {
        return item.price ? item.price : 0;
    }
    return 0;
}

function calculateHourlyProductBaseAmount(item) {
    if (!item.teamMembers || item.teamMembers.length === 0) return 0;
    return item.teamMembers.reduce((sum, member) => {
        return sum + (member.hourlyRate ? member.hourlyRate * member.hours : 0);
    }, 0);
}

function calculateMarkupAmount(item) {
    if (item.type === 'flat-product') return 0;
    const base = calculateBaseAmount(item);
    const markupPercent = state.globalMarkupPercent / 100;
    return base * markupPercent;
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

/* ============================================
   INHERITANCE HELPERS
   ============================================ */
function getInheritedItemNames(tierName) {
    let names = [];
    if (tierName === 'Better') {
        const goodPkg = state.packages.find(p => p.name === 'Good');
        if (goodPkg) {
            names = goodPkg.items.map(i => i.name || 'Untitled');
        }
    } else if (tierName === 'Best') {
        const goodPkg = state.packages.find(p => p.name === 'Good');
        const betterPkg = state.packages.find(p => p.name === 'Better');
        if (goodPkg) {
            names.push(...goodPkg.items.map(i => i.name || 'Untitled'));
        }
        if (betterPkg) {
            names.push(...betterPkg.items.map(i => i.name || 'Untitled'));
        }
    }
    return names;
}

function updateInheritedItemsDisplay() {
    state.packages.forEach(pkg => {
        if (pkg.name === 'Better' || pkg.name === 'Best') {
            const tierClass = pkg.name.toLowerCase();
            const packageEl = document.querySelector(`.tier-${tierClass}`);
            if (packageEl) {
                const inheritedEl = packageEl.querySelector('.inherited-items');
                const inheritedItems = getInheritedItemNames(pkg.name);
                
                if (inheritedItems.length > 0) {
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
            }
        }
    });
}

function updateEmptyStates() {
    state.packages.forEach(pkg => {
        const tierClass = pkg.name.toLowerCase();
        const packageEl = document.querySelector(`.tier-${tierClass}`);
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

/* ============================================
   PACKAGE CRUD
   ============================================ */
function addPackage() {
    const name = prompt('Enter package name (e.g., Premium, Deluxe):');
    if (name && name.trim()) {
        saveToHistory();
        state.packages.push({
            id: state.nextPackageId++,
            name: name.trim(),
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
            newItem.teamMembers = [];
        }
        pkg.items.push(newItem);
        renderItemsForPackage(packageId);
        updateEmptyStates();
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
            }

            // Update header display for flat products
            if (item.type === 'flat-product' && field === 'name') {
                const summary = document.querySelector(`[data-flat-id="${itemId}"] .collapsible-summary`);
                if (summary) summary.textContent = value || 'Untitled Product';
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
   NESTED TEAM MEMBER CRUD
   ============================================ */
function addNestedTeamMember(packageId, itemId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item) {
            saveToHistory();
            if (!item.teamMembers) item.teamMembers = [];
            item.teamMembers.push({
                id: state.nextNestedMemberId++,
                name: '',
                hourlyRate: 0,
                hours: 0
            });
            renderNestedMembersForItem(packageId, itemId);
            updateAllCalculations();
            debouncedSave();
        }
    }
}

function updateNestedTeamMember(packageId, itemId, memberId, field, value) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item && item.teamMembers) {
            const member = item.teamMembers.find(m => m.id === memberId);
            if (member) {
                if (member[field] !== value) {
                    saveToHistory();
                }
                member[field] = value;
                updateAllCalculations();
                debouncedSave();
            }
        }
    }
}

function removeNestedTeamMember(packageId, itemId, memberId) {
    const pkg = findPackage(packageId);
    if (pkg) {
        const item = pkg.items.find(i => i.id === itemId);
        if (item && item.teamMembers) {
            saveToHistory();
            item.teamMembers = item.teamMembers.filter(m => m.id !== memberId);
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
            container.innerHTML = '';
            if (item && item.teamMembers && item.teamMembers.length > 0) {
                item.teamMembers.forEach(member => {
                    container.appendChild(createNestedTeamMemberElement(packageId, itemId, member));
                });
            }
        }
    }
}

/* ============================================
   ELEMENT CREATORS
   ============================================ */
function createPackageElement(pkg, index) {
    const div = document.createElement('div');
    const tierClass = pkg.name.toLowerCase();
    div.className = `package tier-${tierClass}`;
    div.setAttribute('role', 'listitem');
    div.setAttribute('aria-label', `${pkg.name} pricing tier`);

    let tierHint = '';
    if (pkg.name === 'Better') tierHint = '(includes Good)';
    if (pkg.name === 'Best') tierHint = '(includes Good + Better)';

    const emptyStateHtml = pkg.items.length === 0 
        ? `<div class="empty-state" role="status">No deliverables yet. Add a flat-rate or hourly item above.</div>` 
        : '';

    div.innerHTML = `
        <header class="package-header">
            <h3 class="package-title">${pkg.name}<span class="tier-hint">${tierHint}</span></h3>
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
    if (nestedContainer && item.teamMembers && item.teamMembers.length > 0) {
        item.teamMembers.forEach(member => {
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

    const base = member.hourlyRate ? member.hourlyRate * member.hours : 0;
    const markup = calculateMarkupAmount({
        type: 'team-member',
        hourlyRate: member.hourlyRate,
        hours: member.hours
    });
    const memberName = member.name || 'Unnamed element';

    div.innerHTML = `
        <div class="nested-team-member-fields">
            <div class="form-group">
                <label for="member-name-${member.id}">Name</label>
                <input type="text" id="member-name-${member.id}" placeholder="e.g., Developer" value="${member.name}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="name">
            </div>
            <div class="form-group">
                <label for="member-rate-${member.id}">Rate /hr</label>
                <div class="input-with-suffix">
                    <input type="number" id="member-rate-${member.id}" placeholder="100" min="0" step="1" value="${member.hourlyRate}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="hourlyRate" style="padding-left: 24px;">
                    <span class="input-suffix" style="left: 12px; right: auto;">$</span>
                </div>
            </div>
            <div class="form-group">
                <label for="member-hours-${member.id}">Hours</label>
                <input type="number" id="member-hours-${member.id}" placeholder="40" min="0" step="0.25" value="${member.hours}" class="nested-member-input" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" data-field="hours">
            </div>
        </div>

        <div class="nested-member-footer">
            <div class="nested-member-summary" aria-live="polite">
                Base: $${base.toFixed(2)} | Markup: $${markup.toFixed(2)} | Total: $${(base + markup).toFixed(2)}
            </div>
            <button class="btn-remove-nested-member" data-package-id="${packageId}" data-item-id="${itemId}" data-member-id="${member.id}" aria-label="Remove ${memberName}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove
            </button>
        </div>
    `;

    return div;
}

/* ============================================
   CALCULATIONS UPDATE
   ============================================ */
function updateAllCalculations() {
    state.globalMarkupPercent = parseFloat(document.getElementById('globalMarkup').value) || 0;

    state.packages.forEach(pkg => {
        let baseTotal = 0;
        let markupTotal = 0;

        pkg.items.forEach(item => {
            const base = calculateBaseAmount(item);
            const markup = calculateMarkupAmount(item);
            baseTotal += base;
            markupTotal += markup;

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

        // Add items from previous tiers for Better and Best
        if (pkg.name === 'Better') {
            const goodPkg = state.packages.find(p => p.name === 'Good');
            if (goodPkg) {
                goodPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
            }
        } else if (pkg.name === 'Best') {
            const goodPkg = state.packages.find(p => p.name === 'Good');
            const betterPkg = state.packages.find(p => p.name === 'Better');
            if (goodPkg) {
                goodPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
            }
            if (betterPkg) {
                betterPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
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
    
    state.packages.forEach(pkg => {
        let baseTotal = 0;
        let markupTotal = 0;

        pkg.items.forEach(item => {
            baseTotal += calculateBaseAmount(item);
            markupTotal += calculateMarkupAmount(item);
        });

        // Add previous tiers for Better and Best
        if (pkg.name === 'Better') {
            const goodPkg = state.packages.find(p => p.name === 'Good');
            if (goodPkg) {
                goodPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
            }
        } else if (pkg.name === 'Best') {
            const goodPkg = state.packages.find(p => p.name === 'Good');
            const betterPkg = state.packages.find(p => p.name === 'Better');
            if (goodPkg) {
                goodPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
            }
            if (betterPkg) {
                betterPkg.items.forEach(item => {
                    baseTotal += calculateBaseAmount(item);
                    markupTotal += calculateMarkupAmount(item);
                });
            }
        }

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

    state.packages.forEach(pkg => {
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
                    `Container for package elements (${item.teamMembers?.length || 0} elements)`
                ]);
            }
        });
    });

    rows.push([]);

    // Package elements section
    rows.push(['=== PACKAGE ELEMENTS (Nested) ===']);
    rows.push(['Package', 'Parent Item', 'Element Name', 'Hourly Rate', 'Hours', 'Base Amount', 'Markup %', 'Markup Amount', 'Final Amount', 'Calculation']);

    state.packages.forEach(pkg => {
        pkg.items.forEach(item => {
            if (item.type === 'hourly-product' && item.teamMembers && item.teamMembers.length > 0) {
                item.teamMembers.forEach(member => {
                    const base = member.hourlyRate ? member.hourlyRate * member.hours : 0;
                    const markup = calculateMarkupAmount({
                        type: 'team-member',
                        hourlyRate: member.hourlyRate,
                        hours: member.hours
                    });
                    const final = base + markup;

                    rows.push([
                        pkg.name,
                        item.name || 'Untitled',
                        member.name || 'Unnamed',
                        formatCurrency(member.hourlyRate),
                        member.hours.toFixed(2),
                        formatCurrency(base),
                        state.globalMarkupPercent + '%',
                        formatCurrency(markup),
                        formatCurrency(final),
                        `${formatCurrency(member.hourlyRate)}/hr × ${member.hours.toFixed(2)} hrs = ${formatCurrency(base)} + ${state.globalMarkupPercent}% markup`
                    ]);
                });
            }
        });
    });

    rows.push([]);

    // Notes section
    rows.push(['=== DELIVERABLE NOTES ===']);
    rows.push(['Package', 'Deliverable', 'Notes']);

    state.packages.forEach(pkg => {
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
    ['Good', 'Better', 'Best'].forEach((tierName, index) => {
        const pkg = state.packages.find(p => p.name === tierName);
        if (!pkg) return;
        
        // Add tier header in uppercase
        lines.push(tierName.toUpperCase());
        
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
        if (index < 2) {
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
    
    // Reset to initial state but keep templates and clients
    state = {
        projectName: '',
        packages: [
            { id: 1, name: 'Good', items: [], costBasis: 0 },
            { id: 2, name: 'Better', items: [], costBasis: 0 },
            { id: 3, name: 'Best', items: [], costBasis: 0 }
        ],
        globalMarkupPercent: 20,
        globalShowMargin: true,
        nextPackageId: 4,
        nextItemId: 1,
        nextNestedMemberId: 1,
        templates: savedTemplates,
        clients: savedClients
    };
    
    // Save updated state (preserving templates/clients)
    debouncedSave();
    
    // Update UI
    document.getElementById('projectName').value = '';
    document.getElementById('globalMarkup').value = 20;
    
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
            if (state.nextPackageId === undefined) state.nextPackageId = 4;
            if (state.nextItemId === undefined) state.nextItemId = 1;
            if (state.nextNestedMemberId === undefined) state.nextNestedMemberId = 1;
            if (state.templates === undefined) state.templates = {};
            if (state.clients === undefined) state.clients = {};

            // Ensure all packages have new fields
            state.packages.forEach(pkg => {
                if (pkg.costBasis === undefined) pkg.costBasis = 0;
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
                        if (item.type === 'hourly-product' && !item.teamMembers) item.teamMembers = [];
                        if (item.teamMembers) {
                            item.teamMembers.forEach(member => {
                                if (member.id >= state.nextNestedMemberId) state.nextNestedMemberId = member.id + 1;
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
    state.packages.forEach((pkg, index) => {
        const pkgEl = createPackageElement(pkg, index);
        grid.appendChild(pkgEl);
    });
    
    // Enable drag and drop after rendering
    enableDragAndDrop();
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
