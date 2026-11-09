'use strict';

/*
|--------------------------------------------------------------------------
| SARA VIA — Enterprise Frontend Application
| Pi Network TESTNET Integration
|--------------------------------------------------------------------------
*/

const SaraVia = Object.freeze({
    environment: 'testnet',
    travelType: 'flights',
    piConnected: false,
    piReady: false,
    accessToken: null,
    user: null,
    verifiedUser: null,
    activePayment: null
});

// State Container mutable reference
let appState = {
    ...SaraVia
};


/*
|--------------------------------------------------------------------------
| DOM Helpers & Utilities
|--------------------------------------------------------------------------
*/

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));  function capitalize(value) {     if (!value) return '';     return value.charAt(0).toUpperCase() + value.slice(1); }  function escapeHtml(value) {     return String(value)         .replaceAll('&', '&amp;')         .replaceAll('<', '&lt;')         .replaceAll('>', '&gt;')         .replaceAll('"', '&quot;')         .replaceAll("'", '&#039;'); }  function getErrorMessage(error) {     if (error && typeof error.message === 'string' && error.message.trim()) {         return error.message;     }     return 'Something went wrong. Please try again.'; }   /* \vert{}-------------------------------------------------------------------------- \vert{} Initialization Lifecycle \vert{}-------------------------------------------------------------------------- */  document.addEventListener('DOMContentLoaded', () => {     initializeEnterpriseApp(); });  async function initializeEnterpriseApp() {     try {         setMinimumDate();         initializeTravelTabs();         initializeSearch();         initializeNavigation();         initializePiButton();                  await waitForPiSDK();     } catch (error) {         console.error('[SARA VIA Enterprise] Initialization error:', error);     } }   /* \vert{}-------------------------------------------------------------------------- \vert{} Pi SDK Async Loader \vert{}-------------------------------------------------------------------------- */  async function waitForPiSDK(timeout = 10000) {     const started = Date.now();      while (typeof window.Pi === 'undefined' && Date.now() - started < timeout) {         await new Promise((resolve) => setTimeout(resolve, 100));     }      if (typeof window.Pi === 'undefined') {         console.warn('[SARA VIA Enterprise] Pi SDK unavailable in this environment.');         return false;     }      appState.piReady = true;     console.info('[SARA VIA Enterprise] Pi SDK successfully initialized.');     return true; }   /* \vert{}-------------------------------------------------------------------------- \vert{} UI Components: Travel Tabs & Search Engine \vert{}-------------------------------------------------------------------------- */  function initializeTravelTabs() {     const tabs = Array.from(document.querySelectorAll('.travel-type-tab'));
    if (!tabs.length) return;

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            tabs.forEach((item) => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });

            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            appState.travelType = tab.dataset.travelType || 'flights';
            updateSearchFields(appState.travelType);
        });
    });
}

function updateSearchFields(type) {
    const from = $('#departure');
    const to = $('#destination');
    const departure = $('#travelDate');
    const guests = $('#guests');

    if (!from || !to) return;

    const placeholders = {
        hotels: { from: 'City or destination', to: 'Hotel or area', checkin: 'Check-in date' },
        experiences: { from: 'City or destination', to: 'Experience' },
        cruises: { from: 'Departure port', to: 'Destination port' },
        transport: { from: 'Pickup location', to: 'Drop-off location' },
        flights: { from: 'Origin IATA code (e.g. AMM)', to: 'Destination IATA code (e.g. DXB)', departure: 'Departure date' }
    };

    const currentConfig = placeholders[type] || placeholders.flights;

    from.placeholder = currentConfig.from;
    to.placeholder = currentConfig.to;

    if (departure) {
        departure.setAttribute('aria-label', currentConfig.checkin || currentConfig.departure || 'Date');
    }

    if (guests) {
        guests.setAttribute(
            'aria-label',
            type === 'hotels' ? 'Number of guests' : 'Number of travelers'
        );
    }
}

