# 📝 Project Context & Technical Blueprint: Amenity Scheduler Tool

This document defines the final features, constraints, architecture, and data structure for the internal Office Amenity Scheduler Tool, based on all project discussions and clarifications.

## 1. ⚙️ Architecture & Hosting

The project utilizes a split architecture to achieve a secure, zero-cost, serverless backend.

| Component | Responsibility | Technology | Hosting Environment |
| :--- | :--- | :--- | :--- |
| **Front-end (UI/UX)** | User interface, calendar display, booking forms, login validation, and all interaction logic. | HTML, CSS, JavaScript (Recommended: FullCalendar.io for display) | **GitHub Pages (Static Hosting)** |
| **Backend/API** | Handles all security, logic enforcement, and direct read/write access to Google Sheets. | **Google Apps Script (Web App)** | **Google Servers (Free Serverless)** |
| **Database** | Stores all reservation, inventory, staff, and cleaning data. | **Google Sheets (Single Workbook)** | Google Drive |


## 2. 🔒 Login & Security

Access is strictly limited to one designated Google account. The system is designed to prevent exposure of sensitive credentials on the front-end.

* **Access Email:** `beacon85@greystar.com`.
* **Authentication Flow:** The app launches with a Google Sign-in prompt. Access is granted **only** if the user's logged-in email exactly matches the decoded Admin Email.
* **Email Obfuscation:** The admin email is stored on the front-end using a two-layered obfuscation process (Base64 encoding followed by a Simple Rotation). The email is decoded in the browser before validation.
* **Remember Me:** A successful login sets a persistent session cookie for the user.

## 3. 📊 Data Structure (Google Sheets)

All project data resides in a single Google Workbook named **`b85_reservations`**, containing four distinct sheets (tabs).

### A. `reservations` (Primary Data Store)

| Column Name | Purpose |
| :--- | :--- |
| `tx_id` | Unique ID grouping all items in a single resident transaction (multi-item Gear Shed). |
| `rented_to` | Apartment number of the reserving resident. |
| `item` | The specific item being reserved (e.g., `Kayak 1`, `Guest Suite`). |
| `resource_type` | Links the reservation to the correct logic (`GUEST_SUITE`, `SKY_LOUNGE`, `GEAR_SHED`). **Critical for Logic Enforcement.** |
| `status` | Reservation lifecycle stage (`Scheduled`, `Cancelled`, `Complete`, `Rented`). |
| `scheduled_by` | Staff member who created the booking/entry. |
| `start_time` | Reservation start date and time (ISO 8601). |
| `end_time` | Reservation end date and time (ISO 8601). |
| `total_cost` | Final cost applied (includes fees). |
| `confirmed_by` | Staff member who handled the final check-in/out of the item. |
| `rental_notes` | Notes on reservation/checkout (e.g., Early Check-in request). |
| `return_notes` | Notes on item condition upon return/check-out. |
| `override_lock` | Flag for Sky Lounge double-booking override (`TRUE`/`FALSE`). |

### B. `rentable_items` (Inventory)

* **Constraint:** Contains one row per **unique physical item** (e.g., `Kayak 1` and `Kayak 2` are separate rows).

| Column Name | Purpose |
| :--- | :--- |
| `item` | The unique name of the inventory item. |
| `description` | Detailed description. |
| `resource_type` | Links item to the appropriate logic (`GEAR_SHED`). |
| `service_status` | Operational status (`In Service`, `Not In Service`). |
| `service_notes` | Maintenance notes. |

### C. `guest_clean` (Guest Suite Cleaning Log)

| Column Name | Purpose |
| :--- | :--- |
| `clean_date` | The date the suite was confirmed clean. |
| `scheduled_by` | Staff member who scheduled the cleaning. |
| `confirmed_by` | Staff member who verified the cleaning is complete. |
| `notes` | Any notes regarding the cleaning status. |

### D. `staff` (Staff Roster)

| Column Name | Purpose |
| :--- | :--- |
| `name` | The full name of the authorized staff member. |

## 5. 📝 Resource-Specific Logic & Constraints

The Apps Script API must strictly enforce the following rules.

### A. Guest Suite Logic (The "Hotel" Model)

* **Availability:** Only one reservation can exist at any time (No Overlap).
* **Minimum Stay:** **2-Night Minimum** must be enforced.
* **Static Times:** Check-in is always **3:00 PM**; Check-out is always **11:00 AM**.
* **Cost Calculation (Nightly Rate):**
    * Cost is based on the **night stayed** (Check-in date).
    * **Rates:** $\$125$ for Sun-Thu night; $\$175$ for Fri-Sat night.
* **Cleaning Lock:** A new reservation is **blocked** unless a **`guest_clean`** entry exists *between* the previous reservation's Check-out date and the new Check-in date.
* **Cancellation Fee:** $\$75$ fee if cancellation is made within **72 hours** of `start_time`.
* **Cancellation Display:** The entry **must remain on the calendar**. Update `status` to `Cancelled` and `total_cost` to the applicable fee.

### B. Sky Lounge Logic (The "Blocker" Model)

* **Duration/Fee:** Reservations are **fixed to 4 hours** and a **flat fee of $\$300$**.
* **Time Window:** Start Time must be between **10:00 AM** and **6:00 PM** (to end by 10:00 PM).
* **Cleanliness Lock (All-Day):** Once a booking is confirmed on a specific date, **the entire calendar day** is locked to prevent a second booking.
* **Override:** The **`override_lock`** checkbox bypasses the all-day lock. It requires a **double-verification modal** where staff confirms cleanliness before booking.
* **Cancellation Fee:** $\$150$ fee if cancellation is made within **72 hours** of `start_time`.
* **Cancellation Display:** The entry **must remain on the calendar**. Update `status` to `Cancelled` and `total_cost` to the applicable fee.

### C. Gear Shed Logic (The "Library" Model)

* **Inventory Source:** Inventory comes from the **`rentable_items`** sheet.
* **Multi-Item Booking:** Handled by creating **multiple rows** in the `reservations` sheet, all linked by the same **`tx_id`**.
* **Availability:** An item is unavailable if it has any overlapping `reservations` entry that is not `Cancelled` or `Complete`.
* **Cost:** Fixed at **$\$0.00$** (Resident Amenity).

## 6. 🖥️ UI/UX Quality of Life Requirements

* **View Toggle:** A button to switch between a **Calendar View** and a **List View**.
* **Guest Suite Alert:** A static **Red Notification Bar** must be displayed at the top of the UI if the Guest Suite cleaning check fails (i.e., cleaning is required before the next reservation).
* **Calendar Interactions:**
    * **Tooltips:** Clean, modern tooltips appear on hover over any calendar entry.
    * **Click Modal (Quick-View):** Clicking an entry opens a modal with all reservation details.
        * Allows editing of **`rental_notes`** and **`return_notes`** at any time.
        * **"Edit Reservation" Button:** Allows staff to adjust dates/items, triggering re-validation and cost recalculation by the Apps Script.
        * **"Cancel Reservation" Button:** Triggers a mandatory confirmation modal warning of the applicable cancellation fee.