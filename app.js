// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC5zP-voHzrdOxhCzwxoRbUGjcRFNK5cFM",
  authDomain: "invoice-b736b.firebaseapp.com",
  projectId: "invoice-b736b",
  storageBucket: "invoice-b736b.firebasestorage.app",
  messagingSenderId: "1020406824152",
  appId: "1:1020406824152:web:ef195ba58598b1a4d56bad",
  measurementId: "G-GGZWQQ55LD"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Optimized device detection
const isMobile = () => window.innerWidth <= 768;
const isLocal = window.location.protocol === 'file:' || 
                window.location.hostname === 'localhost' || 
                window.location.hostname.endsWith('.local');

// Path configurations
const PDF_BASE_PATH = isLocal ? "L:/Files/INVOICE/" : null;
const SRV_BASE_PATH = isLocal ? "L:/Files/SRV/" : null;

// Site WhatsApp numbers mapping
const SITE_WHATSAPP_NUMBERS = {
    '169': '50992040', '174': '50992040', '175': '50992040', 
    '176': '50992067', '166': '50992049', '161': '50992040',
    'M161': '50992040', 'M17': '50992049', '168': '39937600',
    '1061': '39964504', '1009': '50992083', '100': '50992023',
    '173': '39937600', 'M28': '50485111', '180': '50999203',
    '144': '50485111', '129': '50992083', '137.19': '50485111',
    '122': '50707183'
};

// Application state
let records = [];
let activeFilter = 'all';
let currentYear = '2025';
let currentFilteredRecords = null;
let statusPieChart = null;
let statusBarChart = null;

// DOM Cache
const domCache = {
    mobileMenu: null,
    siteSearchTerm: null,
    searchTerm: null,
    releaseDateFilter: null,
    pettyCashSearchTerm: null,
    reportSearchTerm: null,
    reportType: null,
    reportStatusFilter: null,
    connectBtn: null,
    statusIndicator: null,
    connectionStatus: null,
    fileInfo: null,
    recordsTable: null,
    siteRecordsTable: null,
    reportTable: null,
    pettyCashTable: null,
    loadingOverlay: null,
    authMessage: null,
    uploadStatus: null,
    manageStatus: null,
    logoutBtn: null,
    loginSection: null
};

// Initialize DOM cache
function cacheDOM() {
    const elements = [
        'mobileMenu', 'siteSearchTerm', 'searchTerm', 'releaseDateFilter',
        'pettyCashSearchTerm', 'reportSearchTerm', 'reportType', 
        'reportStatusFilter', 'connectBtn', 'statusIndicator',
        'connectionStatus', 'fileInfo', 'recordsTable', 'siteRecordsTable',
        'reportTable', 'pettyCashTable', 'loadingOverlay', 'authMessage',
        'uploadStatus', 'manageStatus', 'loginSection'
    ];
    
    elements.forEach(id => {
        domCache[id] = document.getElementById(id);
    });
    
    // Create logout button if it doesn't exist
    if (!document.getElementById('logoutBtn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.className = 'btn btn-danger';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> <span class="btn-text">Logout</span>';
        logoutBtn.onclick = logout;
        logoutBtn.style.display = 'none';
        document.querySelector('.section-header').appendChild(logoutBtn);
        domCache.logoutBtn = logoutBtn;
    }
}

// Mobile menu functions
function toggleMobileMenu() {
    domCache.mobileMenu.classList.toggle('show');
    document.body.style.overflow = domCache.mobileMenu.classList.contains('show') ? 'hidden' : '';
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    domCache.mobileMenu.classList.remove('show');
    document.body.style.overflow = '';
    
    // Update suggestions based on section
    if (sectionId === 'pettyCashSection') updateNoteSuggestions();
    if (sectionId === 'statementSection') {
        updateVendorSuggestions();
        updateSiteSuggestions();
    }
    if (sectionId === 'mainPageSection') searchSiteRecords();
    
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.classList.contains('main-page') && sectionId === 'mainPageSection') {
            item.classList.add('active');
        } else if (item.textContent.includes('Invoice Status') && sectionId === 'invoiceSection') {
            item.classList.add('active');
        } else if (item.textContent.includes('Statement') && sectionId === 'statementSection') {
            item.classList.add('active');
        } else if (item.textContent.includes('Petty Cash') && sectionId === 'pettyCashSection') {
            item.classList.add('active');
        } else if (item.classList.contains('admin') && sectionId === 'dataManagementSection') {
            item.classList.add('active');
        }
    });
}

