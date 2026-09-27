"use strict";
/*
 * SARA VIA
 * Luxury Travel + Web3
 * Testnet Frontend
 *
 * This file handles:
 * - Navigation interactions
 * - Travel category selection
 * - Travel search UI
 * - Pi connection preparation
 * - Testnet status
 *
 * IMPORTANT:
 * Do not place private keys, API secrets,
 * wallet secrets or validation keys here.
 */
/* =========================================================
   APPLICATION STATE
========================================================= */
const SaraVia = {
  environment: "testnet",
  travelType: "flights",
  piConnected: false,
  user: null
};
/* =========================================================
   DOM HELPERS
========================================================= */
const $ = (selector) => {
  return document.querySelector(selector);
};
const $$ = (selector) => {
  return document.querySelectorAll(selector);
};
/* =========================================================
   DOM ELEMENTS
========================================================= */
const connectPiButton = $("#connectPiButton");
const searchButton = $("#searchButton");
const fromLocation = $("#fromLocation");
const toLocation = $("#toLocation");
const travelDate = $("#travelDate");
const travelTabs = $$(".travel-tab");
/* =========================================================
   INITIALIZATION
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});
function initializeApplication() {
  console.log(
    "SARA VIA initialized."
  );
  console.log(
    "Environment:",
    SaraVia.environment
  );
  initializeTravelTabs();
  initializeSearch();
  initializePiButton();
  initializeNavigation();
  setMinimumTravelDate();
}
/* =========================================================
   TRAVEL TABS
========================================================= */
function initializeTravelTabs() {
  travelTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const type =
        tab.dataset.type;
      if (!type) {
        return;
      }
      setTravelType(type);
    });
  });
}
function setTravelType(type) {
  SaraVia.travelType = type;
  travelTabs.forEach((tab) => {
    const isActive =
      tab.dataset.type === type;
    tab.classList.toggle(
      "active",
      isActive
    );
  });
  updateSearchFields(type);
}
function updateSearchFields(type) {
  if (!fromLocation || !toLocation) {
    return;
  }
  const configurations = {
    flights: {
      from: "Departure city",
      to: "Destination"
    },
    hotels: {
      from: "City or destination",
      to: "Hotel or area"
    },
    experiences: {
      from: "City",
      to: "Experience"
    },
    transport: {
      from: "Pickup location",
      to: "Destination"
    }
  };
  const config =
    configurations[type] ||
    configurations.flights;
  fromLocation.placeholder =
    config.from;
  toLocation.placeholder =
    config.to;
}
/* =========================================================
   SEARCH
========================================================= */
function initializeSearch() {
  if (!searchButton) {
    return;
  }
  searchButton.addEventListener(
    "click",
    handleSearch
  );
}
function handleSearch() {
  const from =
    fromLocation?.value.trim() || "";
  const to =
    toLocation?.value.trim() || "";
  const date =
    travelDate?.value || "";
  if (!from && !to) {
    showNotification(
      "Choose your departure and destination first.",
      "info"
    );
    focusSearchField(fromLocation);
    return;
  }
  if (!to) {
    showNotification(
      "Please enter your destination.",
      "info"
    );
    focusSearchField(toLocation);
    return;
  }
  const searchData = {
    type: SaraVia.travelType,
    from,
    to,
    date
  };
  console.log(
    "Travel search:",
    searchData
  );
  showNotification(
    "Your travel search is ready for integration.",
    "success"
  );
}
function focusSearchField(element) {
  if (!element) {
    return;
  }
  element.focus();
}
/* =========================================================
   PI NETWORK CONNECTION
========================================================= */
function initializePiButton() {
  if (!connectPiButton) {
    return;
  }
  connectPiButton.addEventListener(
    "click",
    connectPi
  );
}
/*
 * Pi connection entry point.
 *
 * The actual Pi SDK should be loaded and configured
 * according to the current Pi Developer documentation.
 *
 * We deliberately do not fake a successful connection.
 */
