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
Visual indicator showing the balance of Heart (emotional), Mind (cognitive), and Body (physical) components for each activity.

### What Was Implemented
- `/lib/activities.tsx` - Added `SpectrumScores` interface with heart/mind/body (0-1 each)
- `/components/spectrum-bar.tsx` - Horizontal gradient bar with repeating icon patterns
- `/app/api/activities/route.ts` - Updated to read Heart/Mind/Body number columns from Notion
- `/hooks/use-activities.ts` - Updated to pass spectrum scores through
- Activity cards: Spectrum bar at top showing colored segments with embedded icons
- Activity detail modal: Larger spectrum bar at top
- Library view: Spectrum bar on each activity card
- Plan week view: Spectrum bar on activity cards

### Spectrum Bar Design
- Horizontal gradient bar with smooth transitions between color segments
- Repeating icon pattern within each segment (heart, lightbulb, dumbbell)
- Segments sorted by value (largest first/leftmost)
- Icons rendered in semi-transparent white for contrast
- Dimensions below 0.2 threshold are hidden

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

## Feature 4: Claude AI Health Coach

**Status:** COMPLETE
**Priority:** High
**Complexity:** Medium-High
**Completed:** January 29, 2026

### Description
Integrate Claude AI to provide personalized activity suggestions during the Plan Week flow. The AI analyzes recent activity patterns and user feedback to recommend mind-body activities.

### What Was Implemented
- `/app/api/coach/suggest/route.ts` - API route that calls Claude with activity context
- `/components/plan-week-view.tsx` - "Get AI Suggestions" button in Step 1 (Mind-Body selection)
- `/components/ai-suggestions-modal.tsx` - Modal displaying AI recommendations with accept/dismiss actions
- Context gathering: Recent completions, current week's plan, available activities
- Personalized suggestions with reasoning for each recommendation

### User Flow
1. User enters Plan Week View Step 1 (Mind-Body Activities)
2. User taps "Get AI Suggestions" button
3. App gathers context (recent history, available activities)
4. Claude analyzes patterns and provides 2-3 recommendations
5. User can accept suggestions (adds to plan) or dismiss

### Technical Details
- Model: Claude 3 Haiku (fast, cost-effective)
- Environment variable: `ANTHROPIC_API_KEY`
- Prompt includes activity metadata, recent completion history, and Heart-Mind-Body spectrum data

---

## Feature 5: Audio Instruction Mode

**Status:** COMPLETE
**Priority:** Medium
**Complexity:** High
**Completed:** January 30, 2026

### Description
Hands-free audio guidance for activities with step-by-step instructions. The app reads instructions aloud using high-quality TTS and responds to voice commands.

### What Was Implemented
- `/app/api/tts/route.ts` - ElevenLabs TTS API integration for natural-sounding voice
- `/hooks/use-audio-instructions.ts` - State machine for audio mode (speaking, listening, paused)
- `/components/audio-instructions-overlay.tsx` - Full-screen overlay with step display and controls
- `/app/api/audio-command/route.ts` - Claude-powered voice command interpretation
- Activity detail modal: "Start Audio Guide" button for activities with multi-step instructions
- Visual indicators: Current step, progress, speaking/listening state
- Manual fallback buttons: Next, Repeat, Back, Stop

### Voice Commands (via Claude interpretation)
| Command | Action |
|---------|--------|
| "next" / "continue" / "go on" | Advance to next step |
| "repeat" / "again" / "say that again" | Re-read current step |
| "back" / "previous" / "go back" | Go to previous step |
| "pause" / "wait" | Stop reading, keep position |
| "stop" / "done" / "exit" | Exit audio mode |

### Technical Details
- TTS: ElevenLabs API with Rachel voice (natural, clear)
- STT: Web Speech API (SpeechRecognition)
- Command parsing: Claude interprets natural language commands
- Environment variable: `ELEVENLABS_API_KEY`

### Browser Compatibility
- Chrome: Full support (TTS + STT)
- Safari: TTS works, STT partial
- Firefox: TTS works, STT limited
- Fallback: Manual buttons always available

---

## Feature 6: Advanced AI Health Coach (Voice Agent)

**Status:** Not Started
**Priority:** High
**Complexity:** Very High

### Description
A conversational voice agent that users can talk to naturally. The agent can discuss how you're feeling, suggest activities based on the conversation, and take actions like opening and launching activities.

### Planned Capabilities

**Conversational Interface:**
- Open the agent from anywhere in the app (floating button or menu item)
- Natural back-and-forth conversation about how you're feeling
- Agent remembers context within the session
- Warm, supportive coaching tone