// Authentication functions
function login() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    if (!email || !password) {
        domCache.authMessage.textContent = 'Please enter both email and password';
        return;
    }
    
    showLoading();
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            hideLoading();
            domCache.authMessage.textContent = '';
            domCache.logoutBtn.style.display = 'block';
            showSection('mainPageSection');
            loadFromFirebase();
        })
        .catch((error) => {
            hideLoading();
            domCache.authMessage.textContent = error.message;
        });
}

function logout() {
    auth.signOut().then(() => {
        records = [];
        domCache.logoutBtn.style.display = 'none';
        showSection('loginSection');
        updateConnectionStatus(false);
    });
}

// Data loading functions
function loadFromFirebase() {
    showLoading();
    
    database.ref(`records/${currentYear}`).once('value')
        .then((snapshot) => {
            const data = snapshot.val();
            records = data ? migrateStatus(Object.values(data)) : [];
            
            updateNoteSuggestions();
            updateVendorSuggestions();
            updateSiteSuggestions();
            updateUI();
            updateConnectionStatus(true);
        })
        .catch((error) => {
            console.error('Error loading data:', error);
            updateConnectionStatus(false);
        })
        .finally(hideLoading);
}

function updateConnectionStatus(connected) {
    if (connected) {
        domCache.statusIndicator.className = 'status-indicator connected';
        domCache.connectionStatus.textContent = `Connected to: Firebase (${currentYear})`;
        domCache.connectBtn.innerHTML = `<i class="fas fa-sync-alt"></i> <span class="btn-text">Data Updated (${currentYear})</span>`;
    } else {
        domCache.statusIndicator.className = 'status-indicator disconnected';
        domCache.connectionStatus.textContent = 'Not connected to data source';
        domCache.connectBtn.innerHTML = `<i class="fas fa-sync-alt"></i> <span class="btn-text">Refresh Data</span>`;
    }
    
    updateFileInfo();
}

// Data processing
function processCSVData(data) {
    return data.map(item => ({
        entryDate: item['Entered Date'] || new Date().toISOString().split('T')[0],
        site: item['Site'] || '',
        poNumber: item['PO Number'] || '',
        poValue: item['PO Value'] || '',
        vendor: item['Vendor'] || '',
        invoiceNumber: item['Invoice Number'] || '',
        value: item['Value'] || '',
        details: item['Details'] || '',
        releaseDate: item['Release Date'] || '',
        status: item['Status'] || 'For SRV',
        fileName: item['FileName'] || '',
        note: item['Note'] || item['Notes'] || item['Description'] || '',
        lastUpdated: new Date().toISOString()
    }));
}

function migrateStatus(records) {
    return records.map(record => {
        if (record.status === 'Under Process') {
            record.status = 'CEO Approval';
        }
        return record;
    });
}

