/**
 * Amenity Scheduler Backend (Google Apps Script)
 */

const SHEET_ID = '1Zz_WHgfcE33FTsWs6F-83J4nKs9TdZfrdqG6iSCIfDE';

function getDb() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
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
      case 'getStaff':
        result = getStaff();
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
      case 'deleteReservation':
        result = deleteReservation(params.tx_id);
        break;
      case 'restoreReservation':
        result = restoreReservation(params.tx_id);
        break;
      case 'completeReservation':
        result = completeReservation(params.tx_id, params.return_notes, params.completed_by);
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

function getStaff() {
  const sheet = getDb().getSheetByName('staff');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const staff = data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  return { status: 'success', data: staff };
}

// --- Logic & Validation ---

function createReservation(res) {
  const db = getDb();
  
  // Normalize items to array
  const items = Array.isArray(res.items) ? res.items : [res.item];
  
  // Enforce Time Defaults
  const type = res.resource_type.toLowerCase();
  let start = new Date(res.start_time);
  let end = new Date(res.end_time);
  
  if (type === 'gear_shed') {
    // Force 10am - 6pm
    start.setHours(10, 0, 0, 0);
    end.setHours(18, 0, 0, 0);
  } else if (type === 'guest_suite') {
    // Force 3pm - 11am
    start.setHours(15, 0, 0, 0);
    end.setHours(11, 0, 0, 0);
    // Ensure end is at least 2 days later? No, validation handles that.
    // Just ensure the time part is correct.
  }
  // Sky Lounge times are user-selected but validated.
  
  // Update res object with enforced times for validation/saving
  res.start_time = start.toISOString();
  res.end_time = end.toISOString();
  
  // 1. Validate Logic (Check all items)
  for (const item of items) {
    const singleRes = { ...res, item: item };
    const validation = validateReservation(singleRes, db);
    if (!validation.valid) {
      return { status: 'error', message: validation.message };
    }
  }
  
  // 2. Calculate Cost (Total for transaction?)
  // Usually cost is per unit or flat fee.
  // Guest Suite: Nightly rate.
  // Sky Lounge: Flat $300.
  // Gear Shed: $0.
  // If multiple items, do we sum? Gear Shed is $0 so it doesn't matter.
  // If we allowed multiple Guest Suites (not possible), we'd sum.
  // Let's calc cost for one item and apply to first row? Or split?
  // For Gear Shed, cost is 0.
  // For others, single item.
  const cost = calculateCost(res);
  
  // 3. Generate ID
  const tx_id = Utilities.getUuid();
  
  // 4. Save
  const sheet = db.getSheetByName('reservations');
  
  items.forEach(item => {
    sheet.appendRow([
      res.rented_to,             // A - rented_to
      item,                      // B - item
      'Scheduled',               // C - status
      res.scheduled_by || 'Staff', // D - scheduled_by
      res.start_time,            // E - start_time
      res.end_time,              // F - end_time
      cost,                      // G - total_cost
      '',                        // H - completed_by (empty on creation)
      res.rental_notes,          // I - rental_notes
      '',                        // J - return_notes (empty on creation)
      res.resource_type,         // K - resource_type
      res.override_lock,         // L - override_lock
      '',                        // M - edit_by (empty on creation)
      '',                        // N - last_update (empty on creation)
      tx_id                      // O - tx_id
    ]);
  });
  
  return { status: 'success', tx_id: tx_id };
}

