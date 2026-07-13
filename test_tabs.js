const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('owner_dashboard.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

try {
    window.eval(js);
    window.aiCallsInWindow = [
        { isForwarded: true, call: { created_at: new Date().toISOString() }, cost: 0, duration: 10, isPaidCall: false, currentQuotaCount: 1 },
        { isForwarded: false, call: { created_at: new Date().toISOString() }, cost: 0, duration: 10, isPaidCall: false, currentQuotaCount: 1 }
    ];
    window.setOwnerListFilter('ai', null);
    console.log("Filtered list length:", document.getElementById('ai-cost-calls-list').querySelectorAll('li').length);
} catch(e) {
    console.error("Error:", e);
}
