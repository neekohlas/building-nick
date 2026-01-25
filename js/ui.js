/**
 * Building Nick - UI Rendering Functions
 * Handles all DOM manipulation and UI updates
 */

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
  // Header
  currentDate: document.getElementById('currentDate'),
  weatherBadge: document.getElementById('weatherBadge'),
  weatherTemp: document.getElementById('weatherTemp'),

  // Main content
  motivationCard: document.getElementById('motivationCard'),
  motivationText: document.getElementById('motivationText'),
  dailyPlan: document.getElementById('dailyPlan'),

  // Progress
  todayProgress: document.getElementById('todayProgress'),
  currentStreak: document.getElementById('currentStreak'),

  // Navigation
  navToday: document.getElementById('navToday'),
  navWeek: document.getElementById('navWeek'),
  navPlan: document.getElementById('navPlan'),
  navStats: document.getElementById('navStats'),

  // Modals
  swapModal: document.getElementById('swapModal'),
  closeSwapModal: document.getElementById('closeSwapModal'),
  swapOptions: document.getElementById('swapOptions'),
  logCustomActivity: document.getElementById('logCustomActivity'),

  customActivityModal: document.getElementById('customActivityModal'),
  closeCustomModal: document.getElementById('closeCustomModal'),
  customActivityName: document.getElementById('customActivityName'),
  customActivityDuration: document.getElementById('customActivityDuration'),
  cancelCustomActivity: document.getElementById('cancelCustomActivity'),
  saveCustomActivity: document.getElementById('saveCustomActivity'),

  // Activity Detail Modal
  activityDetailModal: document.getElementById('activityDetailModal'),
  activityDetailTitle: document.getElementById('activityDetailTitle'),
  activityDetailMeta: document.getElementById('activityDetailMeta'),
  activityDetailDescription: document.getElementById('activityDetailDescription'),
  activityDetailInstructions: document.getElementById('activityDetailInstructions'),
  activityDetailLink: document.getElementById('activityDetailLink'),
  activityDetailVideo: document.getElementById('activityDetailVideo'),
  closeActivityDetail: document.getElementById('closeActivityDetail'),
  activityDetailSwap: document.getElementById('activityDetailSwap'),
  activityDetailComplete: document.getElementById('activityDetailComplete'),

  // Views
  weeklyPlanView: document.getElementById('weeklyPlanView'),
  backFromPlan: document.getElementById('backFromPlan'),
  weekReview: document.getElementById('weekReview'),
  weekStats: document.getElementById('weekStats'),
  emphasisOptions: document.getElementById('emphasisOptions'),
  physicalSchedule: document.getElementById('physicalSchedule'),
  saveWeeklyPlan: document.getElementById('saveWeeklyPlan'),

  // Week View
  weekView: document.getElementById('weekView'),
  backFromWeek: document.getElementById('backFromWeek'),
  prevWeek: document.getElementById('prevWeek'),
  nextWeek: document.getElementById('nextWeek'),
  weekDateRange: document.getElementById('weekDateRange'),
  weekDaysContainer: document.getElementById('weekDaysContainer'),

  statsView: document.getElementById('statsView'),
  backFromStats: document.getElementById('backFromStats'),
  statsOverview: document.getElementById('statsOverview'),
  categoryBreakdown: document.getElementById('categoryBreakdown'),
  recentActivity: document.getElementById('recentActivity'),

  // Celebration
  celebrationOverlay: document.getElementById('celebrationOverlay'),
  celebrationText: document.getElementById('celebrationText')
};

// Current state for swap modal
let currentSwapContext = null;

// Current state for activity detail modal
let currentActivityContext = null;

// Current week offset for week view (0 = current week, -1 = last week, 1 = next week)
let weekViewOffset = 0;

// ============================================
// HEADER RENDERING
// ============================================

function renderHeader() {
  const today = new Date();
  elements.currentDate.textContent = formatDateFriendly(today);

  // Weather placeholder (Phase 2)
  elements.weatherTemp.textContent = '--';
}

// ============================================
// MOTIVATION CARD
// ============================================

