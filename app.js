'use strict';

/*
|--------------------------------------------------------------------------
| SARA VIA — Frontend Application
| Pi Network TESTNET
|--------------------------------------------------------------------------
*/

const SaraVia = {
    environment: 'testnet',
    travelType: 'flights',
    piConnected: false,
    piReady: false,
    accessToken: null,
    user: null,
    verifiedUser: null,
    activePayment: null
};


/*
|--------------------------------------------------------------------------
| DOM Helpers
|--------------------------------------------------------------------------
*/

function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
}


/*
|--------------------------------------------------------------------------
| Initialization
|--------------------------------------------------------------------------
*/

document.addEventListener('DOMContentLoaded', () => {

    initializeApp();

});


async function initializeApp() {

    setMinimumDate();

    initializeTravelTabs();

    initializeSearch();

    initializeNavigation();

    initializePiButton();

    await waitForPiSDK();

}


/*
|--------------------------------------------------------------------------
| Wait for Pi SDK
|--------------------------------------------------------------------------
*/

async function waitForPiSDK(timeout = 8000) {

    const started = Date.now();

    while (
        typeof window.Pi === 'undefined' &&
        Date.now() - started < timeout
    ) {

        await new Promise(resolve => {
            setTimeout(resolve, 100);
        });

    }

    if (typeof window.Pi === 'undefined') {

        console.warn(
            '[SARA VIA] Pi SDK unavailable.'
        );

        return false;
    }

    SaraVia.piReady = true;

    console.log(
        '[SARA VIA] Pi SDK ready.'
    );

    return true;
}


/*
|--------------------------------------------------------------------------
| Travel Tabs
|--------------------------------------------------------------------------
*/

function initializeTravelTabs() {

    const tabs = $$('.travel-tab');

    tabs.forEach(tab => {

        tab.addEventListener('click', () => {

            tabs.forEach(item => {

                item.classList.remove('active');

                item.setAttribute(
                    'aria-selected',
                    'false'
                );

            });

            tab.classList.add('active');

            tab.setAttribute(
                'aria-selected',
                'true'
            );

            SaraVia.travelType =
                tab.dataset.type || 'flights';

            updateSearchFields(
                SaraVia.travelType
            );

        });

    });

}


/*
|--------------------------------------------------------------------------
| Search Fields
|--------------------------------------------------------------------------
*/

function updateSearchFields(type) {

    const from = $('#from');
    const to = $('#to');
    const departure = $('#departure');
    const guests = $('#guests');

    if (!from || !to) {
        return;
    }

    switch (type) {

        case 'hotels':

            from.placeholder =
                'City or destination';

            to.placeholder =
                'Hotel or area';

            if (departure) {
                departure.setAttribute(
                    'aria-label',
                    'Check-in date'
                );
            }

            break;


        case 'experiences':

            from.placeholder =
                'City or destination';

            to.placeholder =
                'Experience';

            break;


        case 'transport':

            from.placeholder =
                'Pickup location';

            to.placeholder =
                'Drop-off location';

            break;


        default:

            from.placeholder =
                'City or airport';

            to.placeholder =
                'Destination';

            if (departure) {
                departure.setAttribute(
                    'aria-label',
                    'Departure date'
                );
            }

            break;
    }

    if (guests) {

        guests.setAttribute(
            'aria-label',
            type === 'hotels'
                ? 'Number of guests'
                : 'Number of travelers'
        );

    }

}


/*
|--------------------------------------------------------------------------
| Travel Search
|--------------------------------------------------------------------------
*/

function initializeSearch() {

    const form = $('#travelSearchForm');

    if (!form) {
        return;
    }

    form.addEventListener(
        'submit',
        handleSearch
    );

}


function handleSearch(event) {

    event.preventDefault();

    const from =
        $('#from')?.value.trim() || '';

    const to =
        $('#to')?.value.trim() || '';

    const departure =
        $('#departure')?.value || '';

    const guests =
        $('#guests')?.value || '2';

    if (!from || !to) {

        showNotification(
            'Please enter your origin and destination.',
            'warning'
        );

        return;
    }

    const searchData = {
        type: SaraVia.travelType,
        from,
        to,
        departure,
        guests
    };

    console.log(
        '[SARA VIA] Travel search:',
        searchData
    );

    showNotification(
        `${capitalize(SaraVia.travelType)} search is ready.`,
        'success'
    );

}