async function initializeSearch() {
    const form = $('#travelSearchForm');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const origin = $('#departure')?.value.trim() || '';
        const destination = $('#destination')?.value.trim() || '';
        const departureDate = $('#travelDate')?.value || '';
        const adults = Number($('#guests')?.value || 1);
        if (!origin || !destination) return showNotification('Enter an origin and destination.', 'warning');
        const type = appState.travelType;
        if (type !== 'flights') {
            return showNotification('Live inventory for this category is not connected yet. Configure its provider before accepting bookings.', 'warning');
        }
        const button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        try {
            const response = await fetch('/api/travel/flights/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin, destination, departureDate, adults }) });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.error || 'Flight search failed.');
            const status = $('#piStatus');
            if (status) status.textContent = payload.results.length ? JSON.stringify(payload.results, null, 2) : 'No flights returned by the configured provider.';
            showNotification(payload.results.length + ' provider flight offers retrieved.', 'success');
        } catch (error) { showNotification(getErrorMessage(error), 'error'); }
        finally { if (button) button.disabled = false; }
    });
}


/*
|--------------------------------------------------------------------------
| Enterprise Authentication Engine (Pi Network)
|--------------------------------------------------------------------------
*/

async function connectPi() {
    const button = $('#connectPiButton');

    if (typeof window.Pi === 'undefined') {
        showNotification('Pi Browser is required for Pi authentication.', 'warning');
        return { success: false, error: 'Pi SDK missing' };
    }

    setPiButtonLoading(true);

    try {
        const scopes = ['username', 'payments'];
        const authResult = await window.Pi.authenticate(scopes, onIncompletePaymentFound);

        if (!authResult || !authResult.accessToken) {
            throw new Error('Pi authentication protocol failed to yield access token.');
        }

        const verification = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authResult.accessToken}` } });
        const verified = await verification.json();
        if (!verification.ok || !verified.authenticated || !verified.user) throw new Error('Pi account could not be verified by SARA VIA server.');
        appState.accessToken = authResult.accessToken;
        appState.user = authResult.user || null;
        appState.verifiedUser = verified.user;
        appState.piConnected = true;

        updatePiButton();
        showNotification(`Welcome aboard, ${appState.verifiedUser.username || 'Traveler'}.`, 'success');
        
        console.info('[SARA VIA Enterprise] Authentication established:', appState.verifiedUser);
        return { success: true, user: appState.verifiedUser };

    } catch (error) {
        console.error('[SARA VIA Enterprise] Auth exception:', error);
        appState.piConnected = false;
        showNotification(getErrorMessage(error), 'error');
        return { success: false, error: getErrorMessage(error) };
    } finally {
        setPiButtonLoading(false);
    }
}

async function onIncompletePaymentFound(payment) {
    const paymentId = payment?.identifier || payment?.paymentId;
    const txid = payment?.transaction?.txid;
    if (!paymentId || !txid) { console.warn('[SARA VIA] Incomplete payment requires manual review.', payment); return; }
    const response = await fetch('/api/payments/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId, txid }) });
    const result = await response.json();
    if (!response.ok || !result.success || !result.completed) throw new Error(result.error || 'Incomplete payment recovery failed.');
    showNotification('An interrupted Pi payment was verified and recovered.', 'success');
}


/*
|--------------------------------------------------------------------------
| Enterprise Transaction Engine (Pi Payments - Testnet Sandbox)
|--------------------------------------------------------------------------
*/

async function createPiPayment({ amount, memo, metadata = {} }) {
    if (typeof window.Pi === 'undefined') {
        throw new Error('Pi SDK is unavailable in current runtime.');
    }

    if (!appState.piConnected) {
        const authResponse = await connectPi();
        if (!authResponse.success) {
            throw new Error('Authentication required prior to transaction execution.');
        }
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Invalid monetary value designated for transaction.');
    }

    return new Promise((resolve, reject) => {
        try {
            window.Pi.createPayment(
                {
                    amount,
                    memo: memo || 'SARA VIA Luxury Travel Execution',
                    metadata: {
                        app: 'SARA VIA',
                        environment: 'enterprise-testnet',
                        timestamp: Date.now(),
                        ...metadata
                    }
                },
                {
                    onReadyForServerApproval: async (paymentId) => {
                        console.info('[SARA VIA Enterprise] Phase 1 - Approval Hook Triggered:', paymentId);
                        
                        const response = await fetch('/api/payments/approve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${appState.accessToken}` },
                            body: JSON.stringify({ paymentId })
                        });
                        const payload = await response.json();
                        if (!response.ok || !payload.success || !payload.approved) throw new Error(payload.error || 'Server-side Pi approval failed.');
                    },

                    onReadyForServerCompletion: async (paymentId, txid) => {
                        try {
                            const response = await fetch('/api/payments/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId, txid }) });
                            const payload = await response.json();
                            if (!response.ok || !payload.success || !payload.completed) throw new Error(payload.error || 'Server-side Pi completion failed.');
                            const transactionResult = { paymentId, txid, success: true, timestamp: new Date().toISOString(), verifiedByServer: true };
                            appState.activePayment = transactionResult;
                            showNotification('Pi payment verified and completed by the server.', 'success');
                            resolve(transactionResult);
                        } catch (error) { showNotification(getErrorMessage(error), 'error'); reject(error); }
                    },

                    onCancel: (paymentId) => {
                        console.warn('[SARA VIA Enterprise] Transaction aborted by user:', paymentId);
                        showNotification('Payment session terminated by user.', 'info');
                        reject(new Error('User cancellation.'));
                    },

                    onError: (error) => {
                        console.error('[SARA VIA Enterprise] Critical payment fault:', error);
                        reject(error instanceof Error ? error : new Error('Pi payment gateway failure.'));
                    }
                }
            );
        } catch (initializationError) {
            reject(initializationError);
        }
    });
}