**Activity Suggestions:**
- Proactively suggests activities based on conversation
- Explains why each suggestion might help
- Can browse and describe activities from the library
- Considers recent history, time of day, and user preferences

**Action Taking:**
- "Let's do that one" → Opens activity detail modal
- "Start the audio guide" → Launches audio instruction mode
- "Add this to my plan" → Adds activity to today's schedule
- "What's on my schedule?" → Reads today's activities
- "Mark that as complete" → Completes the current activity

### User Flow Example
1. User taps "Talk to Coach" button
2. Agent: "Hey! How are you feeling today?"
3. User: "I'm feeling a bit stressed and tight in my shoulders"
4. Agent: "I hear you. Stress can really build up in the body. I have a few ideas that might help..."
5. Agent suggests 2-3 activities with brief explanations
6. User: "The shoulder stretches sound good"
7. Agent: "Great choice! Want me to start the audio guide for that?"
8. User: "Yes please"
9. Agent opens the activity and starts audio mode

### Technical Requirements
- Real-time speech-to-speech (or near real-time TTS + STT)
- Claude for conversation and reasoning
- Tool use / function calling for app actions
- Session state management
- Interrupt handling (user can speak mid-response)

### Implementation Options

**Option A: Turn-based (Simpler)**
- User speaks → transcribed → Claude responds → TTS plays
- Clear turn-taking, easier to implement
- Slight latency between turns

**Option B: Streaming (More Natural)**
- Real-time transcription as user speaks
- Claude streams response, TTS plays chunks
- More complex but feels more conversational

### Available Actions (Tool Definitions)
```
- open_activity(activity_id) - Opens activity detail modal
- start_audio_guide(activity_id) - Launches audio instruction mode
- add_to_schedule(activity_id, time_block) - Adds to today's plan
- mark_complete(activity_id) - Marks activity as done
- get_schedule(date) - Returns activities for a date
- get_activity_suggestions(mood, needs) - Gets personalized suggestions
- search_activities(query) - Searches activity library
```

### Context to Provide Claude
- User's recent activity history (last 2 weeks)
- Today's schedule and completion status
- Current time and time block
- Weather (for outdoor activity suggestions)
- Available activities with descriptions and spectrum scores

### UI Considerations
- Floating action button or dedicated "Coach" tab
- Full-screen overlay when active
- Visual feedback for listening/speaking states
- Transcript display (optional, for accessibility)
- "Type instead" fallback for quiet environments

### Privacy & Data
- Conversations not stored long-term (session only)
- No audio recordings saved
- Activity data stays local (not sent to external services except Claude API)

---

## Implementation Priority

### Completed Features
1. **OpenWeather Integration** ✓
2. **Google Calendar Integration** ✓
3. **Heart-Mind-Body Spectrum** ✓
4. **Claude AI Health Coach** ✓
5. **Audio Instruction Mode** ✓

### Remaining Features

6. **Advanced AI Health Coach (Voice Agent)** (4-6 sessions)
   - Most ambitious feature
   - Builds on existing audio and AI infrastructure
   - Could start with turn-based and evolve to streaming
   - Consider starting with text chat, then adding voice

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

# ElevenLabs TTS
ELEVENLABS_API_KEY=
```

---

## Notes & Ideas

- Consider a "Settings" view for managing integrations
- Voice agent could eventually support custom activities with user-provided instructions
- Track which AI suggestions users accept vs decline to improve prompts
- Voice agent could integrate with calendar to help plan around meetings

---

## Feature 7: Multi-User Support

**Status:** Foundation Complete (Single-User Mode Active)
**Priority:** Low (Future Enhancement)
**Complexity:** Medium

### Current Architecture (Single User)

The app currently uses a simple password-based authentication system with cloud sync via Supabase. All data syncs to a single "default user" in Supabase, identified by a fixed UUID.

**How It Works:**
1. User enters `APP_PASSWORD` to access the app
2. All data (completions, schedules, plan configs) syncs to Supabase
3. Data is tagged with `NEXT_PUBLIC_DEFAULT_USER_ID` (a fixed UUID)
4. IndexedDB serves as local cache; Supabase is the cloud backup

**Key Files:**
- `lib/supabase.ts` - Supabase client setup
- `lib/sync-service.ts` - Sync logic using fixed user ID
- `hooks/use-sync.ts` - React hook wrapping storage with sync
- `hooks/use-auth.tsx` - Auth context (minimal for single-user)

### Migration to Multi-User

To support multiple users (e.g., pre-approved friends/family), the following changes would be needed:

#### Phase 1: User Identity via Google OAuth

**Goal:** Each user has their own Supabase identity, data isolated via RLS.

**1.1 Enable Supabase Google OAuth**
- Already configured in Supabase project (Google provider)
- OAuth callback route exists at `/auth/callback`

**1.2 Modify Login Flow**
```
Current:  Password → App access (fixed user ID for all data)
New:      Password → App access → Google sign-in prompt → User's Supabase ID
```

**Files to modify:**
- `app/login/page.tsx` - Add "Continue with Google" after password verification
- `hooks/use-auth.tsx` - Expose `signInWithGoogle()`, track real Supabase user
- `lib/sync-service.ts` - Use `user.id` from Supabase auth instead of `DEFAULT_USER_ID`
- `hooks/use-sync.ts` - Pass real user ID to sync functions

**1.3 Update Sync Service**
```typescript
// Current (single user):
const userId = process.env.NEXT_PUBLIC_DEFAULT_USER_ID