// Table functions
function refreshTable(filteredRecords = null) {
    const tableBody = document.querySelector('#recordsTable tbody');
    tableBody.innerHTML = '';
    
    const displayRecords = filteredRecords || records;
    currentFilteredRecords = displayRecords;
    
    if (displayRecords.length === 0) {
        domCache.recordsTable.style.display = 'none';
        return;
    }
    
    domCache.recordsTable.style.display = 'table';
    
    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();
    
    displayRecords.forEach((record, index) => {
        const percentage = getStatusPercentage(record.status);
        const currentStep = getCurrentStep(record.status);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formatDate(record.entryDate)}</td>
            <td>${record.site || '-'}</td>
            <td>${record.poNumber || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td class="status-cell">
                <div class="step-progress-container">
                    <div class="step-progress" data-percentage="${percentage}">
                        ${generateStepProgress(currentStep)}
                    </div>
                    <div class="step-labels">
                        <span class="step-label">SRV</span>
                        <span class="step-label">IPC/Report</span>
                        <span class="step-label">Review</span>
                        <span class="step-label">CEO</span>
                        <span class="step-label">Accounts</span>
                    </div>
                    <div class="status-tooltip">${record.status} - ${percentage}%</div>
                </div>
            </td>
            <td class="action-btns">
                <button class="btn btn-inv ${!record.fileName ? 'disabled' : ''}" 
                    onclick="viewPDF('${record.fileName || ''}')" 
                    ${!record.fileName ? 'disabled' : ''}>
                    <i class="fas fa-file-pdf"></i> INV
                </button>
                <button class="btn btn-srv ${!record.details ? 'disabled' : ''}" 
                    onclick="viewSRV('${record.details || ''}')" 
                    ${!record.details ? 'disabled' : ''}>
                    <i class="fas fa-file-alt"></i> SRV
                </button>
            </td>
        `;
        
        row.addEventListener('click', function(e) {
            if (!e.target.closest('.action-btns')) {
                showInvoicePreview(record);
            }
        });
        
        fragment.appendChild(row);
    });
    
    tableBody.appendChild(fragment);
    setupResponsiveElements();
}

function generateStepProgress(currentStep) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        const activeClass = i < currentStep ? 'active' : '';
        const currentClass = i === currentStep ? 'current' : '';
        html += `<div class="step step-${i} ${activeClass} ${currentClass}"></div>`;
        if (i < 5) {
            const connectorActive = i < currentStep - 1 ? 'active' : '';
            html += `<div class="step-connector ${connectorActive}"></div>`;
        }
    }
    return html;
}

function getCurrentStep(status) {
    const statusSteps = {
        'Open': 0,
        'For SRV': 1,
        'For IPC': 2,
        'No Invoice': 2,
        'Report': 2,
        'Under Review': 3,
        'CEO Approval': 4,
        'With Accounts': 5
    };
    return statusSteps[status] || 0;
}

function getStatusPercentage(status) {
    const statusProgress = {
        'Open': 0,
        'For SRV': 10,
        'For IPC': 25,
        'No Invoice': 25,
        'Report': 25,
        'Under Review': 50,
        'CEO Approval': 75,
        'With Accounts': 100
    };
    return statusProgress[status] || 0;
}

// Main Dashboard Functions
function initializeCharts(filteredRecords = null) {
    const displayRecords = filteredRecords || records.filter(record => record.status !== 'With Accounts');
    
    // Prepare data for charts
    const statusCounts = {};
    displayRecords.forEach(record => {
        statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;
    });
    
    const statusLabels = Object.keys(statusCounts);
    const statusData = Object.values(statusCounts);
    const backgroundColors = statusLabels.map(status => ({
        'For SRV': '#4e73df', 'For IPC': '#1cc88a', 'Under Review': '#36b9cc',
        'CEO Approval': '#f6c23e', 'Open': '#e74a3b', 'Pending': '#858796',
        'Report': '#5a5c69', 'No Invoice': '#2c3e50'
    }[status]) || '#cccccc');
    
    // Destroy existing charts if they exist
    if (statusPieChart) statusPieChart.destroy();
    if (statusBarChart) statusBarChart.destroy();
    
    // Create new charts
    statusPieChart = createPieChart(statusLabels, statusData, backgroundColors);
    statusBarChart = createBarChart(statusLabels, statusData, backgroundColors);
}

function createPieChart(labels, data, colors) {
    const pieCtx = document.getElementById('statusPieChart').getContext('2d');
    return new Chart(pieCtx, {
        type: 'pie',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 1 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Invoice Status Distribution', font: { size: 16 } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    filterSiteRecords(labels[elements[0].index]);
                }
            }
        }
    });
}

function createBarChart(labels, data, colors) {
    const barCtx = document.getElementById('statusBarChart').getContext('2d');
    return new Chart(barCtx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Count', data, backgroundColor: colors, borderWidth: 1 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Invoice Status Count', font: { size: 16 } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label || ''}: ${context.raw || 0}`;
                        }
                    }
                }
            },
            onClick: function(evt, elements) {
                if (elements.length > 0) {
                    filterSiteRecords(labels[elements[0].index]);
                }
            }
        }
    });
}

// Search and filter functions
function searchRecords() {
    const term = domCache.searchTerm.value.toLowerCase();
    const releaseDateInput = domCache.releaseDateFilter.value;
    
    let filtered = records;
    
    if (term) {
        filtered = filtered.filter(record => 
            (record.site && record.site.toLowerCase().includes(term)) ||
            (record.poNumber && record.poNumber.toLowerCase().includes(term)) ||
            (record.vendor && record.vendor.toLowerCase().includes(term)) ||
            (record.invoiceNumber && record.invoiceNumber.toLowerCase().includes(term)) ||
            (record.details && record.details.toLowerCase().includes(term)) ||
            (record.fileName && record.fileName.toLowerCase().includes(term)) ||
            (record.note && record.note.toLowerCase().includes(term))
        );
    }
    
    if (activeFilter !== 'all') {
        filtered = filtered.filter(record => record.status === activeFilter);
    }
    
    if (releaseDateInput) {
        const filterDate = new Date(releaseDateInput);
        filtered = filtered.filter(record => {
            if (!record.releaseDate) return false;
            return new Date(record.releaseDate).toDateString() === filterDate.toDateString();
        });
    }
    
    refreshTable(filtered);
}

