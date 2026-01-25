# Building Nick - Product Roadmap

> A personal wellness/productivity PWA that pulls activities from Notion.

---

## Current Status

**Deployment:** Vercel (configured)
**Database:** Notion (31 activities populated)
**Notion Database ID:** `2f34ff735e318012b520fe1dcaab691f`

---

## Phase 1: Core Foundation (COMPLETE)

- [x] PWA setup with service worker
- [x] Basic UI structure (Today, Week, Plan, Stats views)
- [x] Local activity definitions with fallback
- [x] IndexedDB storage for local data
- [x] Activity detail modals with instructions
- [x] Swap activity modal
- [x] Custom activity logging
- [x] Completion celebration overlay
- [x] iOS install instructions
- [x] Header with date display and weather placeholder

---

## Phase 2: Notion Integration (COMPLETE)

- [x] Notion database schema created
- [x] Serverless API endpoint (`/api/notion-activities.js`)
- [x] Frontend fetches activities from Notion
- [x] 31 activities populated across categories:
  - Mind-Body (17 activities)
  - Physical (5 activities)
  - Mindfulness (5 activities)
  - Professional (4 activities)
- [x] Category support: `mind_body`, `physical`, `mindfulness`, `professional`
- [x] Activity properties: Name, Description, Duration, Instructions, Link, Video, Quick, Outdoor, Weather Dependent, Weekday Only

---

## Phase 3: Notifications (COMPLETE)

- [x] OneSignal integration
- [x] Notification permission flow
- [x] Morning reminder concept (7:45 AM)
- [x] Evening preview concept (8:30 PM)
- [x] Only prompt for installed PWA

---

## Phase 4: Weekly Planning (COMPLETE)

- [x] Sunday planning prompt
- [x] Week planning view UI
- [x] Mind-body emphasis selection
- [x] Physical activity scheduling
- [x] Week navigation (prev/next)

---

## Phase 5: Active/Archive Filtering (COMPLETE)

- [x] `Active` checkbox field in Notion schema
- [x] Filter API by `Active === true`
- [ ] Add "Archived" view in settings for reactivation (optional)

---

## Phase 6: Voice-Guided Exercise Feature (TIER 2 - IN PROGRESS)

### Notion Schema Updates
- [x] Add `Steps` field to Notion database (rich text)
- [x] Add `Voice Guidance` checkbox field to control which activities get voice guide
- [x] Populate step-by-step instructions for activities
- [x] API parses numbered markdown into steps array
- [x] API uses `Voice Guidance` checkbox to determine `hasVoiceGuide` flag

### Voice-Guided Component (COMPLETE)
- [x] Create VoiceGuide module (`js/voice-guide.js`)
- [x] Exercise overview screen with "Start Guided Exercise" button
- [x] Step progress indicator
- [x] Current step display
- [x] Voice status indicator (listening/speaking)

### Text-to-Speech (TTS) (COMPLETE)
- [x] Implement Web Speech API for TTS
- [x] Configurable speech rate (~0.9 for exercises)
- [x] Read step aloud on navigation

### Speech Recognition (COMPLETE)
- [x] Implement Web Speech API for recognition
- [x] Continuous listening mode
- [x] Voice command patterns:
  | Command | Aliases | Action |
  |---------|---------|--------|
  | Next | "continue", "go", "next step", "okay", "ok" | Advance to next step |
  | Repeat | "again", "say that again", "what" | Re-read current step |
  | Back | "previous", "go back" | Return to previous step |
  | Pause | "stop", "wait", "hold on", "hold" | Pause reading |
  | Resume | "resume", "go ahead", "start", "play" | Resume after pause |

### Manual Fallback Controls (COMPLETE)
- [x] Next/Back buttons
- [x] Pause/Resume button
- [x] Repeat button
- [x] For environments without speech API support

### Completion Flow (COMPLETE)
- [x] Completion screen after all steps
- [x] Mark activity as complete
- [x] Return to activity list

---

## Phase 7: Weather Integration (PLANNED)

- [ ] Weather API integration
- [ ] Display current weather in header
- [ ] Weather-aware activity suggestions
- [ ] Outdoor activity recommendations based on forecast

---

## Phase 8: Stats & Progress (PLANNED)

- [ ] Stats view implementation
- [ ] Category breakdown visualization
- [ ] Streak tracking
- [ ] Historical activity log
- [ ] Progress charts

---

## Phase 9: Polish & Quality of Life (PLANNED)

- [ ] Improved error handling
- [ ] Offline support improvements
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Dark mode (optional)

---

## Environment Variables (Vercel)

```
NOTION_API_KEY=<secret key for Building Nick integration>
NOTION_DATABASE_ID=2f34ff735e318012b520fe1dcaab691f
```

---

## Source Content Locations (Notion)

| Content | URL |
|---------|-----|
| All Activities | https://www.notion.so/2bc4ff735e318039a18fea532eaaa8b8 |
| Daily Activities | https://www.notion.so/2f24ff735e3180259ad4e9fd9e56ae56 |
| Hargrove Exercises (transcribed) | https://www.notion.so/2f24ff735e3180eba641d51227e7ede3 |
| Activities Database | https://www.notion.so/2f34ff735e318012b520fe1dcaab691f |

---

## Immediate Next Steps (FOR YOU)

1. **Add `Steps` field to Notion database**
   - Go to your Activities database in Notion
   - Add a new property called `Steps` (type: Text/Rich text)
   - Format: Numbered markdown (e.g., "1. Step one\n2. Step two")

2. **Populate Hargrove exercise steps**
   - Copy content from your transcribed Notion page
   - Format as numbered list in the Steps field for each Hargrove exercise
   - Example format:
     ```
     1. Lie down on your back with arms and legs extended.
     2. Relax and sink into the floor.
     3. Notice your contact with the floor.
     ```

3. **Deploy to Vercel**
   - Push changes to trigger deployment
   - The voice-guided feature will be live once Steps data is in Notion

---

## Technical Notes

- **Stack:** Vanilla JS PWA (no React currently)
- **Hosting:** Vercel
- **API:** Vercel serverless functions
- **Storage:** IndexedDB (local), Notion (remote)
- **Notifications:** OneSignal

---

*Last updated: January 2026*