// Multi-user:
const { data: { user } } = await supabase.auth.getUser()
const userId = user?.id
```

#### Phase 2: Per-User Password (Optional)

If you want different passwords for different users:

**Option A: Password per Google Account**
- Store allowed email → password mapping in Supabase `allowed_users` table
- After Google sign-in, verify their email is in allowed list
- Each user has their own password

```sql
CREATE TABLE public.allowed_users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Option B: Invite Codes**
- Generate unique invite codes
- User enters invite code + sets up Google account
- Code is single-use, ties to their Google identity

**Option C: Keep Single Password (Recommended for Small Groups)**
- Keep `APP_PASSWORD` as the gate for everyone
- Google sign-in differentiates users after they're "inside"
- Simplest approach for trusted users (family/friends)

#### Phase 3: Data Migration

When transitioning from single-user to multi-user:

**Step 1: Sign in with your Google account first**

**Step 2: Migrate existing data to your real user ID**
```sql
-- Run in Supabase SQL Editor after you sign in with Google
-- Replace 'your-new-google-user-id' with your actual Supabase user ID
-- Replace 'old-fixed-uuid' with your NEXT_PUBLIC_DEFAULT_USER_ID value

UPDATE completions
SET user_id = 'your-new-google-user-id'
WHERE user_id = 'old-fixed-uuid';

UPDATE schedules
SET user_id = 'your-new-google-user-id'
WHERE user_id = 'old-fixed-uuid';

UPDATE saved_plan_configs
SET user_id = 'your-new-google-user-id'
WHERE user_id = 'old-fixed-uuid';
```

**Step 3: Remove DEFAULT_USER_ID from environment**
- Delete `NEXT_PUBLIC_DEFAULT_USER_ID` from Vercel environment variables

**Step 4: Update sync service to require real user**
```typescript
// In lib/sync-service.ts, remove the fallback:
// Before:
const userId = user?.id || process.env.NEXT_PUBLIC_DEFAULT_USER_ID

// After:
if (!user?.id) {
  throw new Error('User must be authenticated to sync')
}
const userId = user.id
```

#### Phase 4: User Management UI (Optional)

For managing who can access the app:

- Admin view to see all users
- Ability to invite new users (generate invite links)
- Revoke access
- View per-user statistics

### Environment Variables

**Current (Single User):**
```env
APP_PASSWORD=your-password
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_DEFAULT_USER_ID=a-fixed-uuid-for-single-user
```

**Future (Multi-User):**
```env
APP_PASSWORD=your-password  # Keep as gate, or remove for per-user passwords
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
# No DEFAULT_USER_ID - uses real Supabase auth user IDs
```

### Implementation Checklist

**Single User (Current) ✓**
- [x] Supabase tables with RLS policies
- [x] Fixed user ID for all data (`DEFAULT_USER_ID`)
- [x] Password protects app access
- [x] Cloud sync works automatically after password login
- [x] IndexedDB as local cache

**Multi-User (Future)**
- [ ] Add Google sign-in prompt after password (in `use-auth.tsx`)
- [ ] Remove `DEFAULT_USER_ID` fallback in sync service
- [ ] Migrate existing data to real user ID (SQL script)
- [ ] Test RLS isolation between users
- [ ] (Optional) Per-user passwords via `allowed_users` table
- [ ] (Optional) User management UI

### Notes

- Supabase RLS policies already enforce `user_id = auth.uid()`, so multi-user isolation is built-in once real user IDs are used
- The password gate (`APP_PASSWORD`) can remain as an extra layer even with multi-user
- Google Calendar integration is separate from Supabase auth - each user would need to connect their own calendar
- The migration is non-destructive; you can test multi-user on a branch first

---

*Last Updated: February 1, 2026*
