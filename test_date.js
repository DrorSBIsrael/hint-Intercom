const dayMs = 24 * 60 * 60 * 1000;
let maxD = new Date();
let startWin = new Date(maxD.getTime() - 30 * dayMs);
let endWin = maxD;

const graphData = {};
let currentDay = new Date(startWin);
const limitDay = new Date(Math.min(endWin.getTime(), new Date().getTime()));
limitDay.setHours(23, 59, 59, 999);

let count = 0;
while (currentDay <= limitDay) {
    const dayKey = currentDay.getFullYear() + '-' + String(currentDay.getMonth() + 1).padStart(2, '0') + '-' + String(currentDay.getDate()).padStart(2, '0');
    graphData[dayKey] = { freeCalls: 0, paidCalls: 0 };
    currentDay.setDate(currentDay.getDate() + 1);
    count++;
}
console.log("Count:", count);
console.log("Keys:", Object.keys(graphData));
