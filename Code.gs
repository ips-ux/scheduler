/**
 * Amenity Scheduler Backend (Google Apps Script)
 * 
 * Instructions:
 * 1. Open Extensions > Apps Script in your Google Sheet.
 * 2. Paste this code into Code.gs.
 * 3. Deploy as Web App (Execute as: Me, Who has access: Anyone).
 */

const SHEET_ID = '1Zz_WHgfcE33FTsWs6F-83J4nKs9TdZfrdqG6iSCIfDE';

function getDb() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    // Fallback to active if ID fails or for testing
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const params = e.parameter.action ? e.parameter : JSON.parse(e.postData.contents);
    const action = params.action;
    
    let result;
    switch (action) {
      case 'getReservations':
        result = getReservations();
        break;
      case 'getItems':
        result = getItems();
        break;
      case 'createReservation':
        result = createReservation(params.reservation);
        break;
      case 'updateReservation':
        result = updateReservation(params.reservation);
        break;
      case 'cancelReservation':
        result = cancelReservation(params.tx_id);
        break;
      default:
        result = { status: 'error', message: 'Invalid action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- Data Access ---

function getReservations() {
  const sheet = getDb().getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const reservations = data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  
  return { status: 'success', data: reservations };
}

function getItems() {
  const sheet = getDb().getSheetByName('rentable_items');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const items = data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  
  return { status: 'success', data: items };
}

// --- Logic & Validation ---

function createReservation(res) {
  const db = getDb();
  
  // 1. Validate Logic
  const validation = validateReservation(res, db);
  if (!validation.valid) {
    return { status: 'error', message: validation.message };
  }
  
  // 2. Calculate Cost
  const cost = calculateCost(res);
  
  // 3. Generate ID
  const tx_id = Utilities.getUuid();
  
  // 4. Save
  const sheet = db.getSheetByName('reservations');
  
  // Column Mapping based on User Screenshot:
  // A: rented_to, B: item, C: status, D: scheduled_by, E: start_time, F: end_time, 
  // G: total_cost, H: confirmed_by, I: rental_notes, J: return_notes, K: resource_type, 
  // L: override_lock, M: tx_id
  
  sheet.appendRow([
    res.rented_to,      // A
    res.item,           // B
    'Scheduled',        // C
    'Staff',            // D (scheduled_by)
    res.start_time,     // E
    res.end_time,       // F
    cost,               // G
    '',                 // H (confirmed_by)
    res.rental_notes,   // I
    '',                 // J (return_notes)
    res.resource_type,  // K
    res.override_lock,  // L
    tx_id               // M
  ]);
  
  return { status: 'success', tx_id: tx_id };
}

function updateReservation(res) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  // Find row index (1-based)
  // tx_id is in column M (index 12)
  const rowIndex = data.findIndex(row => row[12] === res.tx_id);
  if (rowIndex === -1) return { status: 'error', message: 'Reservation not found' };
  
  const validation = validateReservation(res, db, res.tx_id);
  if (!validation.valid) return { status: 'error', message: validation.message };
  
  const cost = calculateCost(res);
  
  // Update row (rowIndex is 0-based index in data, so +1 for sheet row)
  const sheetRow = rowIndex + 1;
  
  // Update specific columns
  sheet.getRange(sheetRow, 1).setValue(res.rented_to);       // A
  sheet.getRange(sheetRow, 2).setValue(res.item);            // B
  sheet.getRange(sheetRow, 5).setValue(res.start_time);      // E
  sheet.getRange(sheetRow, 6).setValue(res.end_time);        // F
  sheet.getRange(sheetRow, 7).setValue(cost);                // G
  sheet.getRange(sheetRow, 9).setValue(res.rental_notes);    // I
  sheet.getRange(sheetRow, 11).setValue(res.resource_type);  // K
  sheet.getRange(sheetRow, 12).setValue(res.override_lock);  // L
  
  return { status: 'success' };
}

function cancelReservation(tx_id) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  // tx_id is in column M (index 12)
  const rowIndex = data.findIndex(row => row[12] === tx_id);
  if (rowIndex === -1) return { status: 'error', message: 'Reservation not found' };
  
  const row = data[rowIndex];
  const start = new Date(row[4]); // start_time is Col E (index 4)
  const now = new Date();
  const hoursDiff = (start - now) / (1000 * 60 * 60);
  
  let fee = 0;
  const type = row[10]; // resource_type is Col K (index 10)
  
  if (hoursDiff < 72) {
    if (type === 'guest_suite' || type === 'GUEST_SUITE') fee = 75;
    if (type === 'sky_lounge' || type === 'SKY_LOUNGE') fee = 150;
  }
  
  const sheetRow = rowIndex + 1;
  sheet.getRange(sheetRow, 3).setValue('Cancelled'); // status is Col C (3)
  sheet.getRange(sheetRow, 7).setValue(fee);         // total_cost is Col G (7)
  
  return { status: 'success', fee: fee };
}

