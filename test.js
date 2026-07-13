const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');
console.log("File size:", content.length);
