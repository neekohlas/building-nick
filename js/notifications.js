/**
 * Building Nick - Push Notifications
 * OneSignal integration for push notifications
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://onesignal.com and create a free account
 * 2. Create a new app (choose "Web Push" as platform)
 * 3. Configure for Safari/iOS:
 *    - Site Name: Building Nick
 *    - Site URL: Your deployed URL (e.g., https://yourusername.github.io/building-nick)
 *    - Enable "Safari Web ID" and follow Apple Developer setup if needed
 * 4. Copy your OneSignal App ID
 * 5. Replace YOUR_ONESIGNAL_APP_ID below with your actual App ID
 */

// OneSignal configuration
const ONESIGNAL_APP_ID = 'YOUR_ONESIGNAL_APP_ID'; // Replace with your App ID

// Notification schedules (in local time)
const NOTIFICATION_SCHEDULE = {
  morning: {
    hour: 7,
    minute: 45,
    message: () => getRandomMessage('morning')
  },
  evening: {
    hour: 20,
    minute: 30,
    message: () => getRandomMessage('evening')
  },
  sundayPlanning: {
    hour: 16,
    minute: 0,
    dayOfWeek: 0, // Sunday
    message: () => getRandomMessage('sunday')
  }
};

let oneSignalInitialized = false;

/**
 * Initialize OneSignal
 */
async function initOneSignal() {
  // Check if OneSignal SDK is loaded
  if (typeof OneSignal === 'undefined') {
    console.log('OneSignal SDK not loaded yet');
    return false;
  }

  if (oneSignalInitialized) {
    return true;
  }

  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      safari_web_id: 'web.onesignal.auto.' + ONESIGNAL_APP_ID, // Auto-generated Safari ID
      allowLocalhostAsSecureOrigin: true, // For local development
      notifyButton: {
        enable: false // We'll use custom UI
      },
      welcomeNotification: {
        disable: true // We'll handle welcome notification ourselves
      }
    });

    oneSignalInitialized = true;
    console.log('OneSignal initialized successfully');

    // Set up notification handlers
    setupNotificationHandlers();

    return true;
  } catch (error) {
    console.error('Failed to initialize OneSignal:', error);
    return false;
  }
}

/**
 * Set up notification event handlers
 */
function setupNotificationHandlers() {
  // Handle notification clicks
  OneSignal.on('notificationDisplay', function(event) {
    console.log('OneSignal notification displayed:', event);
  });

  OneSignal.on('notificationDismiss', function(event) {
    console.log('OneSignal notification dismissed:', event);
  });
}

/**
 * Request notification permission
 */
