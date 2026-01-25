/**
 * Building Nick - Main Application
 * Entry point and initialization
 */

// App state
const AppState = {
  initialized: false,
  currentView: 'today',
  notificationsEnabled: false
};

/**
 * Initialize the application
 */
async function initApp() {
  console.log('Initializing Building Nick...');

  try {
    // Initialize database
    await initDB();
    console.log('Database initialized');

    // Initialize activities (fetch from Notion if available)
    await initActivities();
    console.log('Activities initialized');

    // Initialize UI
    initUI();
    console.log('UI initialized');

    // Render initial content
    renderHeader();
    await renderMotivationCard();
    await renderDailyPlan();

    // Check for Sunday planning prompt
    await checkSundayPlanning();

    // Initialize notifications
    await initNotifications();

    // Check scheduled notifications
    await checkScheduledNotifications();

    // Mark as initialized
    AppState.initialized = true;
    console.log('Building Nick initialized successfully');

    // Show install prompt if not installed
    checkInstallPrompt();

  } catch (error) {
    console.error('Failed to initialize app:', error);
    showErrorState();
  }
}

/**
 * Initialize notifications
 */
async function initNotifications() {
  // Check if app is installed (standalone mode)
  if (!isAppInstalled()) {
    console.log('App not installed, skipping notification setup');
    return;
  }

  // Try to initialize OneSignal
  const oneSignalLoaded = await loadOneSignalSDK();

  if (oneSignalLoaded) {
    await initOneSignal();
  }

  // Check notification status
  const status = await getNotificationStatus();
  AppState.notificationsEnabled = status.oneSignalEnabled || status.permission === 'granted';

  // If not prompted yet, show prompt after a delay
  if (status.canPrompt && !localStorage.getItem('notificationPromptShown')) {
    setTimeout(() => {
      showNotificationOnboarding();
    }, 5000); // 5 second delay
  }
}

/**
 * Load OneSignal SDK dynamically
 */