async function renderMotivationCard() {
  const streak = await getCurrentStreak();
  const stats = await getCompletionStats(7);
  let message;

  if (stats.daysWithActivity >= 5) {
    // Doing well
    if (streak > 1) {
      message = getStreakMessage(streak);
    } else {
      message = getRandomMessage('morning');
    }
  } else if (stats.daysWithActivity > 0) {
    // Mixed week
    const countdownChance = Math.random();
    if (countdownChance < 0.3) {
      message = getRandomMessage('countdown');
    } else {
      message = getRandomMessage('reengagement');
    }
  } else {
    // Haven't been active
    message = getRandomMessage('countdown');
  }

  elements.motivationText.textContent = message;
}

// ============================================
// DAILY PLAN RENDERING
// ============================================

async function renderDailyPlan() {
  const today = new Date();
  const dateStr = formatDateISO(today);

  // Get or generate today's schedule
  let schedule = await getDailySchedule(dateStr);

  if (!schedule) {
    schedule = await generateDailySchedule(today);
    await saveDailySchedule(dateStr, schedule);
  }

  // Get completions
  const completions = await getCompletionsForDate(dateStr);
  const completedIds = new Set(completions.map(c => c.activityId));

  // Clear existing content
  elements.dailyPlan.innerHTML = '';

  // Render each time block
  const timeBlocks = [
    { key: 'before9am', label: 'Before 9 AM' },
    { key: 'beforeNoon', label: 'Before Noon' },
    { key: 'anytime', label: 'Anytime Today' }
  ];

  for (const block of timeBlocks) {
    const activities = schedule.activities[block.key] || [];

    if (activities.length === 0) continue;

    const blockElement = document.createElement('div');
    blockElement.className = 'time-block fade-in';

    const headerElement = document.createElement('div');
    headerElement.className = 'time-block-header';
    headerElement.textContent = block.label;
    blockElement.appendChild(headerElement);

    for (const activityId of activities) {
      const activity = ACTIVITIES[activityId];
      if (!activity) continue;

      const isCompleted = completedIds.has(activityId);
      const card = createActivityCard(activity, isCompleted, block.key);
      blockElement.appendChild(card);
    }

    elements.dailyPlan.appendChild(blockElement);
  }

  // Update progress
  updateProgress(completedIds.size, getTotalActivitiesCount(schedule));
}

function createActivityCard(activity, isCompleted, timeBlock) {
  const card = document.createElement('div');
  card.className = `activity-card ${isCompleted ? 'completed' : ''}`;
  card.dataset.activityId = activity.id;
  card.dataset.timeBlock = timeBlock;

  // Make card clickable to show details
  card.addEventListener('click', () => {
    openActivityDetail(activity, timeBlock, isCompleted);
  });

  // Checkbox
  const checkbox = document.createElement('div');
  checkbox.className = 'activity-checkbox';
  checkbox.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  `;
  checkbox.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleActivityCompletion(activity.id, timeBlock);
  });

  // Info section
  const info = document.createElement('div');
  info.className = 'activity-info';

  const name = document.createElement('div');
  name.className = 'activity-name';
  name.textContent = activity.name;

  const meta = document.createElement('div');
  meta.className = 'activity-meta';

  const duration = document.createElement('span');
  duration.className = 'activity-duration';
  duration.textContent = formatDuration(activity.duration);

  meta.appendChild(duration);

  // Show pairing hint
  if (activity.pairs_with) {
    const pairHint = document.createElement('span');
    pairHint.className = 'activity-pair-hint';
    const pairedActivity = ACTIVITIES[activity.pairs_with];
    if (pairedActivity) {
      pairHint.textContent = `Pairs with ${pairedActivity.name}`;
    }
    meta.appendChild(pairHint);
  }

  info.appendChild(name);
  info.appendChild(meta);

  // Swap button
  const swapBtn = document.createElement('button');
  swapBtn.className = 'swap-btn';
  swapBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  `;
  swapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSwapModal(activity, timeBlock);
  });

  card.appendChild(checkbox);
  card.appendChild(info);
  card.appendChild(swapBtn);

  return card;
}

function getTotalActivitiesCount(schedule) {
  let count = 0;
  for (const timeBlock in schedule.activities) {
    count += schedule.activities[timeBlock].length;
  }
  return count;
}

// ============================================
// SCHEDULE GENERATION
// ============================================