async function connectPi() {
  if (SaraVia.piConnected) {
    showNotification(
      "Pi account is already connected.",
      "success"
    );
    return;
  }
  if (
    typeof window.Pi === "undefined"
  ) {
    showNotification(
      "Pi connection will be enabled when the Pi SDK is connected.",
      "info"
    );
    console.info(
      "Pi SDK is not currently loaded."
    );
    return;
  }
  try {
    setPiButtonLoading(true);
    /*
     * The Pi SDK authentication flow belongs here.
     *
     * Do not add private keys or secret credentials
     * to this frontend file.
     */
    const scopes = [
      "username"
    ];
    const authResult =
      await window.Pi.authenticate(
        scopes,
        onIncompletePaymentFound
      );
    handlePiAuthentication(
      authResult
    );
  } catch (error) {
    console.error(
      "Pi authentication error:",
      error
    );
    showNotification(
      "Pi connection was not completed.",
      "error"
    );
  } finally {
    setPiButtonLoading(false);
  }
}
/* =========================================================
   PI AUTHENTICATION
========================================================= */
function handlePiAuthentication(
  authResult
) {
  if (!authResult) {
    showNotification(
      "No Pi account information was returned.",
      "error"
    );
    return;
  }
  SaraVia.piConnected = true;
  SaraVia.user =
    authResult.user || null;
  updatePiButton();
  showNotification(
    "Pi account connected successfully.",
    "success"
  );
  console.log(
    "Pi user:",
    SaraVia.user
  );
}
/* =========================================================
   INCOMPLETE PI PAYMENTS
========================================================= */
function onIncompletePaymentFound(
  payment
) {
  console.log(
    "Incomplete Pi payment:",
    payment
  );
  /*
   * Payment recovery should be handled
   * through the application's backend
   * according to Pi's payment flow.
   */
}
/* =========================================================
   PI BUTTON STATE
========================================================= */
function setPiButtonLoading(
  loading
) {
  if (!connectPiButton) {
    return;
  }
  if (loading) {
    connectPiButton.disabled = true;
    connectPiButton.dataset.originalText =
      connectPiButton.innerHTML;
    connectPiButton.innerHTML =
      '<span class="pi-symbol">π</span> Connecting...';
  } else {
    connectPiButton.disabled = false;
    if (
      connectPiButton.dataset.originalText
    ) {
      connectPiButton.innerHTML =
        connectPiButton.dataset.originalText;
    }
  }
}
function updatePiButton() {
  if (!connectPiButton) {
    return;
  }
  if (SaraVia.piConnected) {
    const username =
      SaraVia.user?.username;
    if (username) {
      connectPiButton.innerHTML =
        `<span class="pi-symbol">π</span> @${escapeHtml(username)}`;
    } else {
      connectPiButton.innerHTML =
        '<span class="pi-symbol">π</span> Connected';
    }
    connectPiButton.classList.add(
      "connected"
    );
  }
}
/* =========================================================
   NAVIGATION
========================================================= */
function initializeNavigation() {
  const links =
    $$(".desktop-nav a");
  links.forEach((link) => {
    link.addEventListener(
      "click",
      () => {
        const target =
          link.getAttribute("href");
        if (
          target &&
          target.startsWith("#")
        ) {
          const element =
            $(target);
          if (element) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        }
      }
    );
  });
}
/* =========================================================
   DATE
========================================================= */
function setMinimumTravelDate() {
  if (!travelDate) {
    return;
  }
  const today =
    new Date();
  const year =
    today.getFullYear();
  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");
  const day =
    String(
      today.getDate()
    ).padStart(2, "0");
  travelDate.min =
    `${year}-${month}-${day}`;
}
/* =========================================================
   NOTIFICATIONS
========================================================= */
function showNotification(
  message,
  type = "info"
) {
  const existing =
    document.querySelector(
      ".sara-notification"
    );
  if (existing) {
    existing.remove();
  }
  const notification =
    document.createElement("div");
  notification.className =
    `sara-notification sara-${type}`;
  notification.textContent =
    message;
  Object.assign(
    notification.style,
    {
      position: "fixed",
      left: "50%",
      bottom: "28px",
      transform:
        "translateX(-50%)",
      zIndex: "9999",
      maxWidth:
        "calc(100% - 32px)",
      padding:
        "13px 20px",
      borderRadius:
        "999px",
      border:
        "1px solid rgba(215,181,109,.25)",
      background:
        "rgba(7,17,31,.94)",
      color:
        "#f1d99a",
      boxShadow:
        "0 20px 50px rgba(0,0,0,.35)",
      backdropFilter:
        "blur(18px)",
      fontSize:
        "12px",
      fontWeight:
        "600",
      textAlign:
        "center",
      animation:
        "saraNotificationIn .3s ease"
    }
  );
  document.body.appendChild(
    notification
  );
  window.setTimeout(
    () => {
      notification.style.opacity =
        "0";
      notification.style.transform =
        "translateX(-50%) translateY(10px)";
      notification.style.transition =
        "opacity .25s ease, transform .25s ease";
      window.setTimeout(
        () => {
          notification.remove();
        },
        260
      );
    },
    3500
  );
}
/* =========================================================
   SECURITY HELPER
========================================================= */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
/* =========================================================
   GLOBAL ACCESS
========================================================= */
window.SaraVia = SaraVia;
window.connectPi = connectPi;
/* =========================================================
   NOTIFICATION ANIMATION
========================================================= */
const notificationStyle =
  document.createElement("style");
notificationStyle.textContent = `
  @keyframes saraNotificationIn {
    from {
      opacity: 0;
      transform:
        translateX(-50%)
        translateY(12px);
    }
    to {
      opacity: 1;
      transform:
        translateX(-50%)
        translateY(0);
    }
  }
  .connect-button.connected {
    border-color:
      rgba(110,231,183,.35);
    color:
      #9ff0c9;
  }
  .connect-button:disabled {
    opacity: .65;
    cursor: wait;
  }
`;
document.head.appendChild(
  notificationStyle
);