function filterRecords(status) {
    activeFilter = status === 'all' ? 'all' : status;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === (status === 'all' ? 'All' : status)) {
            btn.classList.add('active');
        }
    });
    
    if (document.getElementById('mainPageSection').classList.contains('active')) {
        let filtered = records.filter(record => record.status !== 'With Accounts');
        if (status !== 'all') filtered = filtered.filter(record => record.status === status);
        refreshSiteTable(filtered);
    } else {
        searchRecords();
    }
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatNumber(value) {
    return parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getStatusClass(status) {
    const statusClasses = {
        'For SRV': 'status-srv', 'Report': 'status-report', 'Under Review': 'status-review',
        'Pending': 'status-pending', 'With Accounts': 'status-accounts', 'CEO Approval': 'status-process',
        'For IPC': 'status-ipc', 'NO Invoice': 'status-Invoice', 'Open': 'status-Open'
    };
    return statusClasses[status] || '';
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    cacheDOM();
    
    // Set up event listeners
    domCache.connectBtn.addEventListener('click', loadFromFirebase);
    
    document.querySelectorAll('.mobile-menu input[name="dataSource"]').forEach(radio => {
        radio.addEventListener('change', function() {
            currentYear = this.value;
            loadFromFirebase();
        });
    });
    
    // Set up keyboard event listeners
    const searchInputs = [
        domCache.searchTerm, domCache.reportSearchTerm, 
        domCache.pettyCashSearchTerm, domCache.siteSearchTerm
    ];
    
    searchInputs.forEach(input => {
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (input === domCache.searchTerm) searchRecords();
                    if (input === domCache.reportSearchTerm) generateReport();
                    if (input === domCache.pettyCashSearchTerm) generatePettyCashReport();
                    if (input === domCache.siteSearchTerm) searchSiteRecords();
                }
            });
        }
    });
    
    // Set default year
    document.querySelector('input[value="2025"]').checked = true;
    
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            domCache.logoutBtn.style.display = 'block';
            showSection('mainPageSection');
            loadFromFirebase();
        } else {
            domCache.logoutBtn.style.display = 'none';
            showSection('loginSection');
        }
    });
});

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    if (event.target === document.getElementById('invoicePreviewModal')) {
        closeInvoicePreview();
    }
    if (event.target === document.getElementById('dashboardPreviewModal')) {
        closeDashboardPreview();
    }
});

// Responsive setup
function setupResponsiveElements() {
    const screenWidth = window.innerWidth;
    
    // Reset all hidden columns first
    document.querySelectorAll('#recordsTable th, #recordsTable td, #siteRecordsTable th, #siteRecordsTable td').forEach(el => {
        el.style.display = '';
    });
    
    // Records table responsiveness
    if (screenWidth <= 400) {
        hideTableColumns('#recordsTable', [2, 4, 6, 8]);
    } else if (screenWidth <= 576) {
        hideTableColumns('#recordsTable', [2, 3, 7, 8]);
    } else if (screenWidth <= 768) {
        hideTableColumns('#recordsTable', [2, 3, 7, 8]);
        hideTableColumns('#siteRecordsTable', [2, 9]);
    } else if (screenWidth <= 992) {
        hideTableColumns('#recordsTable', [3, 8]);
    }
    
    // Extra small screens
    if (screenWidth <= 480) {
        hideTableColumns('#siteRecordsTable', [4, 5, 6]);
    }
}

function hideTableColumns(tableSelector, columns) {
    columns.forEach(col => {
        document.querySelectorAll(`${tableSelector} th:nth-child(${col}), ${tableSelector} td:nth-child(${col})`).forEach(el => {
            el.style.display = 'none';
        });
    });
}

// Loading overlay functions
function showLoading() {
    document.body.style.overflow = 'hidden';
    domCache.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    document.body.style.overflow = '';
    domCache.loadingOverlay.style.display = 'none';
}

// View PDF/SRV functions
function viewPDF(fileName) {
    if (!fileName) {
        alert("No PDF file linked to this record.");
        return;
    }
    if (isLocal) window.open(`${PDF_BASE_PATH}${fileName}`);
    else alert("Invoice files are only accessible when using the system on the local network.");
}

function viewSRV(fileName) {
    if (!fileName) {
        alert("No SRV file linked to this record.");
        return;
    }
    if (isLocal) window.open(`${SRV_BASE_PATH}${fileName}`);
    else alert("SRV files are only accessible when using the system on the local network.");
}