async function generateDailySchedule(date) {
  const weekPlan = await getCurrentWeekPlan();
  const isProfessionalDay = shouldShowProfessionalGoals(date);

  const schedule = {
    activities: {
      before9am: [],
      beforeNoon: [],
      anytime: []
    }
  };

  // Before 9 AM: Mind-body practice + job follow-up (if weekday)
  if (weekPlan && weekPlan.mindBodyFocus && weekPlan.mindBodyFocus.length > 0) {
    // Use weekly emphasis
    const emphasis = pickRandom(weekPlan.mindBodyFocus);
    schedule.activities.before9am.push(emphasis);
  } else {
    // Default: quick mind-body activity
    const quickActivities = getQuickMindBodyActivities();
    const picked = pickRandom(quickActivities);
    schedule.activities.before9am.push(picked.id);
  }

  if (isProfessionalDay) {
    schedule.activities.before9am.push('job_followup');
  }

  // Before Noon: Physical exercise + education
  // Check if biking is due
  const bikingDue = await isActivityDue('biking');

  if (bikingDue) {
    schedule.activities.beforeNoon.push('biking');
    schedule.activities.beforeNoon.push('dumbbell_presses');
  } else {
    // Could suggest outdoor activity here in Phase 2 with weather
    // For now, maybe a walk
    const outdoorOptions = getOutdoorPhysicalActivities();
    const picked = pickRandom(outdoorOptions);
    schedule.activities.beforeNoon.push(picked.id);
  }

  if (isProfessionalDay) {
    schedule.activities.beforeNoon.push('coursera_module');
  }

  // Anytime: Mindfulness + job search (if weekday)
  schedule.activities.anytime.push('lin_health_activity');

  if (isProfessionalDay) {
    schedule.activities.anytime.push('job_search');
  }

  return schedule;
}

// ============================================
// ACTIVITY COMPLETION
// ============================================

async function toggleActivityCompletion(activityId, timeBlock) {
  const today = formatDateISO(new Date());
  const isCompleted = await isActivityCompleted(today, activityId);

  if (isCompleted) {
    await removeCompletion(today, activityId);
  } else {
    await saveCompletion({
      date: today,
      activityId: activityId,
      timeBlock: timeBlock
    });

    // Show celebration
    showCelebration();
  }

  // Re-render
  await renderDailyPlan();
  await renderMotivationCard();
}

function showCelebration() {
  const messages = MESSAGES.completion;
  const message = pickRandom(messages);

  elements.celebrationText.textContent = message;
  elements.celebrationOverlay.classList.remove('hidden');

  setTimeout(() => {
    elements.celebrationOverlay.classList.add('hidden');
  }, 1500);
}

/**
 * Complete an activity by ID (used by voice guide)
 */
async function completeActivity(activityId) {
  const today = formatDateISO(new Date());
  const isCompleted = await isActivityCompleted(today, activityId);

  if (!isCompleted) {
    await saveCompletion({
      date: today,
      activityId: activityId,
      timeBlock: 'anytime'
    });

    showCelebration();
    await renderDailyPlan();
    await renderMotivationCard();
  }
}

// Make completeActivity available globally for voice guide
window.completeActivity = completeActivity;

// ============================================
// PROGRESS UPDATE
// ============================================

async function updateProgress(completed, total) {
  elements.todayProgress.textContent = `${completed}/${total}`;

  const streak = await getCurrentStreak();
  elements.currentStreak.textContent = streak;
}

// ============================================
// ACTIVITY DETAIL MODAL
// ============================================