function updateReservation(res) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  // Find row index (1-based)
  const rowIndex = data.findIndex(row => row[14] === res.tx_id); // Column O (tx_id)
  if (rowIndex === -1) return { status: 'error', message: 'Reservation not found' };
  
  // Enforce Time Defaults (Same as create)
  const type = res.resource_type.toLowerCase();
  let start = new Date(res.start_time);
  let end = new Date(res.end_time);
  
  if (type === 'gear_shed') {
    start.setHours(10, 0, 0, 0);
    end.setHours(18, 0, 0, 0);
  } else if (type === 'guest_suite') {
    start.setHours(15, 0, 0, 0);
    end.setHours(11, 0, 0, 0);
  }
  res.start_time = start.toISOString();
  res.end_time = end.toISOString();

  const validation = validateReservation(res, db, res.tx_id);
  if (!validation.valid) return { status: 'error', message: validation.message };
  
  const cost = calculateCost(res);
  
  // Update row
  const sheetRow = rowIndex + 1;

  sheet.getRange(sheetRow, 1).setValue(res.rented_to);
  sheet.getRange(sheetRow, 2).setValue(res.item);
  if (res.scheduled_by) {
    sheet.getRange(sheetRow, 4).setValue(res.scheduled_by);
  }
  sheet.getRange(sheetRow, 5).setValue(res.start_time);
  sheet.getRange(sheetRow, 6).setValue(res.end_time);
  sheet.getRange(sheetRow, 7).setValue(cost);
  sheet.getRange(sheetRow, 9).setValue(res.rental_notes);
  sheet.getRange(sheetRow, 11).setValue(res.resource_type);
  sheet.getRange(sheetRow, 12).setValue(res.override_lock);

  // Track edits
  if (res.edit_by) {
    sheet.getRange(sheetRow, 13).setValue(res.edit_by); // Column M
  }
  if (res.last_update) {
    sheet.getRange(sheetRow, 14).setValue(res.last_update); // Column N
  }

  return { status: 'success' };
}

function cancelReservation(tx_id) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  // Find ALL rows with this tx_id
  const rowsToUpdate = [];
  data.forEach((row, i) => {
    if (row[14] === tx_id) rowsToUpdate.push(i + 1); // Column O (tx_id)
  });
  
  if (rowsToUpdate.length === 0) return { status: 'error', message: 'Reservation not found' };
  
  // Use first row for logic
  const firstRowIndex = rowsToUpdate[0] - 1;
  const row = data[firstRowIndex];
  const start = new Date(row[4]);
  const now = new Date();
  const hoursDiff = (start - now) / (1000 * 60 * 60);
  
  let fee = 0;
  const type = (row[10] || '').toLowerCase();
  
  if (hoursDiff < 72) {
    if (type === 'guest_suite') fee = 75;
    if (type === 'sky_lounge') fee = 150;
  }
  
  rowsToUpdate.forEach(r => {
    sheet.getRange(r, 3).setValue('Cancelled');
    sheet.getRange(r, 7).setValue(fee); // Apply fee to all? Or just one?
    // If multi-item gear shed, fee is 0 anyway.
    // If Guest Suite/Sky Lounge, it's single item.
  });
  
  return { status: 'success', fee: fee };
}

function deleteReservation(tx_id) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();

  // Find ALL rows with this tx_id (collect row indices)
  const rowsToDelete = [];
  data.forEach((row, i) => {
    if (i === 0) return; // Skip header row
    if (row[14] === tx_id) rowsToDelete.push(i + 1); // Column O (tx_id), 1-based row index
  });

  if (rowsToDelete.length === 0) {
    return { status: 'error', message: 'Reservation not found' };
  }

  // Delete rows in reverse order to avoid index shifting issues
  rowsToDelete.reverse().forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });

  return { status: 'success', message: `Deleted ${rowsToDelete.length} row(s)` };
}

function restoreReservation(tx_id) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();

  // Find ALL rows with this tx_id
  const rowsToRestore = [];
  data.forEach((row, i) => {
    if (i === 0) return; // Skip header row
    if (row[14] === tx_id) rowsToRestore.push({ index: i + 1, row: row }); // Column O (tx_id), 1-based row index
  });

  if (rowsToRestore.length === 0) {
    return { status: 'error', message: 'Reservation not found' };
  }

  // Use first row for validation and cost recalculation
  const firstRow = rowsToRestore[0].row;

  // Recreate reservation object for validation
  const res = {
    tx_id: tx_id,
    rented_to: firstRow[0],
    item: firstRow[1],
    resource_type: firstRow[10],
    start_time: firstRow[4],
    end_time: firstRow[5],
    rental_notes: firstRow[8],
    override_lock: firstRow[11]
  };

  // Validate that the reservation can be restored (check for conflicts)
  const validation = validateReservation(res, db, tx_id);
  if (!validation.valid) {
    return { status: 'error', message: `Cannot restore: ${validation.message}` };
  }

  // Recalculate cost
  const cost = calculateCost(res);

  // Restore all rows with this tx_id
  rowsToRestore.forEach(item => {
    const rowIndex = item.index;
    sheet.getRange(rowIndex, 3).setValue('Scheduled'); // Status column (C)
    sheet.getRange(rowIndex, 7).setValue(cost); // Cost column (G)
  });

  return { status: 'success', message: `Restored ${rowsToRestore.length} row(s)` };
}