// Suggestions functionality
function updateNoteSuggestions() {
    updateSuggestions('noteSuggestions', records, 'note');
}

function updateVendorSuggestions() {
    updateSuggestions('vendorSuggestions', records, 'vendor');
}

function updateSiteSuggestions() {
    updateSuggestions('siteSuggestions', records, 'site');
    updateSuggestions('siteSuggestionsMain', records, 'site');
}

function updateSuggestions(elementId, data, field) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = '';
    
    const allValues = data
        .filter(record => record[field] && record[field].trim() !== '')
        .map(record => record[field].trim());
    
    [...new Set(allValues)].sort().forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        element.appendChild(option);
    });
}

// Main Dashboard Functions
function searchSiteRecords() {
    const term = domCache.siteSearchTerm.value.toLowerCase();
    let filtered = records.filter(record => record.status !== 'With Accounts');
    
    if (term) {
        filtered = filtered.filter(record => 
            record.site && record.site.toLowerCase().includes(term)
        );
    }
    
    currentFilteredRecords = filtered;
    refreshSiteTable(filtered);
    initializeCharts(filtered);
}

function filterSiteRecords(status) {
    const term = domCache.siteSearchTerm.value.toLowerCase();
    let filtered = records.filter(record => record.status !== 'With Accounts');
    
    if (term) {
        filtered = filtered.filter(record => 
            record.site && record.site.toLowerCase().includes(term)
        );
    }
    
    if (status !== 'all') {
        filtered = filtered.filter(record => record.status === status);
    }
    
    refreshSiteTable(filtered);
}