async function requestPushPermission() {
  if (!oneSignalInitialized) {
    const initialized = await initOneSignal();
    if (!initialized) {
      return { success: false, reason: 'not_initialized' };
    }
  }

  try {
    const permission = await OneSignal.getNotificationPermission();

    if (permission === 'granted') {
      return { success: true, permission: 'granted' };
    }

    if (permission === 'denied') {
      return { success: false, permission: 'denied', reason: 'user_denied' };
    }

    // Prompt for permission
    await OneSignal.showNativePrompt();

    const newPermission = await OneSignal.getNotificationPermission();
    return { success: newPermission === 'granted', permission: newPermission };
  } catch (error) {
    console.error('Error requesting push permission:', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Check if notifications are enabled
 */
async function areNotificationsEnabled() {
  if (!oneSignalInitialized) {
    return false;
  }

  try {
    const permission = await OneSignal.getNotificationPermission();
    const isPushEnabled = await OneSignal.isPushNotificationsEnabled();
    return permission === 'granted' && isPushEnabled;
  } catch {
    return false;
  }
}

/**
 * Subscribe user to push notifications
 */
async function subscribeToPush() {
  if (!oneSignalInitialized) {
    await initOneSignal();
  }

  try {
    await OneSignal.setSubscription(true);

    // Set tags for notification scheduling
    await OneSignal.sendTags({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lastActive: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
async function unsubscribeFromPush() {
  if (!oneSignalInitialized) {
    return true;
  }

  try {
    await OneSignal.setSubscription(false);
    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

/**
 * Schedule local notification (fallback for when OneSignal isn't available)
 * This uses the Notification API directly
 */
async function scheduleLocalNotification(title, body, tag = 'building-nick') {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return false;
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }
  }

  // Show notification
  const notification = new Notification(title, {
    body,
    tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    requireInteraction: false
  });

  notification.onclick = function() {
    window.focus();
    notification.close();
  };

  return true;
}

/**
 * Send a test notification
 */
async function sendTestNotification() {
  const title = 'Building Nick';
  const body = 'Test notification working! You\'re all set.';

  // Try OneSignal first
  const enabled = await areNotificationsEnabled();
  if (enabled) {
    console.log('Notifications are enabled via OneSignal');
    // OneSignal would send via their servers
    // For testing, we use local notification
  }

  // Fallback to local notification
  return scheduleLocalNotification(title, body, 'test');
}

/**
 * Get notification permission status
 */
async function getNotificationStatus() {
  if (!('Notification' in window)) {
    return { supported: false };
  }

  const permission = Notification.permission;
  const oneSignalEnabled = await areNotificationsEnabled();

  return {
    supported: true,
    permission,
    oneSignalEnabled,
    canPrompt: permission === 'default'
  };
}

/**
 * Show in-app notification prompt
 */
function showNotificationPrompt() {
  // This would show a custom UI prompt before the browser prompt
  // For MVP, we'll just use the browser prompt directly
  return requestPushPermission();
}

/**
 * Generate tomorrow's plan summary for evening notification
 */
async function generateTomorrowSummary() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const schedule = await generateDailySchedule(tomorrow);
  const activities = [];

  for (const timeBlock in schedule.activities) {
    for (const activityId of schedule.activities[timeBlock]) {
      const activity = ACTIVITIES[activityId];
      if (activity) {
        activities.push(activity.name);
      }
    }
  }

  if (activities.length === 0) {
    return 'Your plan is ready for tomorrow!';
  }

  const summary = activities.slice(0, 3).join(', ');
  const more = activities.length > 3 ? ` + ${activities.length - 3} more` : '';

  return `Tomorrow: ${summary}${more}`;
}

/**
 * Check and trigger scheduled notifications
 * This should be called periodically (e.g., when app is opened)
 */
async function checkScheduledNotifications() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const dayOfWeek = now.getDay();

  // Check if it's time for any scheduled notification
  for (const [type, config] of Object.entries(NOTIFICATION_SCHEDULE)) {
    // Check day of week for sunday planning
    if (config.dayOfWeek !== undefined && config.dayOfWeek !== dayOfWeek) {
      continue;
    }

    // Check if within notification window (within 15 minutes of scheduled time)
    const scheduledMinutes = config.hour * 60 + config.minute;
    const currentMinutes = hour * 60 + minute;

    if (Math.abs(currentMinutes - scheduledMinutes) <= 15) {
      // Check if we already sent this notification today
      const lastSentKey = `lastNotification_${type}_${now.toDateString()}`;
      const lastSent = localStorage.getItem(lastSentKey);

      if (!lastSent) {
        // Send notification
        const message = config.message();
        await scheduleLocalNotification('Building Nick', message, type);

        // Mark as sent
        localStorage.setItem(lastSentKey, 'true');
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initOneSignal,
    requestPushPermission,
    areNotificationsEnabled,
    subscribeToPush,
    unsubscribeFromPush,
    scheduleLocalNotification,
    sendTestNotification,
    getNotificationStatus,
    showNotificationPrompt,
    generateTomorrowSummary,
    checkScheduledNotifications,
    NOTIFICATION_SCHEDULE
  };
}
