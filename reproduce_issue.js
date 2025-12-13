
const sDate = "2023-10-27"; // Friday
const d = new Date(sDate);
console.log(`Input: ${sDate}`);
console.log(`UTC String: ${d.toUTCString()}`);
console.log(`Local String: ${d.toString()}`);
console.log(`getDay() (Local): ${d.getDay()}`);
console.log(`getUTCDay() (UTC): ${d.getUTCDay()}`);

// Simulation of the loop
let current = new Date(sDate);
const end = new Date("2023-10-30"); // Monday

console.log("\nLooping:");
while (current < end) {
    const day = current.getUTCDay();
    const utcDay = current.getUTCDay();
    console.log(`Date: ${current.toISOString().split('T')[0]}, Local Day: ${day}, UTC Day: ${utcDay}`);
    current.setDate(current.getDate() + 1);
}
