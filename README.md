# Amenity Scheduler Tool

A secure, serverless internal Office Amenity Scheduler Tool.

## Setup Instructions

### 1. Google Sheets Setup
1.  Create a new Google Sheet.
2.  Name it **`b85_reservations`**.
3.  Create the following 4 sheets (tabs) with these exact names and headers:

    **Sheet 1: `reservations`**
    - Row 1: `tx_id`, `rented_to`, `item`, `resource_type`, `status`, `scheduled_by`, `start_time`, `end_time`, `total_cost`, `confirmed_by`, `rental_notes`, `return_notes`, `override_lock`

    **Sheet 2: `rentable_items`**
    - Row 1: `item`, `description`, `resource_type`, `service_status`, `service_notes`
    - *Add your inventory items here (e.g., Guest Suite, Sky Lounge, Kayak 1).*

    **Sheet 3: `guest_clean`**
    - Row 1: `clean_date`, `scheduled_by`, `confirmed_by`, `notes`

    **Sheet 4: `staff`**
    - Row 1: `name`

### 2. Google Apps Script (Backend) Setup
1.  In your Google Sheet, go to **Extensions > Apps Script**.
2.  Delete any existing code in `Code.gs`.
3.  Copy the content of `Code.gs` from this project and paste it into the script editor.
4.  (Optional) If you want to hardcode the Sheet ID, replace `YOUR_SHEET_ID_HERE` with the ID from your Sheet's URL. Otherwise, the script attempts to use the active spreadsheet if container-bound.
5.  Click **Deploy > New deployment**.
6.  Select type: **Web app**.
7.  Description: `v1`.
8.  Execute as: **Me**.
9.  Who has access: **Anyone** (This is required for the frontend to access it without complex OAuth flows, but security is handled by the frontend email check and obscurity).
10. Click **Deploy**.
11. **Copy the Web App URL**.

### 3. Frontend Configuration
1.  Open `js/api.js`.
2.  Replace `'YOUR_GAS_WEB_APP_URL'` with the Web App URL you just copied.
3.  Open `index.html`.
4.  Replace `'YOUR_GOOGLE_CLIENT_ID'` with your actual Google Cloud Console Client ID for Sign-In.

### 4. Running the App
1.  You can host the `index.html` and related folders on **GitHub Pages** or any static host.
2.  Or run locally using a simple server (e.g., `python -m http.server` or VS Code Live Server).
3.  Login with `beacon85@greystar.com`.

## Features
- **Guest Suite**: 2-night minimum, no overlap.
- **Sky Lounge**: 4-hour max, 10am-6pm window, all-day lock.
- **Gear Shed**: Inventory tracking.
- **Premium UI**: Modern, responsive design with Dark/Light mode support (via CSS variables).