function refreshSiteTable(filteredRecords = null) {
    const tableBody = document.querySelector('#siteRecordsTable tbody');
    tableBody.innerHTML = '';
    
    const displayRecords = filteredRecords || records.filter(record => record.status !== 'With Accounts');
    currentFilteredRecords = displayRecords;
    
    if (displayRecords.length === 0) {
        domCache.siteRecordsTable.style.display = 'none';
        return;
    }
    
    domCache.siteRecordsTable.style.display = 'table';
    
    const fragment = document.createDocumentFragment();
    
    displayRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td>${record.site || '-'}</td>
            <td>${record.poNumber || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
            <td>${record.note || '-'}</td>
        `;
        
        row.addEventListener('click', () => showDashboardRecordPreview(record));
        fragment.appendChild(row);
    });
    
    tableBody.appendChild(fragment);
    setupResponsiveElements();
}

// Preview Modal Functions
function showDashboardRecordPreview(record) {
    const modal = document.getElementById('dashboardPreviewModal');
    const fields = {
        'dashboardPreviewPoNumber': record.poNumber || '-',
        'dashboardPreviewInvoiceNumber': record.invoiceNumber || '-',
        'dashboardPreviewAmount': record.value ? formatNumber(record.value) : '-',
        'dashboardPreviewStatus': record.status || '-',
        'dashboardPreviewNotes': record.note || '-'
    };
    
    Object.entries(fields).forEach(([id, value]) => {
        document.getElementById(id).textContent = value;
    });
    
    const currentStep = getCurrentStep(record.status);
    updateStepProgress(currentStep, modal);
    
    // Update WhatsApp button
    const whatsappBtn = document.getElementById('dashboardWhatsappReminderBtn');
    whatsappBtn.onclick = () => sendWhatsAppReminder(record, getWhatsAppNumber(record));
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function showInvoicePreview(record) {
    const modal = document.getElementById('invoicePreviewModal');
    const fields = {
        'previewPoNumber': record.poNumber || '-',
        'previewInvoiceNumber': record.invoiceNumber || '-',
        'previewAmount': record.value ? formatNumber(record.value) : '-',
        'previewStatus': record.status || '-',
        'previewNotes': record.note || '-'
    };
    
    Object.entries(fields).forEach(([id, value]) => {
        document.getElementById(id).textContent = value;
    });
    
    const currentStep = getCurrentStep(record.status);
    updateStepProgress(currentStep, modal);
    
    // Update WhatsApp button
    const whatsappBtn = document.getElementById('whatsappReminderBtn');
    whatsappBtn.onclick = () => sendWhatsAppReminder(record, getWhatsAppNumber(record));
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function updateStepProgress(currentStep, modal) {
    modal.querySelectorAll('.step').forEach((step, index) => {
        step.classList.remove('current');
        if (index < currentStep) step.classList.add('active');
        else step.classList.remove('active');
    });
    
    if (currentStep > 0) {
        const currentStepElement = modal.querySelector(`.step-${currentStep}`);
        if (currentStepElement) currentStepElement.classList.add('current');
    }
    
    modal.querySelectorAll('.step-connector').forEach((connector, index) => {
        if (index < currentStep - 1) connector.classList.add('active');
        else connector.classList.remove('active');
    });
}

function getWhatsAppNumber(record) {
    if (!record.site) return '50992023';
    
    for (const [sitePattern, number] of Object.entries(SITE_WHATSAPP_NUMBERS)) {
        if (record.site.includes(sitePattern)) return number;
    }
    
    return '50992023';
}

function closeDashboardPreview() {
    document.getElementById('dashboardPreviewModal').style.display = 'none';
    document.body.style.overflow = '';
}

function closeInvoicePreview() {
    document.getElementById('invoicePreviewModal').style.display = 'none';
    document.body.style.overflow = '';
}

// WhatsApp functions
function sendWhatsAppReminder(record, whatsappNumber) {
    let message = `*Invoice Reminder*\n\n`;
    message += `PO: ${record.poNumber || 'N/A'}\n`;
    message += `Invoice: ${record.invoiceNumber || 'N/A'}\n`;
    message += `Vendor: ${record.vendor || 'N/A'}\n`;
    message += `Amount: ${record.value ? formatNumber(record.value) : 'N/A'}\n`;
    message += `Status: ${record.status || 'N/A'}\n\n`;
    message += `Please provide an update on this invoice.`;
    
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function contactAboutMissingData() {
    const message = `Hi, Irwin.\n\n`;
    window.open(`https://wa.me/+97450992023?text=${encodeURIComponent(message)}`, '_blank');
}

// Report functions
function generateReport() {
    const reportType = domCache.reportType.value;
    const searchTerm = domCache.reportSearchTerm.value.trim();
    const statusFilter = domCache.reportStatusFilter.value;
    
    if (!searchTerm) {
        alert('Please enter a search term');
        return;
    }
    
    let filteredRecords = [];
    let headerText = '';
    
    switch(reportType) {
        case 'po':
            filteredRecords = records.filter(record => 
                record.poNumber && record.poNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `PO: ${filteredRecords[0].poNumber}<br>
                    Vendor: ${filteredRecords[0].vendor || 'N/A'}<br>
                    Site: ${filteredRecords[0].site || 'N/A'}<br>
                    Note: ${filteredRecords[0].note || 'N/A'}`;
            }
            document.getElementById('poTotalContainer').style.display = 'flex';
            break;
            
        case 'vendor':
            filteredRecords = records.filter(record => 
                record.vendor && record.vendor.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `Vendor: ${filteredRecords[0].vendor}<br>
                    Records: ${filteredRecords.length}`;
            }
            document.getElementById('poTotalContainer').style.display = 'none';
            break;
            
        case 'site':
            filteredRecords = records.filter(record => 
                record.site && record.site.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (filteredRecords.length > 0) {
                headerText = `Site: ${filteredRecords[0].site}<br>
                    Records: ${filteredRecords.length}`;
            }
            document.getElementById('poTotalContainer').style.display = 'none';
            break;
    }
    
    if (statusFilter !== 'all') {
        filteredRecords = filteredRecords.filter(record => record.status === statusFilter);
    }
    
    if (filteredRecords.length === 0) {
        alert('No records found matching your search criteria');
        return;
    }
    
    const invoiceTotal = filteredRecords.reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
    const poTotal = reportType === 'po' && filteredRecords.length > 0 ? parseFloat(filteredRecords[0].poValue) || 0 : 0;
    const withAccountsTotal = filteredRecords.filter(record => record.status === 'With Accounts')
        .reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
    const balance = invoiceTotal - withAccountsTotal;
    
    document.getElementById('reportHeader').innerHTML = headerText;
    document.getElementById('poTotal').textContent = formatNumber(poTotal);
    document.getElementById('grandTotal').textContent = formatNumber(invoiceTotal);
    document.getElementById('accountsTotal').textContent = formatNumber(withAccountsTotal);
    document.getElementById('balanceTotal').textContent = formatNumber(balance);
    
    const reportTableBody = document.querySelector('#reportTable tbody');
    reportTableBody.innerHTML = '';
    
    filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.poNumber || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td>${record.invoiceNumber || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td>${record.releaseDate ? formatDate(record.releaseDate) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
        `;
        reportTableBody.appendChild(row);
    });
    
    document.getElementById('reportTotalAmount').textContent = formatNumber(invoiceTotal);
    domCache.reportTable.style.display = 'table';
}

function generatePettyCashReport() {
    const searchTerm = domCache.pettyCashSearchTerm.value.trim();
    
    if (!searchTerm) {
        alert('Please enter a search term for the notes field');
        return;
    }
    
    const filteredRecords = records.filter(record => 
        record.note && record.note.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (filteredRecords.length === 0) {
        alert('No petty cash records found matching your search criteria');
        return;
    }
    
    const totalValue = filteredRecords.reduce((sum, record) => sum + (parseFloat(record.value) || 0), 0);
    
    document.getElementById('pettyCashTotal').textContent = formatNumber(totalValue);
    document.getElementById('pettyCashCount').textContent = filteredRecords.length;
    
    const pettyCashTableBody = document.querySelector('#pettyCashTable tbody');
    pettyCashTableBody.innerHTML = '';
    
    filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${record.poNumber || '-'}</td>
            <td>${record.site || '-'}</td>
            <td>${record.vendor || '-'}</td>
            <td class="numeric">${record.value ? formatNumber(record.value) : '-'}</td>
            <td><span class="status-badge ${getStatusClass(record.status)}">${record.status}</span></td>
        `;
        pettyCashTableBody.appendChild(row);
    });
    
    document.getElementById('pettyCashTableTotal').textContent = formatNumber(totalValue);
    domCache.pettyCashTable.style.display = 'table';
    
    if (isMobile()) {
        document.getElementById('pettyCashSection').scrollIntoView({ behavior: 'smooth' });
    }
}

// Print functions
function printReport() {
    const contentElement = document.getElementById('statementSection');
    const printContent = contentElement.cloneNode(true);
    
    // Remove elements that shouldn't be printed
    printContent.querySelectorAll('.report-controls, .report-actions, .back-btn').forEach(el => el.remove());
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 15px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; border: 1px solid #ddd; }
                th { background-color: #4a6fa5 !important; color: white !important; -webkit-print-color-adjust: exact; }
                .total-row { font-weight: bold; background-color: #e9f7fe; }
                .numeric { text-align: right; }
                @page { size: auto; margin: 5mm; }
                @media print {
                    body { padding: 0; margin: 0; }
                    .financial-summary { page-break-inside: avoid; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            </style>
        </head>
        <body>${printContent.innerHTML}</body>
        </html>
    `);
    printWindow.document.close();
}

function printPettyCashReport() {
    const contentElement = document.getElementById('pettyCashSection');
    const printContent = contentElement.cloneNode(true);
    
    // Remove elements that shouldn't be printed
    printContent.querySelectorAll('.report-controls, .report-actions, .back-btn').forEach(el => el.remove());
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Petty Cash Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 15px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 8px; border: 1px solid #ddd; }
                th { background-color: #4a6fa5 !important; color: white !important; -webkit-print-color-adjust: exact; }
                .total-row { font-weight: bold; background-color: #e9f7fe; }
                .numeric { text-align: right; }
                @page { size: auto; margin: 5mm; }
                @media print {
                    body { padding: 0; margin: 0; }
                    .financial-summary { page-break-inside: avoid; }
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                }
            </style>
        </head>
        <body>${printContent.innerHTML}</body>
        </html>
    `);
    printWindow.document.close();
}

// Data management functions
function uploadCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const year = document.getElementById('uploadYear').value;
    const file = fileInput.files[0];
    
    if (!file) {
        domCache.uploadStatus.textContent = 'Please select a CSV file';
        domCache.uploadStatus.className = 'upload-status error';
        return;
    }
    
    showLoading();
    domCache.uploadStatus.textContent = 'Processing file...';
    domCache.uploadStatus.className = 'upload-status';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        Papa.parse(e.target.result, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data.length === 0) {
                    domCache.uploadStatus.textContent = 'No valid data found in CSV';
                    domCache.uploadStatus.className = 'upload-status error';
                    hideLoading();
                    return;
                }
                
                const processedData = migrateStatus(processCSVData(results.data));
                const recordsObj = {};
                processedData.forEach((record, index) => recordsObj[index] = record);
                
                database.ref(`records/${year}`).set(recordsObj)
                    .then(() => {
                        domCache.uploadStatus.textContent = `Successfully uploaded ${processedData.length} records to Firebase (${year})`;
                        domCache.uploadStatus.className = 'upload-status success';
                        if (currentYear === year) loadFromFirebase();
                    })
                    .catch((error) => {
                        domCache.uploadStatus.textContent = `Error uploading data: ${error.message}`;
                        domCache.uploadStatus.className = 'upload-status error';
                    })
                    .finally(hideLoading);
            },
            error: (error) => {
                domCache.uploadStatus.textContent = `Error parsing CSV: ${error.message}`;
                domCache.uploadStatus.className = 'upload-status error';
                hideLoading();
            }
        });
    };
    reader.readAsText(file);
}