/*
|--------------------------------------------------------------------------
| Pi Authentication
|--------------------------------------------------------------------------
*/

async function connectPi() {

    const button = $('#connectPiBtn');

    if (typeof window.Pi === 'undefined') {

        showNotification(
            'Pi Browser is required for Pi authentication.',
            'warning'
        );

        return;
    }

    setPiButtonLoading(true);

    try {

        /*
         * Pi requires username + payments when
         * the application accepts payments.
         */
        const scopes = [
            'username',
            'payments'
        ];

        const authResult =
            await window.Pi.authenticate(
                scopes,
                onIncompletePaymentFound
            );

        if (
            !authResult ||
            !authResult.accessToken
        ) {

            throw new Error(
                'Pi authentication did not return an access token.'
            );

        }

        SaraVia.accessToken =
            authResult.accessToken;

        SaraVia.user =
            authResult.user || null;


        /*
         * IMPORTANT:
         * The frontend user object is not trusted.
         * Verify the access token on our backend.
         */
        const verified =
            await verifyPiUser(
                SaraVia.accessToken
            );

        if (!verified.success) {

            throw new Error(
                verified.error ||
                'Pi user verification failed.'
            );

        }

        SaraVia.verifiedUser =
            verified.user;

        SaraVia.piConnected = true;

        updatePiButton();

        showNotification(
            `Welcome${verified.user?.username
                ? `, ${verified.user.username}`
                : ''}.`,
            'success'
        );

        console.log(
            '[SARA VIA] Pi user verified:',
            verified.user
        );

        return verified;

    } catch (error) {

        console.error(
            '[SARA VIA] Pi authentication error:',
            error
        );

        SaraVia.piConnected = false;

        showNotification(
            getErrorMessage(error),
            'error'
        );

        return {
            success: false,
            error: getErrorMessage(error)
        };

    } finally {

        setPiButtonLoading(false);

    }

}


/*
|--------------------------------------------------------------------------
| Backend Verification
|--------------------------------------------------------------------------
*/

async function verifyPiUser(accessToken) {

    const response = await fetch(
        '/api/auth/me',
        {
            method: 'GET',
            headers: {
                'Authorization':
                    `Bearer ${accessToken}`,
                'Accept':
                    'application/json'
            }
        }
    );

    let data;

    try {

        data = await response.json();

    } catch {

        data = {};

    }

    if (!response.ok) {

        return {
            success: false,
            error:
                data.error ||
                'The server could not verify your Pi account.'
        };

    }

    return {
        success: true,
        user: data.user
    };

}


/*
|--------------------------------------------------------------------------
| Incomplete Payment
|--------------------------------------------------------------------------
|
| Pi can return a payment that was submitted to the blockchain
| but was not yet completed by the developer.
|--------------------------------------------------------------------------
*/

async function onIncompletePaymentFound(payment) {

    console.warn(
        '[SARA VIA] Incomplete payment found:',
        payment
    );

    if (
        !payment ||
        !payment.identifier
    ) {

        return;
    }

    const paymentId =
        payment.identifier;

    const txid =
        payment.transaction?.txid;

    if (!txid) {

        console.warn(
            '[SARA VIA] Incomplete payment has no transaction ID yet.'
        );

        return;
    }

    try {

        const response =
            await fetch(
                '/api/payments/complete',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        paymentId,
                        txid
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok || !result.success) {

            throw new Error(
                result.error ||
                'Unable to complete the interrupted payment.'
            );

        }

        console.log(
            '[SARA VIA] Incomplete payment completed:',
            paymentId
        );

    } catch (error) {

        console.error(
            '[SARA VIA] Incomplete payment completion failed:',
            error
        );

        showNotification(
            'An unfinished Pi payment needs attention.',
            'warning'
        );

    }

}


/*
|--------------------------------------------------------------------------
| Create Pi Payment
|--------------------------------------------------------------------------
|
| This function is ready for SARA VIA bookings.
|
| IMPORTANT:
| A real booking amount must come from your booking/order system.
|--------------------------------------------------------------------------
*/