function validateReservation(res, db, excludeTxId = null) {
  const start = new Date(res.start_time);
  const end = new Date(res.end_time);
  
  if (start >= end) return { valid: false, message: 'End time must be after start time.' };
  
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  // Filter out cancelled/complete and self
  const activeRes = data.filter((row, i) => {
    if (i === 0) return false; // Header
    if (row[2] === 'Cancelled') return false; // status is Col C (index 2)
    if (excludeTxId && row[12] === excludeTxId) return false; // tx_id is Col M (index 12)
    return true;
  });
  
  // Normalize type
  const type = res.resource_type.toLowerCase();
  
  if (type === 'guest_suite') {
    // 2-Night Minimum
    const nights = (end - start) / (1000 * 60 * 60 * 24);
    if (nights < 2) return { valid: false, message: 'Guest Suite requires 2-night minimum.' };
    
    // Overlap
    const hasOverlap = activeRes.some(row => {
      const rType = (row[10] || '').toLowerCase(); // resource_type is Col K (index 10)
      if (rType !== 'guest_suite') return false;
      const rStart = new Date(row[4]); // start_time is Col E (index 4)
      const rEnd = new Date(row[5]);   // end_time is Col F (index 5)
      return (start < rEnd && end > rStart);
    });
    if (hasOverlap) return { valid: false, message: 'Guest Suite is already booked.' };
  }
  
  if (type === 'sky_lounge') {
    // 4 Hour Max
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours > 4) return { valid: false, message: 'Sky Lounge limited to 4 hours.' };
    
    // Time Window 10am-6pm (Start)
    const startHour = start.getHours();
    if (startHour < 10 || startHour > 18) return { valid: false, message: 'Start time must be between 10AM and 6PM.' };
    
    // All Day Lock
    if (!res.override_lock) {
      const dayStr = start.toDateString();
      const hasBookingOnDay = activeRes.some(row => {
        const rType = (row[10] || '').toLowerCase();
        if (rType !== 'sky_lounge') return false;
        const rStart = new Date(row[4]);
        return rStart.toDateString() === dayStr;
      });
      if (hasBookingOnDay) return { valid: false, message: 'Sky Lounge already booked for this day.' };
    }
  }
  
  if (type === 'gear_shed') {
    // Item Availability
    const hasOverlap = activeRes.some(row => {
      if (row[1] !== res.item) return false; // item is Col B (index 1)
      const rStart = new Date(row[4]);
      const rEnd = new Date(row[5]);
      return (start < rEnd && end > rStart);
    });
    if (hasOverlap) return { valid: false, message: `${res.item} is not available.` };
  }
  
  return { valid: true };
}

function calculateCost(res) {
  const start = new Date(res.start_time);
  const type = res.resource_type.toLowerCase();
  
  if (type === 'guest_suite') {
    let cost = 0;
    const end = new Date(res.end_time);
    let current = new Date(start);
    while (current < end) {
      const day = current.getDay();
      if (day === 5 || day === 6) cost += 175; // Fri/Sat
      else cost += 125;
      current.setDate(current.getDate() + 1);
    }
    return cost;
  }
  
  if (type === 'sky_lounge') {
    return 300;
  }
  
  return 0;
}