function downloadTemplate() {
    const headers = [
        'Entered Date', 'Site', 'PO Number', 'PO Value', 'Vendor', 
        'Invoice Number', 'Value', 'Details', 'Release Date', 
        'Status', 'FileName', 'Note'
    ].join(',');
    
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearFirebaseData() {
    const year = document.getElementById('manageYear').value;
    
    if (!confirm(`Are you sure you want to clear all ${year} data? This cannot be undone.`)) {
        return;
    }
    
    showLoading();
    domCache.manageStatus.textContent = 'Clearing data...';
    domCache.manageStatus.className = 'upload-status';
    
    database.ref(`records/${year}`).remove()
        .then(() => {
            domCache.manageStatus.textContent = `Successfully cleared ${year} data`;
            domCache.manageStatus.className = 'upload-status success';
            if (currentYear === year) {
                records = [];
                updateUI();
            }
        })
        .catch((error) => {
            domCache.manageStatus.textContent = `Error clearing data: ${error.message}`;
            domCache.manageStatus.className = 'upload-status error';
        })
        .finally(hideLoading);
}

function updateFileInfo() {
    const timestamp = new Date().toLocaleString();
    domCache.fileInfo.innerHTML = `
        <strong>Data Source:</strong> Firebase (${currentYear})<br>
        <strong>Last Updated:</strong> ${timestamp}<br>
        <strong>Records Loaded:</strong> ${records.length}
    `;
}

function updateUI() {
    updateConnectionStatus(true);
    updateFileInfo();
    searchRecords();
}

// Clear functions
function clearSearch() {
    domCache.searchTerm.value = '';
    domCache.releaseDateFilter.value = '';
    activeFilter = 'all';
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === 'All') btn.classList.add('active');
    });
    searchRecords();
}

