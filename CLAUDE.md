# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal Office Amenity Scheduler Tool for Beacon 85. A serverless web application that manages reservations for Guest Suite, Sky Lounge, and Gear Shed items. Uses Google Apps Script as a backend API connected to Google Sheets as a database.

## Development Commands

```bash
# Start development server
npm run dev

# Install dependencies (if needed)
npm install
```

## Architecture

### Split Architecture
- **Frontend**: Static HTML/CSS/JS hosted on GitHub Pages (or local dev server)
- **Backend**: Google Apps Script Web App (serverless, deployed at Google)
- **Database**: Google Sheets workbook (`b85_reservations`)

### Key Files

- `index.html` - Main application shell, modals, and UI structure
- `js/app.js` - Primary application logic, calendar, modals, reservations (~1200 lines)
- `js/api.js` - API communication layer with stale-while-revalidate caching
- `js/cache.js` - Hash-based localStorage cache system
- `js/auth.js` - Google Sign-In authentication (restricted to `beacon85@greystar.com`)
- `Code.gs` - Google Apps Script backend (handles all data operations)
- `css/styles.css` - Main stylesheet
- `css/dual-panel.css` - Gear Shed dual-panel transfer list styling

## Google Sheets Database Structure

The backend connects to a single Google Sheets workbook with 4 sheets:

1. **reservations** - Main transaction log
   - Columns: `tx_id`, `rented_to`, `item`, `resource_type`, `status`, `scheduled_by`, `start_time`, `end_time`, `total_cost`, `confirmed_by`, `rental_notes`, `return_notes`, `override_lock`

2. **rentable_items** - Inventory of Gear Shed items
   - Columns: `item`, `description`, `resource_type`, `service_status`, `service_notes`

3. **guest_clean** - Guest Suite cleaning verification log
   - Columns: `clean_date`, `scheduled_by`, `confirmed_by`, `notes`

4. **staff** - Authorized staff roster
   - Column: `name`

## Resource Types and Logic

### GUEST_SUITE
- 2-night minimum stay requirement
- Fixed times: Check-in 3:00 PM, Check-out 11:00 AM
- Pricing: $125 (Sun-Thu), $175 (Fri-Sat) per night
- Single booking at a time (no overlap)
- Cleaning lock: New reservations blocked unless `guest_clean` entry exists between check-out and new check-in
- Cancellation fee: $75 within 72 hours

### SKY_LOUNGE
- Fixed 4-hour duration, $300 flat fee
- Time window: 10:00 AM - 6:00 PM start times only
- All-day lock: Once booked, entire calendar day is blocked
- Override: `override_lock` checkbox bypasses the all-day restriction (requires cleaning verification)
- Cancellation fee: $150 within 72 hours

### GEAR_SHED
- Multi-item selection via dual-panel transfer list
- Items from `rentable_items` sheet (only "In Service" status)
- No cost ($0.00)
- Each item in multi-select creates a separate row, all linked by same `tx_id`
- No overlap allowed per individual item

## Data Flow and Caching

### Stale-While-Revalidate Pattern
The app implements a sophisticated caching strategy in `js/api.js`:

1. On load, returns cached data immediately (instant UI)
2. Simultaneously fetches fresh data in background
3. Compares hash of new data vs cached
4. Only updates UI if data actually changed

This provides near-instant load times while ensuring data freshness.

### Cache Management
- Hash-based validation prevents unnecessary re-renders
- 24-hour expiration on cached data
- Stored in localStorage with keys: `cache_getReservations`, `cache_getItems`

## Frontend Architecture

### Main Components

**App Object** (`js/app.js`)
- Manages FullCalendar instance
- Handles all modal logic (new reservation, edit, view)
- Reservation creation/update/cancellation
- List view rendering and filtering
- Dual-panel Gear Shed selector

**Modal System**
- `#new-reservation-modal` - Multi-step reservation wizard
  - Step 1: Select resource type (Guest Suite, Sky Lounge, Gear Shed)
  - Step 2: Item selection (dual-panel for Gear Shed)
  - Step 3: Date/time picker and apartment number
  - Step 4: Confirmation with cost breakdown
- `#view-reservation-modal` - View/edit existing reservations
- All modals support back navigation and proper state management

**Search and Filtering**
- Search persistence: Query maintained across item moves in Gear Shed
- Search modifiers: `*` (wildcard), `-` (exclusion), `"exact phrase"`
- List view: Real-time search and status filtering

## Google Apps Script Backend

The `Code.gs` file provides these endpoints:
- `getReservations` - Fetch all reservations
- `getItems` - Fetch rentable items inventory
- `createReservation` - Validate and create new reservation(s)
- `updateReservation` - Modify existing reservation
- `cancelReservation` - Apply cancellation fees, update status

All logic enforcement (pricing, availability checks, cleaning locks) happens server-side.

## Authentication

- Single authorized user: `beacon85@greystar.com`
- Google Sign-In integration
- Session persistence via localStorage
- Email validation enforced both client and server-side

## Python Helper Scripts

Several Python scripts exist in the root for one-off migrations/fixes. These are historical and not part of the regular development workflow:
- `add_back_button.py`, `fix_validation.py`, etc.
- Can be safely ignored for normal development

## Common Development Patterns

### Adding a New Modal
1. Add modal HTML structure in `index.html`
2. Create open/close functions in `js/app.js`
3. Add CSS in `css/styles.css`
4. Wire up event handlers in `App.bindEvents()`

### Modifying Reservation Logic
1. Frontend validation in `js/app.js` (quick feedback)
2. Backend enforcement in `Code.gs` (source of truth)
3. Update both to maintain consistency

### Working with the Calendar
- FullCalendar v6.1.10 instance stored in `App.calendar`
- Events generated from `App.reservations` array
- Status-based color coding via `App.getStatusColor()`

## Deployment

### Frontend
1. Push to GitHub
2. GitHub Pages auto-deploys from main branch

### Backend (Google Apps Script)
1. Open Google Sheet `b85_reservations`
2. Extensions > Apps Script
3. Update `Code.gs`
4. Deploy > Manage Deployments > Edit latest version
5. Copy new Web App URL if changed
6. Update `API_URL` in `js/api.js` if needed

## Configuration Requirements

Before deploying:
1. Set `SHEET_ID` in `Code.gs` to your Google Sheet ID
2. Set `API_URL` in `js/api.js` to deployed Google Apps Script Web App URL
3. Set Google OAuth Client ID in `index.html` (line 29)