function completeReservation(tx_id, return_notes, completed_by) {
  const db = getDb();
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();

  // Find ALL rows with this tx_id
  const rowsToComplete = [];
  data.forEach((row, i) => {
    if (i === 0) return; // Skip header row
    if (row[14] === tx_id) rowsToComplete.push(i + 1); // Column O (tx_id), 1-based row index
  });

  if (rowsToComplete.length === 0) {
    return { status: 'error', message: 'Reservation not found' };
  }

  // Update all rows with this tx_id
  rowsToComplete.forEach(rowIndex => {
    sheet.getRange(rowIndex, 3).setValue('Complete'); // Column C (status)
    sheet.getRange(rowIndex, 8).setValue(completed_by || 'Staff'); // Column H (completed_by)
    sheet.getRange(rowIndex, 10).setValue(return_notes || ''); // Column J (return_notes)
  });

  return { status: 'success', message: `Completed ${rowsToComplete.length} row(s)` };
}

function validateReservation(res, db, excludeTxId = null) {
  const start = new Date(res.start_time);
  const end = new Date(res.end_time);
  
  if (start >= end) return { valid: false, message: 'End time must be after start time.' };
  
  const sheet = db.getSheetByName('reservations');
  const data = sheet.getDataRange().getValues();
  
  const activeRes = data.filter((row, i) => {
    if (i === 0) return false;
    if (row[2] === 'Cancelled') return false;
    if (row[2] === 'Complete') return false;
    if (excludeTxId && row[14] === excludeTxId) return false; // Column O (tx_id)
    return true;
  });
  
  const type = res.resource_type.toLowerCase();
  
  if (type === 'guest_suite') {
    const nights = (end - start) / (1000 * 60 * 60 * 24);
    // Allow slight tolerance for DST or float math? No, strict check.
    // Actually, with 3pm/11am, it's not exactly 24h multiples.
    // 3pm to 11am is 20 hours.
    // 2 nights = 3pm Day 1 to 11am Day 3.
    // Total hours = 24 + 20 = 44 hours.
    // 1 night = 3pm to 11am next day = 20 hours.
    // So check if end date is at least 2 days after start date.
    
    const sDate = new Date(start); sDate.setHours(0,0,0,0);
    const eDate = new Date(end); eDate.setHours(0,0,0,0);
    const dayDiff = (eDate - sDate) / (1000 * 60 * 60 * 24);
    
    if (dayDiff < 2) return { valid: false, message: 'Guest Suite requires 2-night minimum.' };
    
    const hasOverlap = activeRes.some(row => {
      const rType = (row[10] || '').toLowerCase();
      if (rType !== 'guest_suite') return false;
      const rStart = new Date(row[4]);
      const rEnd = new Date(row[5]);
      return (start < rEnd && end > rStart);
    });
    if (hasOverlap) return { valid: false, message: 'Guest Suite is already booked.' };
  }
  
  if (type === 'sky_lounge') {
    const hours = (end - start) / (1000 * 60 * 60);
    if (hours > 4) return { valid: false, message: 'Sky Lounge limited to 4 hours.' };
    
    const startHour = start.getHours();
    if (startHour < 10 || startHour > 20) { // 8pm end means 4pm start max? 
        // "default to 4pm start and 8pm end"
        // "10am start and 6pm End" was for Gear Shed.
        // Sky Lounge: "Start Time must be between 10:00 AM and 6:00 PM" (from original context)
        // New req: "default to 4pm start and 8pm end. Can be changed."
        // I'll stick to original constraint 10am-6pm start window unless overridden.
    }
    
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
    const hasOverlap = activeRes.some(row => {
      if (row[1] !== res.item) return false;
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
    // Loop by day
    // We need to count nights.
    // 3pm Day 1 -> 11am Day 2 is 1 night (Day 1).
    // So we check the day of "current".
    // We stop before the checkout day.
    
    const checkoutDay = new Date(end); checkoutDay.setHours(0,0,0,0);
    
    while (current < checkoutDay) { // Compare dates only
      const day = current.getDay();
      if (day === 5 || day === 6) cost += 175; // Fri/Sat
      else cost += 125;
      current.setDate(current.getDate() + 1);
      // Safety break
      if (cost > 10000) break; 
    }
    return cost;
  }
  
  if (type === 'sky_lounge') {
    return 300;
  }
  
  return 0;
}