function clearSiteSearch() {
    domCache.siteSearchTerm.value = '';
    searchSiteRecords();
}

function clearReportSearch() {
    domCache.reportSearchTerm.value = '';
    domCache.reportType.value = 'po';
    domCache.reportStatusFilter.value = 'all';
    document.getElementById('reportHeader').innerHTML = '';
    domCache.reportTable.style.display = 'none';
    document.getElementById('poTotal').textContent = '0.00';
    document.getElementById('grandTotal').textContent = '0.00';
    document.getElementById('accountsTotal').textContent = '0.00';
    document.getElementById('balanceTotal').textContent = '0.00';
    document.querySelector('#reportTable tbody').innerHTML = '';
}

function clearPettyCashSearch() {
    domCache.pettyCashSearchTerm.value = '';
    document.getElementById('pettyCashTotal').textContent = '0.00';
    document.getElementById('pettyCashCount').textContent = '0';
    domCache.pettyCashTable.style.display = 'none';
    document.getElementById('pettyCashTableTotal').textContent = '0.00';
    document.querySelector('#pettyCashTable tbody').innerHTML = '';
}

// Share functions
function shareReportViaWhatsApp() {
    const reportHeader = document.getElementById('reportHeader').textContent;
    const totalAmount = document.getElementById('grandTotal').textContent;
    
    let message = `*Report Summary*\n\n${reportHeader}\n\n`;
    message += `*Total Amount:* ${totalAmount}\n\n`;
    message += `Generated from IBA Trading Invoice Management System`;
    
    window.open(`https://wa.me/+97450992023?text=${encodeURIComponent(message)}`, '_blank');
}

function sharePettyCashViaWhatsApp() {
    const totalAmount = document.getElementById('pettyCashTotal').textContent;
    const recordCount = document.getElementById('pettyCashCount').textContent;
    const searchTerm = domCache.pettyCashSearchTerm.value;
    
    let message = `*Petty Cash Summary*\n\nSearch Term: ${searchTerm}\n`;
    message += `Records Found: ${recordCount}\n`;
    message += `Total Amount: ${totalAmount}\n\n`;
    message += `Generated from IBA Trading Invoice Management System`;
    
    window.open(`https://wa.me/+97450992023?text=${encodeURIComponent(message)}`, '_blank');
}