function loadOneSignalSDK() {
  return new Promise((resolve) => {
    if (typeof OneSignal !== 'undefined') {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;

    script.onload = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      resolve(true);
    };

    script.onerror = () => {
      console.log('Failed to load OneSignal SDK');
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Show notification onboarding prompt
 */
async function showNotificationOnboarding() {
  // Create onboarding modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.id = 'notificationOnboarding';

  modal.innerHTML = `
    <div class="modal-content" style="border-radius: 16px; margin: 20px;">
      <div class="modal-body" style="padding: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">🔔</div>
        <h2 style="margin-bottom: 12px; font-size: 1.25rem;">Stay on Track</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px; line-height: 1.6;">
          Get gentle reminders at 7:45 AM to start your day right,
          and an evening preview of tomorrow's plan at 8:30 PM.
        </p>
        <button class="btn btn-primary btn-full" id="enableNotifications" style="margin-bottom: 12px;">
          Enable Notifications
        </button>
        <button class="btn btn-secondary btn-full" id="skipNotifications">
          Maybe Later
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Mark as shown
  localStorage.setItem('notificationPromptShown', 'true');

  // Handle enable click
  document.getElementById('enableNotifications').addEventListener('click', async () => {
    const result = await requestPushPermission();
    if (result.success) {
      await subscribeToPush();
      AppState.notificationsEnabled = true;
    }
    modal.remove();
  });

  // Handle skip click
  document.getElementById('skipNotifications').addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Check if it's Sunday and prompt for weekly planning
 */
async function checkSundayPlanning() {
  const today = new Date();

  if (!isSunday(today)) {
    return;
  }

  // Check if already planned this week
  const currentWeekPlan = await getCurrentWeekPlan();
  const weekStart = getWeekStart(today);

  if (currentWeekPlan && currentWeekPlan.weekStart === weekStart) {
    // Already planned
    return;
  }

  // Check if we've shown the prompt today
  const promptKey = `sundayPlanningPrompt_${formatDateISO(today)}`;
  if (localStorage.getItem(promptKey)) {
    return;
  }

  // Show planning prompt after a delay
  setTimeout(() => {
    showSundayPlanningPrompt();
  }, 2000);

  localStorage.setItem(promptKey, 'true');
}

/**
 * Show Sunday planning prompt
 */
function showSundayPlanningPrompt() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.id = 'sundayPlanningPrompt';

  modal.innerHTML = `
    <div class="modal-content" style="border-radius: 16px; margin: 20px;">
      <div class="modal-body" style="padding: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
        <h2 style="margin-bottom: 12px; font-size: 1.25rem;">Plan Your Week</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px; line-height: 1.6;">
          Take a few minutes to set your focus for the week ahead.
          Choose which mind-body practices to emphasize.
        </p>
        <button class="btn btn-primary btn-full" id="startPlanning" style="margin-bottom: 12px;">
          Let's Plan
        </button>
        <button class="btn btn-secondary btn-full" id="skipPlanning">
          Later Today
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Handle start planning click
  document.getElementById('startPlanning').addEventListener('click', () => {
    modal.remove();
    setActiveNav('plan');
    showWeeklyPlanView();
  });

  // Handle skip click
  document.getElementById('skipPlanning').addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Check if PWA install prompt should be shown
 */
function checkInstallPrompt() {
  if (isAppInstalled()) {
    return;
  }

  if (isIOS() && isSafari()) {
    // iOS Safari - show custom instructions
    const installPromptShown = localStorage.getItem('iosInstallPromptShown');

    if (!installPromptShown) {
      setTimeout(() => {
        showIOSInstallInstructions();
      }, 10000); // 10 second delay
    }
  }
}

/**
 * Show iOS install instructions
 */
function showIOSInstallInstructions() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay visible';
  modal.id = 'iosInstallPrompt';

  modal.innerHTML = `
    <div class="modal-content" style="border-radius: 16px; margin: 20px;">
      <div class="modal-body" style="padding: 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">📱</div>
        <h2 style="margin-bottom: 12px; font-size: 1.25rem;">Install Building Nick</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 16px; line-height: 1.6;">
          Add this app to your Home Screen for the best experience with notifications.
        </p>
        <div style="text-align: left; background: var(--color-border-light); padding: 16px; border-radius: 12px; margin-bottom: 24px;">
          <p style="margin-bottom: 12px;"><strong>1.</strong> Tap the Share button <span style="font-size: 20px;">⬆️</span></p>
          <p style="margin-bottom: 12px;"><strong>2.</strong> Scroll down and tap "Add to Home Screen"</p>
          <p><strong>3.</strong> Tap "Add" in the top right</p>
        </div>
        <button class="btn btn-secondary btn-full" id="closeInstallPrompt">
          Got it
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Mark as shown
  localStorage.setItem('iosInstallPromptShown', 'true');

  // Handle close click
  document.getElementById('closeInstallPrompt').addEventListener('click', () => {
    modal.remove();
  });

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Show error state
 */
function showErrorState() {
  const mainContent = document.querySelector('.main-content');
  mainContent.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
      <h2 style="margin-bottom: 12px;">Something went wrong</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">
        We couldn't load your data. Try refreshing the page.
      </p>
      <button class="btn btn-primary" onclick="location.reload()">
        Refresh
      </button>
    </div>
  `;
}

/**
 * Handle visibility change (app comes to foreground)
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && AppState.initialized) {
    // Refresh data when app becomes visible
    refreshApp();
  }
}

/**
 * Refresh app data
 */
async function refreshApp() {
  await renderMotivationCard();
  await renderDailyPlan();
  await checkScheduledNotifications();
}

/**
 * Handle online/offline status
 */
function handleOnlineStatus() {
  if (navigator.onLine) {
    // Back online - could sync data here
    console.log('Back online');
  } else {
    console.log('Offline - using cached data');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Handle visibility changes
document.addEventListener('visibilitychange', handleVisibilityChange);

// Handle online/offline
window.addEventListener('online', handleOnlineStatus);
window.addEventListener('offline', handleOnlineStatus);

// Handle beforeinstallprompt for Android
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Could show custom install button here
});

// Export for debugging
window.BuildingNick = {
  state: AppState,
  refresh: refreshApp,
  testNotification: sendTestNotification,
  clearData: clearAllData
};
