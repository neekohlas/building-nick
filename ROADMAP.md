# Building Nick - Feature Roadmap

## Overview

This document outlines planned features for the habit tracking app. Features are organized by priority and complexity.

---

## Feature 1: OpenWeather Integration

**Status:** COMPLETE
**Priority:** High (Quick Win)
**Complexity:** Low
**Completed:** January 26, 2026

### Description
Integrate OpenWeather API to display weather forecasts in the Week View and Plan Week View. This helps users make informed decisions about outdoor activities.

### What Was Implemented
- `/app/api/weather/route.ts` - API route with 3-hour caching, supports One Call API 3.0 with fallback to 2.5
- `/app/api/geocode/route.ts` - Geocoding API for city name and zip code lookup
- `/hooks/use-weather.ts` - React hook with helper functions (`getWeatherEmoji`, `formatTemp`, `isBadWeatherForOutdoor`)
- `/components/location-modal.tsx` - Modal for setting weather location manually
- Week View: Weather emoji + high temp shown under each day in the calendar strip, and temp range + precipitation % in the day header
- Plan Week View: Weather shown on each day card in preview step, with amber warning when outdoor activities are scheduled on bad weather days
- Menu View: "Weather Location" setting to enter city/zip or use device location

### Location Priority
1. Cached location from localStorage (persists across sessions)
2. Browser geolocation (prompts for permission)
3. Default fallback (San Francisco)

### Files Modified
- `components/week-view.tsx` - Added weather display
- `components/plan-week-view.tsx` - Added weather display with outdoor activity warnings
- `components/menu-view.tsx` - Added Weather Location menu item

---

## Feature 2: Google Calendar Integration

**Status:** COMPLETE
**Priority:** High
**Complexity:** Medium
**Completed:** January 27, 2026

### Description
Connect to Google Calendar to display calendar events alongside the activity schedule in Today View, Week View, and Plan Week View.

### What Was Implemented
- `/app/api/auth/google/route.ts` - OAuth 2.0 initiation, redirects to Google consent screen
- `/app/api/auth/google/callback/route.ts` - OAuth callback, exchanges code for tokens, stores refresh token in HttpOnly cookie
- `/app/api/auth/google/status/route.ts` - Returns connection status, email, and list of calendars
- `/app/api/auth/google/disconnect/route.ts` - Revokes tokens and clears cookies
- `/app/api/calendar/events/route.ts` - Fetches events from selected calendars with 15-minute server-side caching
- `/hooks/use-calendar.ts` - React hook managing connection state, calendar selection, and events
- `/components/calendar-event-card.tsx` - Event cards (compact and full variants) styled distinctly from activities
- `/components/calendar-settings-modal.tsx` - Modal for managing connection, selecting calendars, and refreshing events
- Today View: Calendar events shown inline in each time block
- Week View: Event count badges in day selector, events listed at top of day detail
- Plan Week View: Event count shown on day cards, events listed when day is expanded in preview
- Menu View: "Google Calendar" menu item to connect or manage settings

### Security Features
- Refresh tokens stored in HttpOnly secure cookies (protected from XSS)
- Access tokens never exposed to client, refreshed server-side
- CSRF protection via state parameter in OAuth flow
- Read-only scope (`calendar.readonly`)

### Calendar Selection
- Users can select which calendars to display
- Preferences saved in localStorage
- All visible calendars shown by default with color coding

### Answers to Open Questions
- **Write back to Google Calendar?** No - kept read-only for v1 (simpler, more secure)
- **Multiple calendar support?** Yes - fetches all user-visible calendars with selection UI
- **Event filtering?** Implemented via calendar selection in settings modal

---

## Feature 3: Heart-Mind-Body Spectrum

**Status:** COMPLETE
**Priority:** Medium
**Complexity:** Low-Medium
**Completed:** January 31, 2026

### Description
Visual triangular radar chart showing the balance of Heart (emotional), Mind (cognitive), and Body (physical) components for each activity.

### What Was Implemented
- `/lib/activities.tsx` - Added `SpectrumScores` interface with heart/mind/body (0-1 each)
- `/components/spectrum-triangle.tsx` - SVG-based triangular radar visualization
- `/app/api/activities/route.ts` - Updated to read Heart/Mind/Body number columns from Notion
- `/hooks/use-activities.ts` - Updated to pass spectrum scores through
- `/components/library-view.tsx` - Shows small spectrum triangle on each activity card
- `/components/activity-detail-modal.tsx` - Shows medium spectrum with labels in modal
- `/scripts/populate-spectrum-scores.ts` - Script to populate initial scores in Notion

### Notion Database Setup
Add three Number columns to the activities database:
- **Heart** (0-1): Emotional/relational content (journaling, gratitude, connection)
- **Mind** (0-1): Cognitive/focus content (education, meditation, planning)
- **Body** (0-1): Movement/physical content (exercises, stretches, outdoor)

