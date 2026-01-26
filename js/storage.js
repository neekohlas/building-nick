/**
 * Building Nick - Storage Layer
 * IndexedDB operations for persisting data
 */

const DB_NAME = 'BuildingNickDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  COMPLETIONS: 'completions',
  WEEKLY_PLANS: 'weeklyPlans',
  DAILY_SCHEDULES: 'dailySchedules',
  SETTINGS: 'settings'
};

let db = null;

/**
 * Initialize the IndexedDB database
 */
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Completions store: tracks completed activities
      if (!database.objectStoreNames.contains(STORES.COMPLETIONS)) {
        const completionsStore = database.createObjectStore(STORES.COMPLETIONS, {
          keyPath: 'id',
          autoIncrement: true
        });
        completionsStore.createIndex('date', 'date', { unique: false });
        completionsStore.createIndex('activityId', 'activityId', { unique: false });
        completionsStore.createIndex('dateActivity', ['date', 'activityId'], { unique: true });
      }

      // Weekly plans store: tracks weekly emphasis and scheduled activities
      if (!database.objectStoreNames.contains(STORES.WEEKLY_PLANS)) {
        const weeklyStore = database.createObjectStore(STORES.WEEKLY_PLANS, {
          keyPath: 'weekStart'
        });
      }

      // Daily schedules store: tracks the planned activities for each day
      if (!database.objectStoreNames.contains(STORES.DAILY_SCHEDULES)) {
        const dailyStore = database.createObjectStore(STORES.DAILY_SCHEDULES, {
          keyPath: 'date'
        });
      }

      // Settings store: app settings and preferences
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, {
          keyPath: 'key'
        });
      }
    };
  });
}

/**
 * Get a transaction and object store
 */
function getStore(storeName, mode = 'readonly') {
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

// ============================================
// COMPLETIONS
// ============================================

/**
 * Save a completion record
 */
async function saveCompletion(completion) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS, 'readwrite');
    const record = {
      ...completion,
      completedAt: completion.completedAt || new Date().toISOString()
    };

    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get completions for a specific date
 */
async function getCompletionsForDate(date) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS);
    const index = store.index('date');
    const request = index.getAll(date);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if an activity was completed on a specific date
 */
async function isActivityCompleted(date, activityId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS);
    const index = store.index('dateActivity');
    const request = index.get([date, activityId]);

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a completion (uncomplete an activity)
 */
async function removeCompletion(date, activityId) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS, 'readwrite');
    const index = store.index('dateActivity');
    const request = index.getKey([date, activityId]);

    request.onsuccess = () => {
      if (request.result) {
        const deleteRequest = store.delete(request.result);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => reject(deleteRequest.error);
      } else {
        resolve(false);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all completions for a date range
 */
async function getCompletionsForDateRange(startDate, endDate) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS);
    const index = store.index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get completion count for the last N days
 */
async function getCompletionStats(days = 7) {
  const endDate = formatDate(new Date());
  const startDate = formatDate(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const completions = await getCompletionsForDateRange(startDate, endDate);

  // Group by date
  const byDate = {};
  completions.forEach(c => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });

  // Group by category
  const byCategory = {};
  completions.forEach(c => {
    const activity = ACTIVITIES[c.activityId];
    if (activity) {
      const category = activity.category;
      if (!byCategory[category]) byCategory[category] = 0;
      byCategory[category]++;
    }
  });

  return {
    total: completions.length,
    byDate,
    byCategory,
    daysWithActivity: Object.keys(byDate).length
  };
}

/**
 * Calculate current streak
 */
async function getCurrentStreak() {
  let streak = 0;
  let checkDate = new Date();

  // Start from yesterday if today has no completions yet
  const todayCompletions = await getCompletionsForDate(formatDate(checkDate));
  if (todayCompletions.length === 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = formatDate(checkDate);
    const completions = await getCompletionsForDate(dateStr);

    if (completions.length > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }

    // Safety limit
    if (streak > 365) break;
  }

  return streak;
}

// ============================================
// WEEKLY PLANS
// ============================================

/**
 * Save weekly plan
 */
async function saveWeeklyPlan(weekStart, plan) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.WEEKLY_PLANS, 'readwrite');
    const record = {
      weekStart,
      ...plan,
      updatedAt: new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get weekly plan for a specific week
 */
async function getWeeklyPlan(weekStart) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.WEEKLY_PLANS);
    const request = store.get(weekStart);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get the current week's plan
 */
async function getCurrentWeekPlan() {
  const weekStart = getWeekStart(new Date());
  return getWeeklyPlan(weekStart);
}

// ============================================
// DAILY SCHEDULES
// ============================================

/**
 * Save daily schedule
 */
async function saveDailySchedule(date, schedule) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.DAILY_SCHEDULES, 'readwrite');
    const record = {
      date,
      activities: schedule.activities,
      updatedAt: new Date().toISOString()
    };

    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get daily schedule
 */
async function getDailySchedule(date) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.DAILY_SCHEDULES);
    const request = store.get(date);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a single activity in the daily schedule (for swaps)
 */
async function swapActivityInSchedule(date, timeBlock, oldActivityId, newActivityId) {
  const schedule = await getDailySchedule(date);

  if (schedule && schedule.activities[timeBlock]) {
    const index = schedule.activities[timeBlock].indexOf(oldActivityId);
    if (index > -1) {
      schedule.activities[timeBlock][index] = newActivityId;
      await saveDailySchedule(date, schedule);
      return true;
    }
  }

  return false;
}

// ============================================
// SETTINGS
// ============================================

/**
 * Save a setting
 */