async function createPiPayment({
    amount,
    memo,
    metadata = {}
}) {

    if (
        typeof window.Pi === 'undefined'
    ) {

        throw new Error(
            'Pi SDK is not available.'
        );

    }

    if (!SaraVia.piConnected) {

        await connectPi();

    }

    if (
        !SaraVia.piConnected ||
        !SaraVia.accessToken
    ) {

        throw new Error(
            'Please connect your Pi account first.'
        );

    }

    if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        throw new Error(
            'Invalid payment amount.'
        );

    }


    return new Promise(
        (resolve, reject) => {

            try {

                window.Pi.createPayment(

                    {
                        amount,
                        memo:
                            memo ||
                            'SARA VIA Travel Booking',

                        metadata: {
                            app:
                                'SARA VIA',

                            environment:
                                'testnet',

                            ...metadata
                        }
                    },

                    {

                        /*
                         * Phase 1:
                         * Server approval.
                         */
                        onReadyForServerApproval:
                            async paymentId => {

                                try {

                                    const response =
                                        await fetch(
                                            '/api/payments/approve',
                                            {
                                                method:
                                                    'POST',

                                                headers: {
                                                    'Content-Type':
                                                        'application/json',

                                                    'Authorization':
                                                        `Bearer ${SaraVia.accessToken}`
                                                },

                                                body:
                                                    JSON.stringify({
                                                        paymentId
                                                    })
                                            }
                                        );

                                    const result =
                                        await response.json();

                                    if (
                                        !response.ok ||
                                        !result.success
                                    ) {

                                        throw new Error(
                                            result.error ||
                                            'Payment approval failed.'
                                        );

                                    }

                                    console.log(
                                        '[SARA VIA] Payment approved:',
                                        paymentId
                                    );

                                } catch (error) {

                                    console.error(
                                        '[SARA VIA] Approval error:',
                                        error
                                    );

                                    reject(error);

                                }

                            },


                        /*
                         * Phase 2:
                         * User signs the transaction.
                         *
                         * Phase 3:
                         * Pi returns paymentId + txid.
                         */
                        onReadyForServerCompletion:
                            async (
                                paymentId,
                                txid
                            ) => {

                                try {

                                    const response =
                                        await fetch(
                                            '/api/payments/complete',
                                            {
                                                method:
                                                    'POST',

                                                headers: {
                                                    'Content-Type':
                                                        'application/json',

                                                    'Authorization':
                                                        `Bearer ${SaraVia.accessToken}`
                                                },

                                                body:
                                                    JSON.stringify({
                                                        paymentId,
                                                        txid
                                                    })
                                            }
                                        );

                                    const result =
                                        await response.json();

                                    if (
                                        !response.ok ||
                                        !result.success
                                    ) {

                                        throw new Error(
                                            result.error ||
                                            'Payment completion failed.'
                                        );

                                    }

                                    console.log(
                                        '[SARA VIA] Payment completed:',
                                        paymentId
                                    );

                                    SaraVia.activePayment =
                                        result;

                                    showNotification(
                                        'Payment completed successfully.',
                                        'success'
                                    );

                                    resolve(result);

                                } catch (error) {

                                    console.error(
                                        '[SARA VIA] Completion error:',
                                        error
                                    );

                                    reject(error);

                                }

                            },


                        /*
                         * User cancelled the payment.
                         */
                        onCancel:
                            paymentId => {

                                console.log(
                                    '[SARA VIA] Payment cancelled:',
                                    paymentId
                                );

                                showNotification(
                                    'Payment cancelled.',
                                    'info'
                                );

                                reject(
                                    new Error(
                                        'Payment cancelled by user.'
                                    )
                                );

                            },


                        /*
                         * General Pi payment error.
                         */
                        onError:
                            error => {

                                console.error(
                                    '[SARA VIA] Pi payment error:',
                                    error
                                );

                                reject(
                                    error instanceof Error
                                        ? error
                                        : new Error(
                                            'Pi payment failed.'
                                        )
                                );

                            }

                    }

                );

            } catch (error) {

                reject(error);

            }

        }
    );

}


/*
|--------------------------------------------------------------------------
| Pi Button
|--------------------------------------------------------------------------
*/

function initializePiButton() {

    const button =
        $('#connectPiBtn');

    if (!button) {
        return;
    }

    button.addEventListener(
        'click',
        connectPi
    );

}