function openActivityDetail(activity, timeBlock, isCompleted) {
  currentActivityContext = { activity, timeBlock, isCompleted };

  // Set title
  elements.activityDetailTitle.textContent = activity.name;

  // Set meta info
  const category = CATEGORIES[activity.category];
  elements.activityDetailMeta.innerHTML = `
    <div class="activity-detail-meta-item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>${formatDuration(activity.duration)}</span>
    </div>
    <div class="activity-detail-meta-item">
      <span style="width: 12px; height: 12px; border-radius: 50%; background: ${category.color}; display: inline-block;"></span>
      <span>${category.name}</span>
    </div>
  `;

  // Set video if available
  if (activity.video) {
    const embedUrl = getVideoEmbedUrl(activity.video);
    if (embedUrl) {
      elements.activityDetailVideo.innerHTML = `
        <div class="video-container">
          <iframe src="${embedUrl}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
      `;
      elements.activityDetailVideo.classList.remove('hidden');
    } else {
      elements.activityDetailVideo.classList.add('hidden');
    }
  } else {
    elements.activityDetailVideo.innerHTML = '';
    elements.activityDetailVideo.classList.add('hidden');
  }

  // Set description
  elements.activityDetailDescription.textContent = activity.description;

  // Set instructions
  if (activity.instructions) {
    elements.activityDetailInstructions.innerHTML = activity.instructions;
  } else {
    elements.activityDetailInstructions.innerHTML = '<p style="color: var(--color-text-muted);">No specific instructions for this activity.</p>';
  }

  // Set link if available
  if (activity.link) {
    elements.activityDetailLink.href = activity.link;
    elements.activityDetailLink.classList.remove('hidden');
  } else {
    elements.activityDetailLink.classList.add('hidden');
  }

  // Add Start Guided Exercise button if activity has steps
  const existingVoiceBtn = document.getElementById('activityDetailVoiceGuide');
  if (existingVoiceBtn) {
    existingVoiceBtn.remove();
  }

  if (activity.hasVoiceGuide && activity.steps && activity.steps.length > 0) {
    const voiceBtn = document.createElement('button');
    voiceBtn.id = 'activityDetailVoiceGuide';
    voiceBtn.className = 'btn btn-voice-guide btn-full';
    voiceBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      Start Guided Exercise
    `;
    voiceBtn.addEventListener('click', () => {
      closeActivityDetail();
      if (window.VoiceGuide) {
        window.VoiceGuide.start(activity);
      }
    });

    // Insert after link or instructions
    const modalBody = elements.activityDetailModal.querySelector('.modal-body');
    modalBody.appendChild(voiceBtn);
  }

  // Update complete button text based on status
  if (isCompleted) {
    elements.activityDetailComplete.textContent = 'Mark Incomplete';
    elements.activityDetailComplete.classList.remove('btn-primary');
    elements.activityDetailComplete.classList.add('btn-secondary');
  } else {
    elements.activityDetailComplete.textContent = 'Mark Complete';
    elements.activityDetailComplete.classList.remove('btn-secondary');
    elements.activityDetailComplete.classList.add('btn-primary');
  }

  elements.activityDetailModal.classList.add('visible');
}

/**
 * Convert video URL to embed URL
 * Supports YouTube and Vimeo
 */
function getVideoEmbedUrl(url) {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Already an embed URL
  if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/')) {
    return url;
  }

  return null;
}

function closeActivityDetail() {
  elements.activityDetailModal.classList.remove('visible');
  currentActivityContext = null;
}

async function handleActivityDetailComplete() {
  if (!currentActivityContext) return;

  const { activity, timeBlock } = currentActivityContext;
  closeActivityDetail();
  await toggleActivityCompletion(activity.id, timeBlock);
}

function handleActivityDetailSwap() {
  if (!currentActivityContext) return;

  const { activity, timeBlock } = currentActivityContext;
  closeActivityDetail();
  openSwapModal(activity, timeBlock);
}

// ============================================
// SWAP MODAL
// ============================================

function openSwapModal(activity, timeBlock) {
  currentSwapContext = { activity, timeBlock };

  // Get alternatives from same category
  const alternatives = getActivitiesByCategory(activity.category)
    .filter(a => a.id !== activity.id);

  elements.swapOptions.innerHTML = '';

  for (const alt of alternatives) {
    const option = document.createElement('div');
    option.className = 'swap-option';
    option.innerHTML = `
      <div class="swap-option-name">${alt.name}</div>
      <div class="swap-option-duration">${formatDuration(alt.duration)}</div>
    `;
    option.addEventListener('click', () => {
      swapActivity(alt.id);
    });
    elements.swapOptions.appendChild(option);
  }

  elements.swapModal.classList.add('visible');
}

function closeSwapModal() {
  elements.swapModal.classList.remove('visible');
  currentSwapContext = null;
}

async function swapActivity(newActivityId) {
  if (!currentSwapContext) return;

  const { activity, timeBlock } = currentSwapContext;
  const today = formatDateISO(new Date());

  await swapActivityInSchedule(today, timeBlock, activity.id, newActivityId);

  closeSwapModal();
  await renderDailyPlan();
}

function openCustomActivityModal() {
  closeSwapModal();
  elements.customActivityName.value = '';
  elements.customActivityDuration.value = '';
  elements.customActivityModal.classList.add('visible');
}

function closeCustomActivityModal() {
  elements.customActivityModal.classList.remove('visible');
}

async function saveCustomActivityCompletion() {
  const name = elements.customActivityName.value.trim();
  const duration = parseInt(elements.customActivityDuration.value, 10);

  if (!name || !duration) return;

  const today = formatDateISO(new Date());

  // Save as custom completion
  await saveCompletion({
    date: today,
    activityId: 'custom_' + generateId(),
    customName: name,
    customDuration: duration,
    timeBlock: currentSwapContext?.timeBlock || 'anytime'
  });

  closeCustomActivityModal();
  showCelebration();
  await renderDailyPlan();
}

// ============================================
// WEEKLY PLANNING VIEW
// ============================================

async function showWeeklyPlanView() {
  elements.weeklyPlanView.classList.remove('hidden');

  await renderWeekReview();
  renderEmphasisOptions();
  renderPhysicalSchedule();
}

function hideWeeklyPlanView() {
  elements.weeklyPlanView.classList.add('hidden');
}

async function renderWeekReview() {
  const stats = await getCompletionStats(7);

  elements.weekStats.innerHTML = `
    <div class="week-stat-card">
      <div class="week-stat-value">${stats.total}</div>
      <div class="week-stat-label">Activities Completed</div>
    </div>
    <div class="week-stat-card">
      <div class="week-stat-value">${stats.daysWithActivity}</div>
      <div class="week-stat-label">Active Days</div>
    </div>
  `;
}

function renderEmphasisOptions() {
  const mindBodyActivities = getAllMindBodyActivities();

  elements.emphasisOptions.innerHTML = '';

  for (const activity of mindBodyActivities) {
    const option = document.createElement('div');
    option.className = 'emphasis-option';
    option.dataset.activityId = activity.id;

    option.innerHTML = `
      <div class="emphasis-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="emphasis-info">
        <div class="emphasis-name">${activity.name}</div>
        <div class="emphasis-duration">${formatDuration(activity.duration)}</div>
      </div>
    `;

    option.addEventListener('click', () => {
      toggleEmphasisSelection(option);
    });

    elements.emphasisOptions.appendChild(option);
  }
}

function toggleEmphasisSelection(option) {
  const selectedCount = document.querySelectorAll('.emphasis-option.selected').length;
  const isSelected = option.classList.contains('selected');

  if (!isSelected && selectedCount >= 2) {
    // Max 2 selections
    return;
  }

  option.classList.toggle('selected');
}

function renderPhysicalSchedule() {
  const nextWeek = getWeekDates(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  elements.physicalSchedule.innerHTML = '';

  for (const date of nextWeek) {
    const day = document.createElement('div');
    day.className = 'schedule-day';
    day.dataset.date = formatDateISO(date);

    day.innerHTML = `
      <div class="schedule-day-name">${getShortDayName(date)}</div>
      <div class="schedule-day-date">${getDayNumber(date)}</div>
    `;

    day.addEventListener('click', () => {
      day.classList.toggle('selected');
    });

    elements.physicalSchedule.appendChild(day);
  }
}

async function saveWeeklyPlanData() {
  // Get selected emphasis
  const selectedEmphasis = Array.from(
    document.querySelectorAll('.emphasis-option.selected')
  ).map(el => el.dataset.activityId);

  // Get selected physical days
  const selectedDays = Array.from(
    document.querySelectorAll('.schedule-day.selected')
  ).map(el => el.dataset.date);

  const weekStart = formatDateISO(getWeekStartDate(new Date()));

  await saveWeeklyPlan(weekStart, {
    mindBodyFocus: selectedEmphasis,
    physicalDays: selectedDays
  });

  hideWeeklyPlanView();
}

// ============================================
// WEEK VIEW
// ============================================

async function showWeekView() {
  elements.weekView.classList.remove('hidden');
  await renderWeekView();
}

function hideWeekView() {
  elements.weekView.classList.add('hidden');
}

async function renderWeekView() {
  // Get the week dates based on offset
  const today = new Date();
  const offsetDate = new Date(today);
  offsetDate.setDate(offsetDate.getDate() + (weekViewOffset * 7));

  const weekDates = getWeekDates(offsetDate);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // Update date range display
  const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  elements.weekDateRange.textContent = `${startStr} - ${endStr}`;

  // Render each day
  elements.weekDaysContainer.innerHTML = '';

  for (const date of weekDates) {
    const dayCard = await createWeekDayCard(date, today);
    elements.weekDaysContainer.appendChild(dayCard);
  }
}

async function createWeekDayCard(date, today) {
  const dateStr = formatDateISO(date);
  const isToday = formatDateISO(today) === dateStr;
  const isPast = date < new Date(today.setHours(0, 0, 0, 0));

  // Get or generate schedule for this day
  let schedule = await getDailySchedule(dateStr);
  if (!schedule) {
    schedule = await generateDailySchedule(date);
  }

  // Get completions
  const completions = await getCompletionsForDate(dateStr);
  const completedIds = new Set(completions.map(c => c.activityId));

  // Count total activities
  let totalActivities = 0;
  let allActivityIds = [];
  for (const timeBlock in schedule.activities) {
    totalActivities += schedule.activities[timeBlock].length;
    allActivityIds = allActivityIds.concat(schedule.activities[timeBlock]);
  }

  const completedCount = allActivityIds.filter(id => completedIds.has(id)).length;

  // Create card
  const card = document.createElement('div');
  card.className = `week-day-card ${isToday ? 'today' : ''}`;

  // Header
  const header = document.createElement('div');
  header.className = 'week-day-header';

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[date.getDay()];
  const dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  header.innerHTML = `
    <div class="week-day-info">
      <span class="week-day-name">${dayName}</span>
      <span class="week-day-date">${dateDisplay}</span>
      ${isToday ? '<span class="week-day-badge">Today</span>' : ''}
      ${completedCount === totalActivities && totalActivities > 0 ? '<span class="week-day-badge complete">Done</span>' : ''}
    </div>
    <span class="week-day-progress">${completedCount}/${totalActivities}</span>
  `;

  // Toggle collapse on header click
  header.addEventListener('click', () => {
    activitiesContainer.classList.toggle('collapsed');
  });

  // Activities container
  const activitiesContainer = document.createElement('div');
  activitiesContainer.className = `week-day-activities ${!isToday ? 'collapsed' : ''}`;

  // Add activities
  for (const activityId of allActivityIds) {
    const activity = ACTIVITIES[activityId];
    if (!activity) continue;

    const isCompleted = completedIds.has(activityId);
    const category = CATEGORIES[activity.category];

    const activityItem = document.createElement('div');
    activityItem.className = `week-activity-item ${isCompleted ? 'completed' : ''}`;

    activityItem.innerHTML = `
      <div class="week-activity-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <span class="week-activity-name">${activity.name}</span>
      <span class="week-activity-duration">${formatDuration(activity.duration)}</span>
      <span class="week-activity-category" style="background: ${category.color}"></span>
    `;

    // Click to open detail
    activityItem.addEventListener('click', (e) => {
      e.stopPropagation();
      openActivityDetail(activity, 'anytime', isCompleted);
    });

    activitiesContainer.appendChild(activityItem);
  }

  if (allActivityIds.length === 0) {
    activitiesContainer.innerHTML = '<div style="padding: 12px; color: var(--color-text-muted); text-align: center;">No activities scheduled</div>';
  }

  card.appendChild(header);
  card.appendChild(activitiesContainer);

  return card;
}

// ============================================
// STATS VIEW
// ============================================

async function showStatsView() {
  elements.statsView.classList.remove('hidden');

  await renderStatsOverview();
  await renderCategoryBreakdown();
  await renderRecentActivity();
}

function hideStatsView() {
  elements.statsView.classList.add('hidden');
}

async function renderStatsOverview() {
  const stats = await getCompletionStats(30);
  const streak = await getCurrentStreak();

  elements.statsOverview.innerHTML = `
    <div class="stats-card">
      <div class="stats-card-value">${streak}</div>
      <div class="stats-card-label">Current Streak</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${stats.total}</div>
      <div class="stats-card-label">Last 30 Days</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${stats.daysWithActivity}</div>
      <div class="stats-card-label">Active Days</div>
    </div>
    <div class="stats-card">
      <div class="stats-card-value">${Math.round(stats.total / 30 * 10) / 10}</div>
      <div class="stats-card-label">Avg/Day</div>
    </div>
  `;
}

async function renderCategoryBreakdown() {
  const stats = await getCompletionStats(30);

  let html = '<h3>By Category</h3>';

  for (const [categoryId, count] of Object.entries(stats.byCategory)) {
    const category = CATEGORIES[categoryId];
    if (!category) continue;

    const percentage = Math.round((count / stats.total) * 100) || 0;

    html += `
      <div class="category-bar">
        <div class="category-bar-header">
          <span>${category.name}</span>
          <span>${count}</span>
        </div>
        <div class="category-bar-track">
          <div class="category-bar-fill" style="width: ${percentage}%; background: ${category.color}"></div>
        </div>
      </div>
    `;
  }

  elements.categoryBreakdown.innerHTML = html;
}

async function renderRecentActivity() {
  const completions = await getCompletionsForDateRange(
    formatDateISO(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    formatDateISO(new Date())
  );

  // Sort by date, most recent first
  completions.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  let html = '<h3>Recent Activity</h3>';

  for (const completion of completions.slice(0, 10)) {
    const activity = ACTIVITIES[completion.activityId];
    const name = activity ? activity.name : (completion.customName || 'Custom Activity');

    const date = new Date(completion.completedAt);
    const dateStr = formatDateFriendly(date);

    html += `
      <div class="recent-item">
        <div class="recent-icon">&#10003;</div>
        <div class="recent-info">
          <div class="recent-name">${name}</div>
          <div class="recent-date">${dateStr}</div>
        </div>
      </div>
    `;
  }

  if (completions.length === 0) {
    html += '<p class="text-center" style="color: var(--color-text-muted); padding: 20px;">No recent activity</p>';
  }

  elements.recentActivity.innerHTML = html;
}

// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
  elements.navToday.addEventListener('click', () => {
    setActiveNav('today');
    hideWeekView();
    hideWeeklyPlanView();
    hideStatsView();
  });

  elements.navWeek.addEventListener('click', () => {
    setActiveNav('week');
    weekViewOffset = 0;
    showWeekView();
    hideWeeklyPlanView();
    hideStatsView();
  });

  elements.navPlan.addEventListener('click', () => {
    setActiveNav('plan');
    hideWeekView();
    showWeeklyPlanView();
    hideStatsView();
  });

  elements.navStats.addEventListener('click', () => {
    setActiveNav('stats');
    hideWeekView();
    hideWeeklyPlanView();
    showStatsView();
  });

  // Back buttons
  elements.backFromWeek.addEventListener('click', () => {
    setActiveNav('today');
    hideWeekView();
  });

  elements.backFromPlan.addEventListener('click', () => {
    setActiveNav('today');
    hideWeeklyPlanView();
  });

  elements.backFromStats.addEventListener('click', () => {
    setActiveNav('today');
    hideStatsView();
  });

  // Week navigation
  elements.prevWeek.addEventListener('click', () => {
    weekViewOffset--;
    renderWeekView();
  });

  elements.nextWeek.addEventListener('click', () => {
    weekViewOffset++;
    renderWeekView();
  });

  // Save weekly plan
  elements.saveWeeklyPlan.addEventListener('click', saveWeeklyPlanData);
}

function setActiveNav(view) {
  elements.navToday.classList.toggle('active', view === 'today');
  elements.navWeek.classList.toggle('active', view === 'week');
  elements.navPlan.classList.toggle('active', view === 'plan');
  elements.navStats.classList.toggle('active', view === 'stats');
}

// ============================================
// MODAL EVENT LISTENERS
// ============================================

function setupModalListeners() {
  elements.closeSwapModal.addEventListener('click', closeSwapModal);
  elements.logCustomActivity.addEventListener('click', openCustomActivityModal);

  elements.closeCustomModal.addEventListener('click', closeCustomActivityModal);
  elements.cancelCustomActivity.addEventListener('click', closeCustomActivityModal);
  elements.saveCustomActivity.addEventListener('click', saveCustomActivityCompletion);

  // Activity detail modal
  elements.closeActivityDetail.addEventListener('click', closeActivityDetail);
  elements.activityDetailComplete.addEventListener('click', handleActivityDetailComplete);
  elements.activityDetailSwap.addEventListener('click', handleActivityDetailSwap);

  // Close on overlay click
  elements.swapModal.addEventListener('click', (e) => {
    if (e.target === elements.swapModal) {
      closeSwapModal();
    }
  });

  elements.customActivityModal.addEventListener('click', (e) => {
    if (e.target === elements.customActivityModal) {
      closeCustomActivityModal();
    }
  });

  elements.activityDetailModal.addEventListener('click', (e) => {
    if (e.target === elements.activityDetailModal) {
      closeActivityDetail();
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

function initUI() {
  setupNavigation();
  setupModalListeners();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initUI,
    renderHeader,
    renderMotivationCard,
    renderDailyPlan,
    showCelebration,
    updateProgress,
    showWeeklyPlanView,
    hideWeeklyPlanView,
    showStatsView,
    hideStatsView,
    completeActivity
  };
}
