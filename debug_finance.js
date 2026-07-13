const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('admin_dashboard.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const window = dom.window;

// Extract script
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Mock supabase
window.supabaseClient = {
    from: function(table) {
        return {
            select: function() {
                return {
                    order: function() { return { data: [], error: null }; },
                    gte: function() {
                        return {
                            lt: function() {
                                return {
                                    range: function() {
                                        return {
                                            order: function() {
                                                return { data: [], error: null };
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    then: function(cb) { cb({ data: [], error: null }); return this; }
                }
            }
        };
    }
};

window.alert = console.log;

try {
    eval(script);
    console.log("Script evaluated successfully!");
    
    // Simulate clicking the tab
    window.switchTab('finance', document.createElement('button'));
    
    // Simulate async resolution
    setTimeout(() => {
        console.log("financeTableBody:", document.getElementById('financeTableBody').innerHTML);
    }, 1000);
    
} catch (e) {
    console.error(e);
}