async function saveSetting(key, value) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SETTINGS, 'readwrite');
    const request = store.put({ key, value, updatedAt: new Date().toISOString() });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a setting
 */
async function getSetting(key) {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.SETTINGS);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
}

// ============================================
// CLOUD SYNC (Notion)
// ============================================

let syncInProgress = false;
let lastSyncTime = null;

/**
 * Sync all local data to Notion cloud
 */
async function syncToCloud() {
  if (syncInProgress) {
    console.log('[Sync] Sync already in progress');
    return { success: false, reason: 'in_progress' };
  }

  syncInProgress = true;
  console.log('[Sync] Starting cloud sync...');

  try {
    // Gather all local data
    const completions = await getAllCompletions();
    const weeklyPlans = await getAllWeeklyPlans();
    const dailySchedules = await getAllDailySchedules();

    // Send to sync API
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: getUserId(),
        completions,
        weeklyPlans,
        dailySchedules
      })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }

    const result = await response.json();
    lastSyncTime = new Date().toISOString();
    await saveSetting('lastSyncTime', lastSyncTime);

    console.log('[Sync] Cloud sync complete:', result);
    return { success: true, ...result };

  } catch (error) {
    console.error('[Sync] Cloud sync failed:', error);
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Load data from Notion cloud and merge with local
 */
async function syncFromCloud() {
  if (syncInProgress) {
    console.log('[Sync] Sync already in progress');
    return { success: false, reason: 'in_progress' };
  }

  syncInProgress = true;
  console.log('[Sync] Loading from cloud...');

  try {
    const response = await fetch(`/api/sync?userId=${getUserId()}`);

    if (!response.ok) {
      throw new Error(`Load failed: ${response.status}`);
    }

    const data = await response.json();

    // Merge cloud completions with local (cloud wins for conflicts)
    let imported = 0;
    for (const completion of data.completions || []) {
      const exists = await isActivityCompleted(completion.date, completion.activityId);
      if (!exists) {
        await saveCompletion(completion);
        imported++;
      }
    }

    // Merge weekly plans
    for (const [weekStart, plan] of Object.entries(data.weeklyPlans || {})) {
      const localPlan = await getWeeklyPlan(weekStart);
      if (!localPlan) {
        await saveWeeklyPlan(weekStart, plan);
      }
    }

    // Merge daily schedules
    for (const [dateStr, schedule] of Object.entries(data.dailySchedules || {})) {
      const localSchedule = await getDailySchedule(dateStr);
      if (!localSchedule) {
        await saveDailySchedule(dateStr, schedule);
      }
    }

    lastSyncTime = new Date().toISOString();
    await saveSetting('lastSyncTime', lastSyncTime);

    console.log('[Sync] Cloud load complete, imported:', imported);
    return { success: true, imported };

  } catch (error) {
    console.error('[Sync] Cloud load failed:', error);
    return { success: false, error: error.message };
  } finally {
    syncInProgress = false;
  }
}

/**
 * Full bidirectional sync
 */
async function fullSync() {
  // First load from cloud to get any new data
  const loadResult = await syncFromCloud();

  // Then push local data to cloud
  const pushResult = await syncToCloud();

  return {
    success: loadResult.success && pushResult.success,
    loadResult,
    pushResult
  };
}

/**
 * Get all completions from local DB
 */
async function getAllCompletions() {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.COMPLETIONS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all weekly plans from local DB
 */
async function getAllWeeklyPlans() {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.WEEKLY_PLANS);
    const request = store.getAll();
    request.onsuccess = () => {
      const plans = {};
      for (const plan of request.result) {
        plans[plan.weekStart] = plan;
      }
      resolve(plans);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all daily schedules from local DB
 */
async function getAllDailySchedules() {
  return new Promise((resolve, reject) => {
    const store = getStore(STORES.DAILY_SCHEDULES);
    const request = store.getAll();
    request.onsuccess = () => {
      const schedules = {};
      for (const schedule of request.result) {
        schedules[schedule.date] = schedule;
      }
      resolve(schedules);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get or create a user ID for sync
 */
function getUserId() {
  let userId = localStorage.getItem('buildingNickUserId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('buildingNickUserId', userId);
  }
  return userId;
}

/**
 * Get last sync time
 */
async function getLastSyncTime() {
  return await getSetting('lastSyncTime');
}

/**
 * Check if sync is available (API reachable)
 */
async function isSyncAvailable() {
  try {
    const response = await fetch('/api/sync?userId=test', { method: 'HEAD' });
    return response.ok || response.status === 405; // 405 is OK, means endpoint exists
  } catch {
    return false;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format date to YYYY-MM-DD string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the Monday of the week containing the given date
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  return formatDate(d);
}

/**
 * Clear all data (for testing/reset)
 */
async function clearAllData() {
  const stores = [STORES.COMPLETIONS, STORES.WEEKLY_PLANS, STORES.DAILY_SCHEDULES, STORES.SETTINGS];

  for (const storeName of stores) {
    await new Promise((resolve, reject) => {
      const store = getStore(storeName, 'readwrite');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initDB,
    saveCompletion,
    getCompletionsForDate,
    isActivityCompleted,
    removeCompletion,
    getCompletionsForDateRange,
    getCompletionStats,
    getCurrentStreak,
    saveWeeklyPlan,
    getWeeklyPlan,
    getCurrentWeekPlan,
    saveDailySchedule,
    getDailySchedule,
    swapActivityInSchedule,
    saveSetting,
    getSetting,
    formatDate,
    getWeekStart,
    clearAllData,
    // Cloud sync
    syncToCloud,
    syncFromCloud,
    fullSync,
    getLastSyncTime,
    isSyncAvailable,
    getUserId
  };
}