### Colors
- Heart: Rose (#F43F5E)
- Mind: Purple (#8B5CF6)
- Body: Emerald (#10B981)

---

## Feature 5: Claude AI Health Coach

**Status:** Not Started
**Priority:** High
**Complexity:** Medium-High

### Description
Integrate Claude AI (free tier) to provide personalized activity suggestions during the Plan Week flow. The AI analyzes recent activity patterns and user feedback to recommend mind-body activities.

### Claude Free Tier Details
- Model: `claude-3-haiku` (fast, cost-effective)
- Free tier: Up to 4,000 API calls/month (should be plenty for personal use)
- Alternative: Claude Sonnet if more reasoning needed

### Implementation Notes
- Trigger during Plan Week View (Step 1 or new dedicated step)
- Gather context: last 2-4 weeks of completions, patterns, streaks
- Ask user: "How have you been feeling?" or "Want to try something different?"
- Suggest 2-3 mind-body activities with brief explanations
- User can accept suggestions or stick with current plan

### User Flow
1. User enters Plan Week View
2. App fetches recent activity history
3. Prompt: "Would you like AI suggestions for this week's mind-body activities?"
4. If yes: Claude analyzes patterns, asks follow-up question about how user is feeling
5. Claude provides personalized recommendations with reasoning
6. User accepts, modifies, or declines suggestions

### Technical Requirements
- Environment variable: `ANTHROPIC_API_KEY`
- API route: `/api/coach/suggest`
- Context window: Summarize 2-4 weeks of activity data
- Prompt engineering for consistent, helpful responses
- Rate limiting to stay within free tier

### Sample Prompt Structure
```
You are a health coach helping someone plan their week.

Recent activity patterns:
- [summary of completions, streaks, variety]

The user wants suggestions for mind-body activities.
Available activities: [list from activities.tsx]

Ask how they've been feeling, then suggest 2-3 activities with brief reasoning.
```

---

## Feature 6: Audio Instruction Mode

**Status:** Not Started
**Priority:** Medium
**Complexity:** High

### Description
Add hands-free audio guidance for activities with step-by-step instructions (e.g., Hargrove movement exercises). The app reads instructions aloud and responds to voice commands.

### Implementation Notes
- Use Web Speech API for text-to-speech (TTS)
- Use Web Speech API for speech recognition (STT)
- Voice commands: "next", "repeat", "back", "pause", "stop"
- Visual indicator for listening state
- Works with existing `instructions` field on activities

### User Flow
1. User opens Activity Detail Modal
2. User taps "Start Audio Mode" button
3. App reads first instruction step aloud
4. Visual: current step highlighted, microphone indicator
5. App pauses and listens for command
6. User says "next" → App reads next step
7. User says "repeat" → App re-reads current step
8. User says "stop" → Exit audio mode

### Technical Requirements
- Parse `instructions` HTML into discrete steps
- Web Speech API: `SpeechSynthesis` for TTS
- Web Speech API: `SpeechRecognition` for STT
- Fallback: manual "Next" / "Repeat" buttons if voice not available
- Consider wake word or always-listening mode

### Supported Commands
| Command | Action |
|---------|--------|
| "next" / "continue" | Advance to next step |
| "repeat" / "again" | Re-read current step |
| "back" / "previous" | Go to previous step |
| "pause" | Stop reading, keep position |
| "stop" / "done" | Exit audio mode |

### Activities to Support Initially
- Hargrove movement exercises (have detailed instructions)
- Breathing exercises
- Meditation guides
- Any activity with multi-step `instructions`

### Browser Compatibility
- Chrome: Full support
- Safari: Partial (may need polyfill)
- Firefox: Limited STT support
- Consider fallback UI for unsupported browsers

---

## Implementation Priority

### Completed Features
1. **OpenWeather Integration** ✓
2. **Google Calendar Integration** ✓
3. **Heart-Mind-Body Spectrum** ✓

### Remaining Features

4. **Claude AI Health Coach** (2-3 sessions)
   - Builds on existing activity data
   - Free tier makes it low-risk
   - Can iterate on prompts over time

5. **Audio Instruction Mode** (3-4 sessions)
   - Most complex (speech APIs)
   - Browser compatibility challenges
   - Can be scoped to subset of activities initially

---

## Technical Notes

### Existing Patterns to Follow
- API routes go in `/app/api/`
- Use environment variables for API keys
- Graceful degradation when integrations unavailable
- IndexedDB for local caching
- Custom hooks for data fetching (see `use-activities.ts`)

### Environment Variables Needed
```env
# Weather
OPENWEATHER_API_KEY=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Claude AI
ANTHROPIC_API_KEY=
```

---

## Notes & Ideas

- Consider a "Settings" view for managing integrations
- Could combine weather + calendar + AI into a "Smart Planning" mode
- Audio mode could eventually support custom activities with user-provided instructions
- Track which AI suggestions users accept vs decline to improve prompts

---

*Last Updated: January 26, 2026*