function setPiButtonLoading(isLoading) {

    const button =
        $('#connectPiBtn');

    if (!button) {
        return;
    }

    button.disabled =
        isLoading;

    if (isLoading) {

        button.dataset.originalText =
            button.textContent;

        button.innerHTML =
            '<span class="pi-icon">π</span><span>Connecting…</span>';

    } else if (!SaraVia.piConnected) {

        button.innerHTML =
            '<span class="pi-icon">π</span><span>Connect Pi</span>';

    }

}


function updatePiButton() {

    const button =
        $('#connectPiBtn');

    if (!button) {
        return;
    }

    if (SaraVia.piConnected) {

        const username =
            SaraVia.verifiedUser?.username;

        button.classList.add(
            'pi-connected'
        );

        button.innerHTML =
            `<span class="pi-icon">π</span>
             <span>${username
                ? escapeHtml(username)
                : 'Pi Connected'}</span>`;

        button.setAttribute(
            'aria-label',
            'Pi account connected'
        );

    } else {

        button.classList.remove(
            'pi-connected'
        );

        button.innerHTML =
            '<span class="pi-icon">π</span><span>Connect Pi</span>';

    }

}


/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

function initializeNavigation() {

    $$('a[href^="#"]').forEach(link => {

        link.addEventListener(
            'click',
            event => {

                const targetId =
                    link.getAttribute('href');

                if (
                    !targetId ||
                    targetId === '#'
                ) {
                    return;
                }

                const target =
                    document.querySelector(
                        targetId
                    );

                if (!target) {
                    return;
                }

                event.preventDefault();

                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

            }
        );

    });

}


/*
|--------------------------------------------------------------------------
| Minimum Date
|--------------------------------------------------------------------------
*/

function setMinimumDate() {

    const input =
        $('#departure');

    if (!input) {
        return;
    }

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, '0');

    const day =
        String(
            today.getDate()
        ).padStart(2, '0');

    input.min =
        `${year}-${month}-${day}`;

}


/*
|--------------------------------------------------------------------------
| Notifications
|--------------------------------------------------------------------------
*/

function showNotification(
    message,
    type = 'info'
) {

    const container =
        $('#notificationContainer');

    if (!container) {

        console.log(
            `[SARA VIA] ${message}`
        );

        return;
    }

    const notification =
        document.createElement('div');

    notification.className =
        `sara-notification ${type}`;

    notification.innerHTML = `
        <span class="notification-icon">
            ${notificationIcon(type)}
        </span>

        <span class="notification-message">
            ${escapeHtml(message)}
        </span>

        <button
            type="button"
            class="notification-close"
            aria-label="Close notification"
        >
            ×
        </button>
    `;

    container.appendChild(
        notification
    );

    const closeButton =
        notification.querySelector(
            '.notification-close'
        );

    if (closeButton) {

        closeButton.addEventListener(
            'click',
            () => {

                removeNotification(
                    notification
                );

            }
        );

    }

    requestAnimationFrame(() => {

        notification.classList.add(
            'visible'
        );

    });

    setTimeout(() => {

        removeNotification(
            notification
        );

    }, 5000);

}


function removeNotification(
    notification
) {

    if (!notification) {
        return;
    }

    notification.classList.remove(
        'visible'
    );

    setTimeout(() => {

        notification.remove();

    }, 250);

}


function notificationIcon(type) {

    switch (type) {

        case 'success':
            return '✓';

        case 'error':
            return '×';

        case 'warning':
            return '⚠';

        default:
            return 'i';
    }

}


/*
|--------------------------------------------------------------------------
| Utility
|--------------------------------------------------------------------------
*/

function capitalize(value) {

    if (!value) {
        return '';
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );

}


function getErrorMessage(error) {

    if (
        error &&
        typeof error.message === 'string' &&
        error.message.trim()
    ) {

        return error.message;

    }

    return 'Something went wrong. Please try again.';

}


function escapeHtml(value) {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


/*
|--------------------------------------------------------------------------
| Global SARA VIA API
|--------------------------------------------------------------------------
*/

window.SaraVia = SaraVia;

window.connectPi =
    connectPi;

window.createPiPayment =
    createPiPayment;