/*
|--------------------------------------------------------------------------
| UI Renderers & Event Binding
|--------------------------------------------------------------------------
*/

function initializePiButton() {
    const button = $('#connectPiButton');
    if (!button) return;

    button.addEventListener('click', connectPi);
}

function setPiButtonLoading(isLoading) {
    const button = $('#connectPiButton');
    if (!button) return;

    button.disabled = isLoading;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="pi-icon">π</span><span>Authenticating…</span>';
    } else if (!appState.piConnected) {
        button.innerHTML = '<span class="pi-icon">π</span><span>Connect Pi</span>';
    }
}

function updatePiButton() {
    const button = $('#connectPiButton');
    if (!button) return;

    if (appState.piConnected) {
        const username = appState.verifiedUser?.username;
        button.classList.add('pi-connected');
        button.innerHTML = `<span class="pi-icon">π</span><span>${username ? escapeHtml(username) : 'Connected'}</span>`;
        button.setAttribute('aria-label', 'Pi account securely linked');
    } else {
        button.classList.remove('pi-connected');
        button.innerHTML = '<span class="pi-icon">π</span><span>Connect Pi</span>';
    }
}

function initializeNavigation() {
    $$('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', (event) => {
            const targetId = link.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const target = document.querySelector(targetId);
            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function setMinimumDate() {
    const input = $('#travelDate');
    if (!input) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    input.min = `${year}-${month}-${day}`;
}


/*
|--------------------------------------------------------------------------
| Enterprise Notification System
|--------------------------------------------------------------------------
*/

function showNotification(message, type = 'info') {
    const container = $('#notificationContainer');
    if (!container) {
        console.info(`[SARA VIA Notification - ${type.toUpperCase()}]: ${message}`);
        return;
    }

    const notification = document.createElement('div');
    notification.className = `sara-notification ${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${notificationIcon(type)}</span>
        <span class="notification-message">${escapeHtml(message)}</span>
        <button type="button" class="notification-close" aria-label="Dismiss">×</button>
    `;

    container.appendChild(notification);

    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => dismissNotification(notification));
    }

    requestAnimationFrame(() => notification.classList.add('visible'));

    setTimeout(() => dismissNotification(notification), 6000);
}

function dismissNotification(notification) {
    if (!notification) return;
    notification.classList.remove('visible');
    setTimeout(() => notification.remove(), 300);
}

function notificationIcon(type) {
    switch (type) {
        case 'success': return '✓';
        case 'error': return '✕';
        case 'warning': return '⚠';
        default: return 'ℹ';
    }
}


/*
|--------------------------------------------------------------------------
| Global Namespace Exports (Enterprise Exposure)
|--------------------------------------------------------------------------
*/

window.SaraVia = appState;
window.connectPi = connectPi;
window.createPiPayment = createPiPayment;
