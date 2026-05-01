// ==========================================
// 📦 1. REQUIRES
// ==========================================
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

// ==========================================
// 🔑 2. CONFIGURATION
// ==========================================
const app = express();

// Parse JSON for all routes EXCEPT Stripe webhook (which needs raw body)
app.use((req, res, next) => {
    if (req.path === '/webhook/stripe') return next();
    bodyParser.json()(req, res, next);
});

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = "1124375407418121";
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "JpressoSophia2026";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY || "";
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const ACTIVE_MODEL = "claude-sonnet-4-6";

// 🎯 BOSS + WORKFLOW
const BOSS_PHONE = "60122393232";
const pendingDrafts = new Map();
const approvedPosts = [];
const userSessions = new Map();
const recentAlerts = new Map();

// 🛒 ORDER ENGINE
const pendingOrders = new Map(); // phone -> { items, total, created }

// 🧠 CUSTOMER MEMORY CACHE
const customerMemoryCache = new Map(); // phone -> { name, orderHistory, ... }

// ==========================================
// 💰 COST TRACKING CONFIG (API BUDGET ALERTS)
// ==========================================
const COST_CONFIG = {
    INPUT_COST_PER_1M: 3.00,
    OUTPUT_COST_PER_1M: 15.00,
    USD_TO_MYR: 4.75,
    DAILY_WARNING: 20.00,
    DAILY_CRITICAL: 50.00,
    MONTHLY_BUDGET: 250.00,
    DAILY_HARD_CAP: 80.00,
    MONTHLY_HARD_CAP: 400.00,
};

const dailyUsage = {
    date: new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
    calls: 0, inputTokens: 0, outputTokens: 0,
    costUSD: 0, costMYR: 0, warningsSent: {},
    capOverride: false, blockedCalls: 0
};

const monthlyUsage = {
    month: new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', month: 'long', year: 'numeric' }),
    calls: 0, costMYR: 0
};

// 📸 SUPABASE
const SUPABASE_URL = process.env.SUPABASE_URL || "https://sbzyflkamsifcksqluwc.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_BASE = `${SUPABASE_URL}/storage/v1/object/public/jpresso-marketing/jpresso-photos`;
const SUPABASE_API = `${SUPABASE_URL}/storage/v1/object/list/jpresso-marketing`;

// 🔗 CHANNELS
const RETAIL_URL = "https://bloomdaily.io/subscribe.html";
const SHOPEE_URL = "https://shopee.com.my/jpresso.my";

// ==========================================
// 📷 3. PHOTO LIBRARY — AUTO-DISCOVERY SYSTEM
// ==========================================
let PHOTO_LIBRARY = [];

const PHOTO_FOLDERS = ["sophia", "sophia-jason", "products", "roasting", "brewing", "cafe", "lifestyle"];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function autoTagPhoto(folder, filename) {
    const lowerName = filename.toLowerCase().replace(/[-_.]/g, ' ');
    const tags = new Set();
    const themes = new Set();

    const folderDefaults = {
        "sophia": { tags: ["sophia"], themes: ["sophia_speaks"] },
        "sophia-jason": { tags: ["sophia", "jason", "duo"], themes: ["founders_story"] },
        "products": { tags: ["product"], themes: ["product_showcase"] },
        "roasting": { tags: ["roastery"], themes: ["roasting_craft", "authority"] },
        "brewing": { tags: ["brewing"], themes: ["brewing_craft"] },
        "cafe": { tags: ["cafe"], themes: ["cafe_atmosphere"] },
        "lifestyle": { tags: ["lifestyle"], themes: ["lifestyle", "customer_story"] }
    };

    const defaults = folderDefaults[folder] || { tags: [], themes: [] };
    defaults.tags.forEach(t => tags.add(t));
    defaults.themes.forEach(t => themes.add(t));

    const keywordMap = {
        "portrait": { tags: ["portrait", "greeting"], themes: ["welcome"] },
        "cafe": { tags: ["cafe", "drinking"], themes: ["sophia_drinks", "recommendation"] },
        "barista": { tags: ["barista", "brewing"], themes: ["sophia_brews", "technique"] },
        "roaster": { tags: ["roaster"], themes: ["sophia_roasts", "craft_story"] },
        "roastery": { tags: ["roastery"], themes: ["sophia_roasts", "craft_story", "behind_scenes"] },
        "street": { tags: ["lifestyle", "KL"], themes: ["sophia_lifestyle"] },
        "office": { tags: ["office"], themes: ["sophia_works"] },
        "knitwear": { tags: ["casual"], themes: ["sophia_lifestyle"] },
        "swiss": { tags: ["travel"], themes: ["coffee_travel"] },
        "santorini": { tags: ["travel"], themes: ["coffee_travel"] },
        "seaside": { tags: ["duo"], themes: ["founders_story"] },
        "jason": { tags: ["jason", "founder"], themes: ["founders_story", "authority"] },
        "klcc": { tags: ["KL", "KLCC"], themes: ["KL_pride"] },
        "coat": { tags: ["founder"], themes: ["founders_story", "authority"] },
        "moon": { tags: ["moon_white", "bestseller", "espresso", "latte", "dark_roast"], themes: ["bestseller"] },
        "phoenix": { tags: ["phoenix_das", "premium", "caramel"], themes: ["premium"] },
        "babydas": { tags: ["babydas", "floral"], themes: ["product_showcase"] },
        "sunrise_dreamer": { tags: ["sunrise_dreamer", "hazelnut"], themes: ["premium"] },
        "sunrise_walker": { tags: ["sunrise_walker", "floral", "berry", "filter"], themes: ["filter_focused"] },
        "emerald": { tags: ["emerald_white", "dark_chocolate"], themes: ["premium"] },
        "platinum": { tags: ["platinum_sunrise", "premium"], themes: ["premium"] },
        "cham": { tags: ["cham_velvet", "cocoa"], themes: ["premium"] },
        "yirgacheffe": { tags: ["ethiopia", "yirgacheffe", "single_origin", "floral"], themes: ["single_origin"] },
        "aricha": { tags: ["aricha", "bergamot"], themes: [] },
        "amederaro": { tags: ["amederaro", "jasmine"], themes: [] },
        "brazil": { tags: ["brazil", "nutty", "chocolate"], themes: ["single_origin"] },
        "mandheling": { tags: ["mandheling", "indonesia", "earthy"], themes: ["single_origin"] },
        "colombia": { tags: ["colombia", "balanced"], themes: ["single_origin"] },
        "guatemala": { tags: ["guatemala", "spice"], themes: ["single_origin"] },
        "kerinci": { tags: ["kerinci", "sumatra", "indonesia"], themes: ["single_origin"] },
        "lekempti": { tags: ["ethiopia", "lekempti", "berry"], themes: ["single_origin"] },
        "salvador": { tags: ["el_salvador", "la_fany", "honey"], themes: ["single_origin"] },
        "la_fan": { tags: ["la_fany"], themes: ["single_origin"] },
        "coffee_bag": { tags: ["bag", "product"], themes: ["product_showcase"] },
        "garanti": { tags: ["garanti", "roaster"], themes: ["roasting_craft", "authority"] },
        "santoker": { tags: ["santoker", "air_roaster"], themes: ["roasting_craft", "authority"] },
        "meraki": { tags: ["meraki", "espresso_machine"], themes: ["equipment_sales"] },
        "roasted_bean": { tags: ["beans", "roasted"], themes: ["bean_showcase"] },
        "latteart": { tags: ["latte_art", "latte", "milk"], themes: ["brewing_craft", "aspirational"] },
        "latte": { tags: ["latte", "milk"], themes: ["brewing_craft"] },
        "pourover": { tags: ["pourover", "v60", "filter"], themes: ["filter_focused"] },
        "station": { tags: ["station"], themes: ["cafe_atmosphere"] },
        "visiting": { tags: ["visiting"], themes: ["customer_story"] },
        "ordering": { tags: ["ordering"], themes: ["customer_story"] },
        "drink": { tags: ["drinking"], themes: ["customer_story"] }
    };

    for (const [keyword, data] of Object.entries(keywordMap)) {
        if (lowerName.includes(keyword)) {
            data.tags.forEach(t => tags.add(t));
            data.themes.forEach(t => themes.add(t));
        }
    }

    return { tags: Array.from(tags), themes: Array.from(themes) };
}

async function scanSupabaseFolder(folder) {
    try {
        const response = await fetch(SUPABASE_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify({
                prefix: `jpresso-photos/${folder}`,
                limit: 100, offset: 0,
                sortBy: { column: "name", order: "asc" }
            })
        });

        if (!response.ok) {
            console.error(`❌ Supabase scan failed for /${folder}: ${response.status}`);
            return [];
        }

        const files = await response.json();
        if (!Array.isArray(files)) return [];

        return files
            .filter(f => f.name && IMAGE_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)))
            .map(f => f.name);
    } catch (err) {
        console.error(`❌ Error scanning /${folder}:`, err.message);
        return [];
    }
}

async function refreshPhotoLibrary() {
    console.log("🔍 Scanning Supabase for photos...");
    const newLibrary = [];

    for (const folder of PHOTO_FOLDERS) {
        const files = await scanSupabaseFolder(folder);
        console.log(`  /${folder}: ${files.length} images found`);

        for (const filename of files) {
            const filepath = `${folder}/${filename}`;
            const { tags, themes } = autoTagPhoto(folder, filename);
            newLibrary.push({
                file: filepath, tags, themes,
                url: `${SUPABASE_BASE}/${encodeURI(filepath)}`
            });
        }
    }

    if (newLibrary.length > 0) {
        PHOTO_LIBRARY = newLibrary;
        console.log(`✅ Photo Library refreshed: ${PHOTO_LIBRARY.length} assets indexed`);
    } else {
        console.error("⚠️ No photos found — keeping existing library");
    }
    return PHOTO_LIBRARY.length;
}

refreshPhotoLibrary().catch(err => console.error("❌ Initial photo scan failed:", err.message));
setInterval(() => { refreshPhotoLibrary().catch(err => console.error("❌ Photo refresh failed:", err.message)); }, 6 * 60 * 60 * 1000);


// ==========================================
// 🧠 4. CUSTOMER MEMORY (Supabase-backed)
// ==========================================
async function loadCustomerMemory(phone) {
    if (customerMemoryCache.has(phone)) return customerMemoryCache.get(phone);

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/customer_memory?phone=eq.${phone}&select=*`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.length > 0) {
                const mem = data[0];
                const parsed = {
                    name: mem.customer_name || null,
                    phone, orderHistory: JSON.parse(mem.order_history || '[]'),
                    preferences: JSON.parse(mem.preferences || '{}'),
                    totalSpent: mem.total_spent || 0,
                    lastOrderDate: mem.last_order_date || null,
                    conversationCount: mem.conversation_count || 0,
                    firstSeen: mem.first_seen || new Date().toISOString(),
                    notes: mem.notes || '',
                    tags: JSON.parse(mem.tags || '[]'),
                    lastInteraction: mem.last_interaction || new Date().toISOString()
                };
                customerMemoryCache.set(phone, parsed);
                return parsed;
            }
        }
    } catch (err) {
        console.error(`🧠 Memory load failed for ${phone}:`, err.message);
    }

    const newMem = {
        name: null, phone, orderHistory: [], preferences: {},
        totalSpent: 0, lastOrderDate: null, conversationCount: 0,
        firstSeen: new Date().toISOString(), notes: '', tags: [],
        lastInteraction: new Date().toISOString()
    };
    customerMemoryCache.set(phone, newMem);
    return newMem;
}

async function saveCustomerMemory(phone) {
    const mem = customerMemoryCache.get(phone);
    if (!mem) return;

    try {
        await fetch(`${SUPABASE_URL}/rest/v1/customer_memory`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
                phone, customer_name: mem.name,
                order_history: JSON.stringify(mem.orderHistory),
                preferences: JSON.stringify(mem.preferences),
                total_spent: mem.totalSpent, last_order_date: mem.lastOrderDate,
                conversation_count: mem.conversationCount, first_seen: mem.firstSeen,
                notes: mem.notes, tags: JSON.stringify(mem.tags),
                last_interaction: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error(`🧠 Memory save failed for ${phone}:`, err.message);
    }
}


// ==========================================
// ☕ 5. JPRESSO KNOWLEDGE BASE
// ==========================================
const JPRESSO_PRODUCTS = `
=============================================================
=== JPRESSO IDENTITY ===
=============================================================
- Big Jpresso Sdn Bhd, Kuala Lumpur
- 15 Years of Roasting Physics. Chief Coffee Officer (CCO) led.
- Infrastructure: Has Garanti 5kg (Drum), Santoker (Air Roaster), Bideli 1kg
- Fresh-to-Order. 48-hour roasting cycle.
- Featured on bloomdaily.io — Malaysia's curated specialty coffee platform (alongside LewisGene & Richman)
- IMPORTANT: Sophia only sells JPRESSO ROASTERY beans. LewisGene beans are also on bloomdaily.io but sold separately — do NOT recommend them.

=============================================================
=== RETAIL: bloomdaily.io ONLY (NEVER mention Shopee) ===
=============================================================
URL: https://bloomdaily.io/subscribe.html
Shipping: Rates vary by location — check at checkout

🎯 SIZE STRATEGY (Weber's Law — ALWAYS LEAD WITH 500g):
- 500g saves ~RM 8-17 vs buying 2x 250g
- 500g = "The Smart Choice" for anyone drinking coffee 3+ times/week
- 250g is for "first-time trial" or "gift" framing only

=== SIGNATURE BLENDS ===

MOON WHITE BLEND (BESTSELLER)
- 250g: RM 40  |  500g: RM 70  (save RM 10)
- Notes: Smooth, milk chocolate, caramel, clean finish
- Roast: Medium Dark  |  Brew: Espresso at 93°C or drip

PHOENIX DAS BLEND (PREMIUM)
- 250g: RM 49  |  500g: RM 86  (save RM 12)
- Notes: Bold, rich, dark chocolate, caramel, full body
- Roast: Medium Dark  |  Brew: Espresso 18g:36g at 93°C

CHAM VELVET BLEND
- 250g: RM 48  |  500g: RM 84  (save RM 12)
- Notes: Velvety, cocoa, brown sugar, silky mouthfeel

EMERALD WHITE BLEND
- 250g: RM 48  |  500g: RM 84  (save RM 12)
- Notes: Complex, fruity, dark chocolate undertones

BABYDAS BLEND
- 250g: RM 38  |  500g: RM 66  (save RM 10)
- Notes: Balanced, sweet, smooth, everyday comfort

SUNRISE WALKER BLEND
- 250g: RM 43  |  500g: RM 75  (save RM 11)
- Notes: Bright, fruity, balanced, morning cup

SUNRISE DREAMER BLEND
- 250g: RM 40  |  500g: RM 70  (save RM 10)
- Notes: Rich, bold, cocoa, toasted almond

=== SINGLE ORIGINS — EVERYDAY ===

BRAZIL SANTOS (Medium — DARK available)
- 250g: RM 35  |  500g: RM 61  (save RM 9)

BRAZIL CERRADO (Medium — DARK available)
- 250g: RM 35  |  500g: RM 61

MANDHELING G1 (Indonesia — DARK available)
- 250g: RM 35  |  500g: RM 61

COLOMBIA SUPREMO (LIGHT / MEDIUM / DARK)
- 250g: RM 38  |  500g: RM 66  (save RM 10)

GUATEMALA ANTIGUA (LIGHT / MEDIUM)
- 250g: RM 40  |  500g: RM 70  (save RM 10)

=== SINGLE ORIGINS — SPECIALTY ===

GUATEMALA HUEHUETENANGO — 250g: RM 42  |  500g: RM 74
ETHIOPIA LEKEMPTI (Natural) — 250g: RM 44  |  500g: RM 77
ETHIOPIA YIRGACHEFFE ARICHA — 250g: RM 71  |  500g: RM 124
ETHIOPIA YIRGACHEFFE AMEDERARO — 250g: RM 71  |  500g: RM 124
EL SALVADOR LA FANY — 250g: RM 57  |  500g: RM 100
INDONESIA SUMATRA MOUNT KERINCI — 250g: RM 66  |  500g: RM 116
  (4 processes: Full Washed, Honey, Natural, Semi Washed — each Medium or Dark)

=== WHOLESALE (10kg min) ===
Section A — Single Origin: RM 80/kg (Mandheling)
Section B — Signature Blends: RM 85/kg (Moon White, Brazil Cerrado, Cham Velvet)
Section C — Premium: Sunrise Dreamer RM 90/kg, Emerald White RM 90/kg, Phoenix Das RM 95/kg

=== OEM: RM 15/kg (5kg min) ===
=== EQUIPMENT: Timemore C5 Pro RM 430 | Black Mirror Scale RM 199/259 | V60 Set RM 138-158 | Meraki Espresso Machine RM 8,599 ===
`;


// ==========================================
// 👑 6. BOSS MODE — Personal Assistant via WhatsApp
// ==========================================
const BOSS_COMMAND_PATTERNS = [
    { regex: /lead(s)?\s*(report|update|status|summary|today|this week)/i, handler: 'leadReport' },
    { regex: /cron\s*(status|log|report|history|today)/i, handler: 'cronReport' },
    { regex: /(revenue|sales)\s*(report|today|this week|this month)/i, handler: 'revenueReport' },
    { regex: /batch\s*(log|report|today|latest)/i, handler: 'batchReport' },
    { regex: /customer(s)?\s*(list|report|new|recent)/i, handler: 'customerReport' },
    { regex: /pipeline\s*(status|report|funnel)/i, handler: 'pipelineReport' },
    { regex: /(inventory|stock)\s*(check|status|level|report)/i, handler: 'inventoryReport' },
    { regex: /(coffee|market)\s*(news|trend|price|update)/i, handler: 'marketNews' },
    { regex: /how many lead/i, handler: 'leadReport' },
    { regex: /what.*(lead|pipeline|funnel)/i, handler: 'pipelineReport' },
    { regex: /any.*(hot|new)\s*lead/i, handler: 'leadReport' },
    { regex: /daily\s*(intel|briefing|report|update)/i, handler: 'dailyIntel' },
    { regex: /morning\s*(report|briefing|update)/i, handler: 'dailyIntel' },
    { regex: /what.*(happen|new|update).*today/i, handler: 'dailyIntel' },
    { regex: /today.*(report|update|brief)/i, handler: 'dailyIntel' },
    { regex: /(send|show|give).*(catalogue|catalog|product list|price list|menu)/i, handler: 'sendCatalogue' },
    { regex: /catalogue|catalog/i, handler: 'sendCatalogue' },
    { regex: /(send|show|give).*(academy|barista|course|module)/i, handler: 'sendAcademy' },
    { regex: /module\s*\d/i, handler: 'sendModule' },
    { regex: /(marketing|draft|caption|social media|ig|instagram|fb|facebook)\s*(draft|post|content|caption|idea)?/i, handler: 'generateDrafts' },
    { regex: /retry\s*(draft|marketing|post)?/i, handler: 'generateDrafts' },
    { regex: /3\s*draft/i, handler: 'generateDrafts' },
];

async function handleBossMode(messageText) {
    const upperText = messageText.trim().toUpperCase();

    // Existing boss commands (USAGE, RESCAN, RESET COST, etc.) are handled in webhook before reaching here
    // This handles the NEW personal assistant commands

    for (const pattern of BOSS_COMMAND_PATTERNS) {
        if (pattern.regex.test(messageText.trim())) {
            return await executeBossCommand(pattern.handler, messageText);
        }
    }

    // No pattern matched — use AI as general assistant
    return await bossAIChat(messageText);
}

async function executeBossCommand(handler, message) {
    switch (handler) {
        case 'leadReport': return await supabaseReport('leads', `📊 LEAD INTELLIGENCE\n━━━━━━━━━━━━━━━`, qry => qry + '?select=*&order=created_at.desc&limit=20', data => {
            const hot = data.filter(l => (l.priority_score || 0) >= 7);
            const contacted = data.filter(l => l.contacted);
            const responded = data.filter(l => l.response_received);
            const converted = data.filter(l => l.converted);
            let r = `Total (last 20): ${data.length}\n🔥 Hot (7+): ${hot.length}\n📨 Contacted: ${contacted.length}\n💬 Responded: ${responded.length}\n✅ Converted: ${converted.length}`;
            if (hot.length > 0) {
                r += `\n\n━━ TOP HOT LEADS ━━`;
                for (const h of hot.slice(0, 5)) {
                    r += `\n• ${h.business_name || 'Unknown'} (${h.location || '—'}) — ${h.priority_score}/10`;
                    if (h.phone && h.phone !== 'Not found - needs manual lookup' && h.phone !== 'N/A') r += `\n  📞 ${h.phone}`;
                    else r += `\n  📞 No phone yet`;
                }
            }
            return r;
        });

        case 'cronReport': return await supabaseReport('cron_logs', `🤖 CRON AGENT STATUS\n━━━━━━━━━━━━━━━`, qry => qry + '?select=*&order=run_date.desc&limit=7', data => {
            let r = '';
            for (const log of data) {
                const s = log.status === 'success' ? '✅' : '❌';
                r += `${s} ${log.run_date} — ${log.target_area}\n   Leads: ${log.leads_found} | Hot: ${log.hot_leads} | ${log.duration_seconds || '—'}s\n`;
                if (log.error_message) r += `   ⚠️ ${log.error_message}\n`;
            }
            return r;
        });

        case 'revenueReport': return await supabaseReport('leads', `💰 REVENUE REPORT\n━━━━━━━━━━━━━━━`, qry => qry + '?select=monthly_revenue,converted,location&converted=eq.true', data => {
            const totalRev = data.reduce((s, l) => s + (l.monthly_revenue || 0), 0);
            let r = `✅ Converted: ${data.length}\n💵 Monthly: RM ${totalRev.toLocaleString()}\n📈 Annual: RM ${(totalRev * 12).toLocaleString()}`;
            const byArea = {};
            for (const c of data) { const a = c.location || 'Unknown'; byArea[a] = (byArea[a] || 0) + (c.monthly_revenue || 0); }
            if (Object.keys(byArea).length > 0) {
                r += `\n\n━━ BY AREA ━━`;
                for (const [area, rev] of Object.entries(byArea).sort((a, b) => b[1] - a[1])) r += `\n• ${area}: RM ${rev.toLocaleString()}/mo`;
            }
            return r;
        });

        case 'batchReport': return await supabaseReport('roast_logs', `🔥 LATEST BATCHES\n━━━━━━━━━━━━━━━`, qry => qry + '?select=*&order=created_at.desc&limit=5', data => {
            let r = '';
            for (const b of data) {
                r += `☕ ${b.sku || 'Unknown'} — ${b.batch_id || ''}\n`;
                r += `   Date: ${(b.created_at || '').slice(0, 10)}\n`;
                r += `   Green: ${b.green_kg || '—'}kg → Roasted: ${b.roasted_kg || '—'}kg\n`;
                if (b.operator) r += `   Operator: ${b.operator}\n`;
                if (b.notes) r += `   Notes: ${b.notes}\n`;
                r += `\n`;
            }
            return r;
        });

        case 'customerReport': return await supabaseReport('customer_memory', `👥 RECENT CUSTOMERS\n━━━━━━━━━━━━━━━`, qry => qry + '?select=*&order=last_interaction.desc&limit=10', data => {
            let r = '';
            for (const c of data) {
                r += `• ${c.customer_name || 'Unknown'} (+${c.phone})\n  Convos: ${c.conversation_count || 0} | Spent: RM ${c.total_spent || 0}\n`;
                if (c.last_order_date) r += `  Last order: ${c.last_order_date}\n`;
            }
            return r;
        });

        case 'pipelineReport': return await supabaseReport('leads', `📊 PIPELINE FUNNEL\n━━━━━━━━━━━━━━━`, qry => qry + '?select=contacted,response_received,converted,not_interested', data => {
            const t = data.length;
            const c = data.filter(l => l.contacted).length;
            const resp = data.filter(l => l.response_received).length;
            const conv = data.filter(l => l.converted).length;
            const dead = data.filter(l => l.not_interested).length;
            const cr = t > 0 ? ((c / t) * 100).toFixed(0) : 0;
            const rr = c > 0 ? ((resp / c) * 100).toFixed(0) : 0;
            const clr = resp > 0 ? ((conv / resp) * 100).toFixed(0) : 0;
            return `${t} Total → ${c} Contacted (${cr}%) → ${resp} Responded (${rr}%) → ${conv} Converted (${clr}%)\n\n🆕 New: ${t - c - dead}\n📨 Contacted: ${c}\n💬 Responded: ${resp}\n✅ Converted: ${conv}\n❌ Dead: ${dead}`;
        });

        case 'inventoryReport': return await supabaseReport('inventory', `📦 GREEN BEAN STOCK\n━━━━━━━━━━━━━━━`, qry => qry + '?select=*&sku=not.ilike.*Roasted*&order=bean_name.asc', data => {
            let r = '';
            for (const i of data) {
                const stock = parseFloat(i.stock_kg || 0).toFixed(1);
                const warn = parseFloat(stock) < 5 ? ' ⚠️ LOW' : '';
                r += `☕ ${i.bean_name}: ${stock}kg${warn}\n`;
            }
            return r;
        });

        case 'marketNews': return await bossAIChat("Give me the latest specialty coffee market news and trends relevant to a Malaysian roastery. Be concise.");

        case 'dailyIntel': return await buildDailyIntel();

        case 'sendCatalogue': {
            const doc = DOCUMENT_LIBRARY.catalogue;
            await sendWhatsAppDocument(BOSS_PHONE, doc.url, doc.filename, doc.caption);
            return "📄 Sending you the Jpresso Coffee Catalogue 2026, Boss!";
        }

        case 'sendAcademy': {
            await sendWhatsAppMessage(BOSS_PHONE, ACADEMY_INFO);
            const sample = DOCUMENT_LIBRARY.academy_1_1;
            await sendWhatsAppDocument(BOSS_PHONE, sample.url, sample.filename, "📚 Sample — Module 1.1: Anatomy of Bean & Terroir");
            return "📚 Academy overview + sample module sent!";
        }

        case 'sendModule': {
            const moduleMatch = message.match(/module\s*(\d+)[\.\s]*(\d+)?/i);
            if (moduleMatch) {
                const phase = moduleMatch[1];
                const mod = moduleMatch[2] || '1';
                const key = `academy_${phase}_${mod}`;
                const doc = DOCUMENT_LIBRARY[key];
                if (doc && doc.url) {
                    await sendWhatsAppDocument(BOSS_PHONE, doc.url, doc.filename, doc.caption);
                    return `📚 Sending ${doc.filename}!`;
                }
            }
            return "Module not found. Available: 1.1-1.4, 2.1-2.4, 3.1-3.3";
        }

        case 'generateDrafts': {
            await sendWhatsAppMessage(BOSS_PHONE, "🎨 Generating 3 fresh marketing drafts... 30 seconds.");
            try {
                const drafts = await generateThreeDrafts();
                await sendDraftsToBoss(drafts);
                return null; // sendDraftsToBoss already sends the message
            } catch (err) {
                return `❌ Draft generation failed: ${err.message}`;
            }
        }

        default: return await bossAIChat(message);
    }
}

// Generic Supabase report helper
async function supabaseReport(table, header, buildQuery, formatData) {
    try {
        const url = buildQuery(`${SUPABASE_URL}/rest/v1/${table}`);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        const data = await res.json();
        if (!data || !Array.isArray(data) || data.length === 0) return `${header}\n\nNo data found yet.`;
        return `${header}\n\n${formatData(data)}`;
    } catch (err) {
        return `${header}\n\n❌ Failed: ${err.message}`;
    }
}

async function buildDailyIntel() {
    const today = new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let report = `📋 DAILY INTEL BRIEFING\n${today}\n━━━━━━━━━━━━━━━\n`;

    try {
        // Latest cron run
        const cronRes = await fetch(`${SUPABASE_URL}/rest/v1/cron_logs?select=*&order=run_date.desc&limit=1`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        const cronData = await cronRes.json();
        if (cronData.length > 0) {
            const c = cronData[0];
            report += `\n🤖 AGENT RUN: ${c.target_area}\n`;
            report += `   Leads: ${c.leads_found} | Hot: ${c.hot_leads} | ${c.status === 'success' ? '✅' : '❌'}\n`;
        }

        // Today's hot leads
        const leadsRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=business_name,location,phone,priority_score&priority_score=gte.7&order=created_at.desc&limit=5`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        const leadsData = await leadsRes.json();
        if (leadsData.length > 0) {
            report += `\n🔥 TOP HOT LEADS:\n`;
            for (const l of leadsData) {
                report += `• ${l.business_name} (${l.location || '—'}) — ${l.priority_score}/10\n`;
                if (l.phone && l.phone !== 'Not found - needs manual lookup') report += `  📞 ${l.phone}\n`;
            }
        }

        // Pipeline summary
        const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=contacted,response_received,converted,not_interested`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        const pipeData = await pipeRes.json();
        if (pipeData.length > 0) {
            const total = pipeData.length;
            const contacted = pipeData.filter(l => l.contacted).length;
            const responded = pipeData.filter(l => l.response_received).length;
            const converted = pipeData.filter(l => l.converted).length;
            report += `\n📊 PIPELINE: ${total} total → ${contacted} contacted → ${responded} responded → ${converted} converted\n`;
        }

        // Green bean stock warnings
        const stockRes = await fetch(`${SUPABASE_URL}/rest/v1/inventory?select=bean_name,stock_kg&sku=not.ilike.*Roasted*&stock_kg=lt.5&order=stock_kg.asc`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
        });
        const stockData = await stockRes.json();
        if (stockData.length > 0) {
            report += `\n⚠️ LOW STOCK:\n`;
            for (const s of stockData) {
                report += `• ${s.bean_name}: ${parseFloat(s.stock_kg).toFixed(1)}kg\n`;
            }
        }

        // Cost today
        report += `\n💰 API: RM ${dailyUsage.costMYR.toFixed(2)} today | RM ${monthlyUsage.costMYR.toFixed(2)} month\n`;

        report += `\n━━━━━━━━━━━━━━━\nFull details: roastery-os.onrender.com`;
        return report;

    } catch (err) {
        return report + `\n❌ Error building intel: ${err.message}`;
    }
}

async function bossAIChat(message) {
    // Before using AI, try to detect if Boss is asking for data
    const dataKeywords = /(lead|cron|revenue|sales|batch|customer|pipeline|inventory|stock|report|status|how many|show me|give me|what)/i;
    if (dataKeywords.test(message)) {
        // Try matching more loosely
        if (/lead/i.test(message)) return await executeBossCommand('leadReport', message);
        if (/cron/i.test(message)) return await executeBossCommand('cronReport', message);
        if (/revenue|sales/i.test(message)) return await executeBossCommand('revenueReport', message);
        if (/batch|roast/i.test(message)) return await executeBossCommand('batchReport', message);
        if (/customer/i.test(message)) return await executeBossCommand('customerReport', message);
        if (/pipeline|funnel|conversion/i.test(message)) return await executeBossCommand('pipelineReport', message);
        if (/inventory|stock/i.test(message)) return await executeBossCommand('inventoryReport', message);
        if (/daily|briefing|morning|today.*update/i.test(message)) return await executeBossCommand('dailyIntel', message);
    }

    try {
        const msg = await anthropic.messages.create({
            model: ACTIVE_MODEL,
            max_tokens: 1000,
            system: `You are Sophia, Jason's personal AI business partner for Big Jpresso Sdn Bhd (specialty coffee roastery, KL).
Call Jason "Boss". Be smart, concise, proactive. Plain text only (WhatsApp format). No markdown.
Keep responses scannable. Current date: ${new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}.

IMPORTANT: You have access to real business data. If Boss asks for any reports or data, tell him the exact command to use:
- "lead report" → pipeline status from Supabase
- "cron status" → autonomous agent run history
- "revenue report" → converted customer revenue
- "batch report" → latest roasting logs
- "customer report" → recent WhatsApp customers
- "pipeline report" → conversion funnel
- "inventory status" → bean stock levels
- "market news" → coffee industry trends
- USAGE → API cost tracking

Do NOT make up data. If he asks for numbers, tell him the command to get real data.

Business context: Big Jpresso roasts specialty beans, sells via bloomdaily.io, wholesale to cafes, runs Jpresso Academy.`,
            messages: [{ role: "user", content: message }]
        });

        if (msg.usage) await trackAPIUsage(msg.usage.input_tokens || 0, msg.usage.output_tokens || 0, "boss_mode");
        return msg.content[0].text;
    } catch (err) {
        return `Sorry Boss, AI error: ${err.message}`;
    }
}


// ==========================================
// 🧠 7. SOPHIA SYSTEM PROMPT (Customer-facing)
// ==========================================
const SOPHIA_SYSTEM_PROMPT = `
You are Sophia — AI Assistant, Product Marketing Lead, Coffee Knowledge Authority, and Brand Ambassador of Big Jpresso Sdn Bhd.

CRITICAL: You MUST respond in STRICT JSON format for EVERY reply. Nothing before, nothing after.

Output schema:
{
  "reply": "Your natural conversational reply",
  "confidence": <integer 1-10>,
  "alert_type": "NONE" | "ORDER_PLACED" | "LOW_CONFIDENCE" | "COMPLAINT" | "ESCALATION",
  "alert_details": "If alert_type is not NONE, summarize for Boss Jason.",
  "customer_name_detected": null,
  "order_intent": null,
  "reorder_suggestion": null,
  "tags": []
}

=== NEW FIELDS (use these!) ===
- customer_name_detected: If customer mentions their name, capture it (string or null)
- order_intent: When customer wants to order, set to {"items": [{"name": "Moon White", "weight": "500g", "qty": 1}]}
- reorder_suggestion: For returning customers, suggest what they ordered before (string or null)
- tags: Classify the inquiry e.g. ["wholesale"], ["retail", "order"], ["gift_box"], ["complaint"]

=== CUSTOMER MEMORY CONTEXT ===
{CUSTOMER_MEMORY}

=== ALERT TRIGGERS ===
- ORDER_PLACED: Customer confirms wholesale/OEM order
- LOW_CONFIDENCE: Unfamiliar question, confidence ≤ 5
- COMPLAINT: Angry/refund/"this is terrible"
- ESCALATION: Customer asks for Jason/owner/"real person"

=== VOICE RULES ===
- First-person. You ARE Sophia. Call customers "Boss"
- Warm, confident, Chief Coffee Officer energy
- LANGUAGE: Reply in the same language the customer uses (Malay/English/Mandarin)

=== CHANNEL ROUTING ===
📦 RETAIL → bloomdaily.io: ${RETAIL_URL} (NEVER mention Shopee unless asked)
☕ WHOLESALE (10kg+) → Quote tier pricing, take order via WhatsApp
🏭 OEM → RM 15/kg, 5kg min

=== 500g UPSELL (Weber's Law) ===
ALWAYS lead with 500g. Frame 250g as "first-time trial" only.

=== ORDER FLOW ===
When customer wants to order:
1. Confirm items, quantities, weights
2. Set order_intent with structured items
3. Sophia will auto-generate order summary + payment link

=== DOCUMENT SENDING (AUTO) ===
Sophia auto-sends PDFs when customers ask. Just respond naturally — the server handles the file delivery:
- "What beans do you have?" / "catalogue" / "product list" → Product Catalogue PDF sent automatically
- "Barista course?" / "academy" / "coffee course" → Academy overview + sample module sent automatically
- "Module 1.1" / specific module name → That specific module PDF sent automatically
You do NOT need to provide download links. Just mention that you're sending the document and it will arrive.

Available Academy Modules:

FREE BARISTA COURSE (send to anyone who asks):
Phase 1: 1.1 Bean & Terroir, 1.2 Water Chemistry, 1.3 Grind Dynamics, 1.4 Advanced Espresso
Phase 2: 2.1 Milk Chemistry, 2.2 Latte Art, 2.3 Barista Ergonomics, 2.4 Equipment Maintenance
Phase 3: 3.1 Roaster's Perspective, 3.2 Pour-Over Methodologies, 3.3 Sensory Analysis & Cupping

ROASTING MASTERCLASS (separate paid course): RM 2,888 (includes on-site hands-on training at our roastery)
- For roasting masterclass inquiries, escalate to Boss Jason

REMEMBER: Response MUST be valid JSON starting with { and ending with }. No markdown fences.
`;


// ==========================================
// 🛡️ 8. META VERIFICATION
// ==========================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED!');
            return res.status(200).send(challenge);
        }
        return res.sendStatus(403);
    }
    return res.sendStatus(400);
});


// ==========================================
// 📥 9. RECEIVE INCOMING MESSAGES
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        const receivedAt = new Date().toISOString();

        // Silence status callbacks
        if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
            console.log(`📬 [${receivedAt}] WA status callback (ignored)`);
            return res.sendStatus(200);
        }
        if (body.entry?.[0]?.messaging?.[0]?.read || body.entry?.[0]?.messaging?.[0]?.delivery) {
            console.log(`📬 [${receivedAt}] IG status callback (ignored)`);
            return res.sendStatus(200);
        }

        console.log(`\n📬 [${receivedAt}] INCOMING MESSAGE:`, JSON.stringify(body, null, 2));

        // ── WHATSAPP ──
        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const senderName = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Unknown";
                const messageText = webhook_event.text?.body || "No text";

                console.log(`📥 [WhatsApp] ${senderName} (+${senderNumber}): "${messageText}"`);

                // ══════════════════════════════════════
                // 👑 BOSS COMMANDS (existing + new)
                // ══════════════════════════════════════
                if (senderNumber === BOSS_PHONE) {
                    const upperText = messageText.trim().toUpperCase();

                    // RESCAN photos
                    if (upperText === 'RESCAN' || upperText === 'REFRESH PHOTOS') {
                        await sendWhatsAppMessage(BOSS_PHONE, "🔍 Scanning Supabase for photos...");
                        const count = await refreshPhotoLibrary();
                        await sendWhatsAppMessage(BOSS_PHONE, `✅ Photo library refreshed: ${count} images.\n\n${PHOTO_FOLDERS.map(f => `  /${f}: ${PHOTO_LIBRARY.filter(p => p.file.startsWith(f + '/')).length}`).join('\n')}`);
                        return res.sendStatus(200);
                    }

                    // RESET COST / override cap
                    if (upperText === 'RESET COST' || upperText === 'RESUME SOPHIA' || upperText === 'OVERRIDE CAP') {
                        dailyUsage.capOverride = true;
                        delete dailyUsage.warningsSent.cap_daily_triggered;
                        delete dailyUsage.warningsSent.cap_monthly_triggered;
                        await sendWhatsAppMessage(BOSS_PHONE, `✅ HARD CAP OVERRIDE ACTIVE\n\nSophia resumed. Today: RM ${dailyUsage.costMYR.toFixed(2)} | Month: RM ${monthlyUsage.costMYR.toFixed(2)} | Blocked: ${dailyUsage.blockedCalls}\n\nText "USAGE" for full report.`);
                        return res.sendStatus(200);
                    }

                    // USAGE / COST / STATUS
                    if (upperText === 'USAGE' || upperText === 'COST' || upperText === 'STATUS') {
                        const report = await buildUsageReport();
                        await sendWhatsAppMessage(BOSS_PHONE, report);
                        return res.sendStatus(200);
                    }

                    // REFRESH COST (admin API)
                    if (upperText === 'REFRESH COST' || upperText === 'REFRESH ADMIN') {
                        await sendWhatsAppMessage(BOSS_PHONE, "🌐 Fetching from Anthropic Admin API...");
                        await refreshAdminCostData();
                        const unified = await getUnifiedCostData();
                        if (unified) await sendWhatsAppMessage(BOSS_PHONE, `✅ Refreshed.\nToday: RM ${unified.today.total.toFixed(2)}\nMonth: RM ${unified.month.total.toFixed(2)}\n\nText USAGE for full.`);
                        else await sendWhatsAppMessage(BOSS_PHONE, `❌ Admin API unreachable. ${adminCostCache.lastError || ''}`);
                        return res.sendStatus(200);
                    }

                    // Marketing approval
                    if (isMarketingApprovalReply(messageText)) {
                        await handleMarketingApproval(senderNumber, messageText);
                        return res.sendStatus(200);
                    }

                    // 👑 NEW: Boss Mode personal assistant (all other boss messages)
                    const bossReply = await handleBossMode(messageText);
                    if (bossReply) await sendWhatsAppMessage(BOSS_PHONE, bossReply);
                    return res.sendStatus(200);
                }

                // ══════════════════════════════════════
                // 👤 CUSTOMER MESSAGE FLOW
                // ══════════════════════════════════════

                // 🛑 Hard cap check
                const cap = isCostCapExceeded();
                if (cap) {
                    dailyUsage.blockedCalls++;
                    await notifyCapTriggered(cap);
                    await sendWhatsAppMessage(senderNumber, "Hi Boss, sorry — our team is momentarily unavailable. Your message is important. We'll get back to you within a few hours. 🙏");
                    return res.sendStatus(200);
                }

                // 🧠 Load customer memory
                const memory = await loadCustomerMemory(senderNumber);
                memory.conversationCount += 1;
                memory.lastInteraction = receivedAt;

                // Check for ORDER CONFIRM / CANCEL
                const upperMsg = messageText.trim().toUpperCase();
                if (upperMsg === 'CONFIRM' && pendingOrders.has(senderNumber)) {
                    const order = pendingOrders.get(senderNumber);
                    pendingOrders.delete(senderNumber);

                    memory.orderHistory.push({
                        date: new Date().toISOString().slice(0, 10),
                        items: order.description, total: order.total
                    });
                    memory.totalSpent += order.total;
                    memory.lastOrderDate = new Date().toISOString().slice(0, 10);
                    await saveCustomerMemory(senderNumber);

                    await sendBossAlert({
                        alert_type: "ORDER_PLACED", platform: "WhatsApp",
                        customer_name: memory.name || senderName,
                        customer_phone: senderNumber, customer_message: "CONFIRM",
                        sophia_reply: "Order confirmed",
                        alert_details: `${order.description} | Total: RM ${order.total}`,
                        confidence: 10
                    });

                    const confirmMsg = `✅ Order confirmed! Thank you${memory.name ? ', ' + memory.name : ', Boss'}!\n\nTotal: RM ${order.total}\n\nPayment:\n1. Bank transfer: RHB Bank Bhd 2-14352000 61145 (Big Jpresso Sdn Bhd)\n2. Online: ${RETAIL_URL}\n\nSend payment proof here and we'll process within 24hrs. ☕`;
                    await sendWhatsAppMessage(senderNumber, confirmMsg);
                    return res.sendStatus(200);
                }

                if (upperMsg === 'CANCEL' && pendingOrders.has(senderNumber)) {
                    pendingOrders.delete(senderNumber);
                    await sendWhatsAppMessage(senderNumber, "Order cancelled. No worries, Boss! Let me know if you'd like to browse again. ☕");
                    return res.sendStatus(200);
                }

                // 🧠 Route to Sophia AI
                const aiResponse = await routeToAgentTeam(senderNumber, messageText, senderName, memory);

                // Sync to Make.com
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: aiResponse.reply, platform: "WhatsApp", alert_type: aiResponse.alert_type });

                // Handle order intent from AI
                if (aiResponse.order_intent && aiResponse.order_intent.items) {
                    const orderItems = aiResponse.order_intent.items;
                    let desc = orderItems.map(i => `${i.name} ${i.weight} ×${i.qty || 1}`).join(', ');
                    // Simple total estimation (AI should include total in reply)
                    pendingOrders.set(senderNumber, { description: desc, total: 0, items: orderItems, created: new Date().toISOString() });

                    const orderMsg = aiResponse.reply + `\n\n━━ ORDER SUMMARY ━━\n${desc}\n\nReply CONFIRM to proceed or CANCEL to start over.`;
                    await sendWhatsAppMessage(senderNumber, orderMsg);
                } else {
                    await sendWhatsAppMessage(senderNumber, aiResponse.reply);
                }

                // Update memory from AI response
                if (aiResponse.customer_name_detected && !memory.name) {
                    memory.name = aiResponse.customer_name_detected;
                }
                if (aiResponse.tags) {
                    for (const tag of aiResponse.tags) {
                        if (!memory.tags.includes(tag)) memory.tags.push(tag);
                    }
                }
                await saveCustomerMemory(senderNumber);

                // 📄 Auto-send documents if customer asked about catalogue/academy
                const docMatches = detectDocumentTrigger(messageText);
                for (const doc of docMatches) {
                    if (doc.key === 'academy_overview') {
                        // Send academy info text + sample module
                        await sendWhatsAppMessage(senderNumber, ACADEMY_INFO);
                        // Send Module 1.1 as a sample
                        const sample = DOCUMENT_LIBRARY.academy_1_1;
                        await sendWhatsAppDocument(senderNumber, sample.url, sample.filename, "📚 Here's a sample — Module 1.1: Anatomy of Bean & Terroir");
                    } else if (doc.url) {
                        await sendWhatsAppDocument(senderNumber, doc.url, doc.filename, doc.caption);
                    }
                }

                // Alert boss if needed
                if (aiResponse.alert_type && aiResponse.alert_type !== "NONE") {
                    await sendBossAlert({
                        alert_type: aiResponse.alert_type,
                        alert_details: aiResponse.alert_details,
                        customer_phone: senderNumber,
                        customer_name: memory.name || senderName,
                        customer_message: messageText,
                        sophia_reply: aiResponse.reply,
                        confidence: aiResponse.confidence,
                        platform: "WhatsApp"
                    });
                }
            }
        }

        // ── INSTAGRAM ──
        if (body.object === 'instagram') {
            const messagingEvent = body.entry?.[0]?.messaging?.[0];
            const changesEvent = body.entry?.[0]?.changes?.[0]?.value;

            if (messagingEvent?.message?.is_echo || changesEvent?.message?.is_echo) {
                console.log("🤫 Echo detected. Ignoring.");
            } else {
                let igSenderId = null;
                let messageText = "No text";

                if (messagingEvent?.message) { igSenderId = messagingEvent.sender.id; messageText = messagingEvent.message.text || "No text"; }
                else if (changesEvent?.message) { igSenderId = changesEvent.sender.id; messageText = changesEvent.message.text || "No text"; }

                if (igSenderId) {
                    console.log(`📥 [Instagram] ${igSenderId}: "${messageText}"`);
                    const aiResponse = await routeToAgentTeam(igSenderId, messageText, "IG User", null);
                    await syncLeadToSheet({ phone: igSenderId, msg: messageText, reply: aiResponse.reply, platform: "Instagram", alert_type: aiResponse.alert_type });
                    await sendInstagramMessage(igSenderId, aiResponse.reply);

                    if (aiResponse.alert_type && aiResponse.alert_type !== "NONE") {
                        await sendBossAlert({
                            alert_type: aiResponse.alert_type, alert_details: aiResponse.alert_details,
                            customer_phone: igSenderId, customer_name: "IG User",
                            customer_message: messageText, sophia_reply: aiResponse.reply,
                            confidence: aiResponse.confidence, platform: "Instagram"
                        });
                    }
                }
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("❌ Gateway Error:", error.message);
        res.sendStatus(500);
    }
});


// ==========================================
// 🛠️ 10. SEND FUNCTIONS
// ==========================================
async function sendWhatsAppMessage(recipientPhone, textMsg) {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: "whatsapp", to: recipientPhone,
                type: "text", text: { body: textMsg.slice(0, 4096), preview_url: true }
            })
        });
        if (response.ok) console.log(`✅ WhatsApp delivered to +${recipientPhone}!`);
        else console.error(`❌ WhatsApp API Error:`, await response.text());
    } catch (err) { console.error("❌ WhatsApp Network Error:", err); }
}

async function sendInstagramMessage(recipientId, textMsg) {
    const url = `https://graph.facebook.com/v20.0/me/messages`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${IG_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient: { id: recipientId }, message: { text: textMsg.slice(0, 1000) } })
        });
        if (response.ok) console.log(`✅ IG delivered!`);
        else console.error(`❌ IG API Error:`, await response.text());
    } catch (err) { console.error("❌ IG Network Error:", err); }
}

// ==========================================
// 📄 10b. DOCUMENT LIBRARY + WHATSAPP DOC SENDER
// ==========================================
const DOC_BASE = `${SUPABASE_URL}/storage/v1/object/public/jpresso-marketing`;

const DOCUMENT_LIBRARY = {
    // Product Catalog
    catalogue: {
        url: `${DOC_BASE}/jpresso-catalogue/Jpresso_Coffee_Catalogue%202026.pdf`,
        filename: "Jpresso_Coffee_Catalogue_2026.pdf",
        caption: "☕ Jpresso Coffee Catalogue 2026 — Full bean selection, pricing & brewing guides",
        triggers: ["catalogue", "catalog", "product list", "menu", "what beans", "bean list", "price list", "all products", "full list"]
    },

    // Academy Modules
    academy_1_1: {
        url: `${DOC_BASE}/jpresso-academy/Module%201.1-%20Anatomy%20of%20Bean%20%26%20Terroir%20(Extraction_Architecture).pdf`,
        filename: "Module_1.1_Anatomy_of_Bean_Terroir.pdf",
        caption: "📚 Module 1.1 — Anatomy of Bean & Terroir (Extraction Architecture)",
        triggers: ["module 1.1", "anatomy of bean", "terroir", "extraction architecture"]
    },
    academy_1_2: {
        url: `${DOC_BASE}/jpresso-academy/Module%201.2-%20Water%20Chemistry%20Fundamentals.pdf`,
        filename: "Module_1.2_Water_Chemistry.pdf",
        caption: "📚 Module 1.2 — Water Chemistry Fundamentals",
        triggers: ["module 1.2", "water chemistry", "water quality"]
    },
    academy_1_3: {
        url: `${DOC_BASE}/jpresso-academy/Module%201.3-Grind%20Dynamics%20%26%20Particle%20Distribution.pdf`,
        filename: "Module_1.3_Grind_Dynamics.pdf",
        caption: "📚 Module 1.3 — Grind Dynamics & Particle Distribution",
        triggers: ["module 1.3", "grind dynamics", "particle distribution", "grind size"]
    },
    academy_1_4: {
        url: `${DOC_BASE}/jpresso-academy/Module%201.4-Advanced%20Espresso%20Mechanics.pdf`,
        filename: "Module_1.4_Advanced_Espresso.pdf",
        caption: "📚 Module 1.4 — Advanced Espresso Mechanics",
        triggers: ["module 1.4", "espresso mechanics", "advanced espresso"]
    },
    academy_2_1: {
        url: `${DOC_BASE}/jpresso-academy/Module%202.1-Milk%20Chemistry%20%26%20Thermodynamics.pdf`,
        filename: "Module_2.1_Milk_Chemistry.pdf",
        caption: "📚 Module 2.1 — Milk Chemistry & Thermodynamics",
        triggers: ["module 2.1", "milk chemistry", "milk science", "thermodynamics"]
    },
    academy_2_2: {
        url: `${DOC_BASE}/jpresso-academy/Module%202%2C2-Latte%20Art%20Techniques.pdf`,
        filename: "Module_2.2_Latte_Art.pdf",
        caption: "📚 Module 2.2 — Latte Art Techniques",
        triggers: ["module 2.2", "latte art", "milk art"]
    },
    academy_2_3: {
        url: `${DOC_BASE}/jpresso-academy/Module%202.3-Barista%20Ergonomics%20and%20Workflow.pdf`,
        filename: "Module_2.3_Barista_Ergonomics.pdf",
        caption: "📚 Module 2.3 — Barista Ergonomics and Workflow",
        triggers: ["module 2.3", "ergonomics", "barista workflow"]
    },
    academy_2_4: {
        url: `${DOC_BASE}/jpresso-academy/Module%202.4%20-%20Equipment%20Maintenance%20%26%20Diagnostics.pdf`,
        filename: "Module_2.4_Equipment_Maintenance.pdf",
        caption: "📚 Module 2.4 — Equipment Maintenance & Diagnostics",
        triggers: ["module 2.4", "equipment maintenance", "machine maintenance", "diagnostics"]
    },
    academy_3_1: {
        url: `${DOC_BASE}/jpresso-academy/Module%203.1-The%20Roaster%27s%20Perspective%20on%20the%20Bar.pdf`,
        filename: "Module_3.1_Roasters_Perspective.pdf",
        caption: "📚 Module 3.1 — The Roaster's Perspective on the Bar",
        triggers: ["module 3.1", "roaster perspective", "roaster on bar"]
    },
    academy_3_2: {
        url: `${DOC_BASE}/jpresso-academy/Module%203.2-Specialty%20Pour-Over%20Methodologies.pdf`,
        filename: "Module_3.2_Pour_Over_Methodologies.pdf",
        caption: "📚 Module 3.2 — Specialty Pour-Over Methodologies",
        triggers: ["module 3.2", "pour over", "pourover", "v60 method"]
    },
    academy_3_3: {
        url: `${DOC_BASE}/jpresso-academy/Module%203.3-Sensory%20Analysis%20and%20Cupping%20Protocols.pdf`,
        filename: "Module_3.3_Sensory_Analysis.pdf",
        caption: "📚 Module 3.3 — Sensory Analysis and Cupping Protocols",
        triggers: ["module 3.3", "sensory analysis", "cupping", "cupping protocol"]
    },

    // Academy overview (sends all info)
    academy_overview: {
        url: null, // No single PDF — Sophia describes the course
        filename: null,
        caption: null,
        triggers: ["academy", "barista course", "barista training", "coffee course", "roasting course", "masterclass", "learn barista", "jpresso academy"]
    }
};

async function sendWhatsAppDocument(recipientPhone, docUrl, filename, caption) {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: recipientPhone,
                type: "document",
                document: { link: docUrl, filename: filename, caption: caption }
            })
        });
        if (response.ok) console.log(`📄 Document sent to +${recipientPhone}: ${filename}`);
        else console.error(`❌ Doc send failed:`, await response.text());
    } catch (err) { console.error("❌ Doc send error:", err); }
}

// Check if customer message should trigger a document send
function detectDocumentTrigger(messageText) {
    const lower = messageText.toLowerCase();
    const matched = [];

    for (const [key, doc] of Object.entries(DOCUMENT_LIBRARY)) {
        if (doc.triggers.some(t => lower.includes(t))) {
            matched.push({ key, ...doc });
        }
    }
    return matched;
}

// Academy overview text (when customer asks about academy/course)
const ACADEMY_INFO = `📚 JPRESSO ACADEMY — FREE Barista Course

11 modules covering everything from bean science to sensory analysis — completely FREE:

Phase 1 — Foundation:
• 1.1 Anatomy of Bean & Terroir
• 1.2 Water Chemistry Fundamentals
• 1.3 Grind Dynamics & Particle Distribution
• 1.4 Advanced Espresso Mechanics

Phase 2 — Craft:
• 2.1 Milk Chemistry & Thermodynamics
• 2.2 Latte Art Techniques
• 2.3 Barista Ergonomics & Workflow
• 2.4 Equipment Maintenance & Diagnostics

Phase 3 — Mastery:
• 3.1 The Roaster's Perspective on the Bar
• 3.2 Specialty Pour-Over Methodologies
• 3.3 Sensory Analysis & Cupping Protocols

All modules are FREE — just ask me for any module and I'll send it to you!

We also offer a hands-on Roasting Masterclass (RM 2,888) at our roastery. Interested? I'll connect you with our Chief.`;


// ==========================================
// 🚨 11. BOSS ALERT + MAKE.COM SYNC
// ==========================================
async function sendBossAlert(alertData) {
    const lastAlertAt = recentAlerts.get(alertData.customer_phone);
    const now = Date.now();
    if (lastAlertAt && (now - lastAlertAt) < 5 * 60 * 1000) { console.log(`🚨 Alert suppressed (rate-limited)`); return; }
    recentAlerts.set(alertData.customer_phone, now);

    const emojiMap = { "ORDER_PLACED": "🛒", "LOW_CONFIDENCE": "🆘", "COMPLAINT": "⚠️", "ESCALATION": "📞" };
    const titleMap = { "ORDER_PLACED": "WHOLESALE/OEM ORDER PLACED", "LOW_CONFIDENCE": "SOPHIA NEEDS HELP", "COMPLAINT": "CUSTOMER COMPLAINT", "ESCALATION": "ESCALATION REQUEST" };
    const emoji = emojiMap[alertData.alert_type] || "🔔";
    const title = titleMap[alertData.alert_type] || "ALERT";
    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });

    const alertMessage = `${emoji} ${title} ${emoji}\n\n📅 ${timestamp} MYT\n📱 ${alertData.platform}\n👤 ${alertData.customer_name}\n📞 +${alertData.customer_phone}\n\n━━━ DETAILS ━━━\n${alertData.alert_details}\n\n━━━ CUSTOMER SAID ━━━\n"${alertData.customer_message}"\n\n━━━ SOPHIA REPLIED ━━━\n"${(alertData.sophia_reply || '').slice(0, 200)}"\n\nConfidence: ${alertData.confidence}/10\n\n→ wa.me/${alertData.customer_phone}`;

    try {
        await sendWhatsAppMessage(BOSS_PHONE, alertMessage);
        console.log(`🚨 ALERT fired: ${alertData.alert_type}`);
        await syncLeadToSheet({ phone: alertData.customer_phone, msg: `[ALERT: ${alertData.alert_type}] ${alertData.customer_message}`, reply: alertData.sophia_reply, platform: alertData.platform, alert_type: alertData.alert_type, alert_details: alertData.alert_details, confidence: alertData.confidence });
    } catch (err) { console.error("❌ Alert send failed:", err.message); }
}

async function syncLeadToSheet(leadData) {
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/ejfq479exd8g3sotzimim8qr6uebyk93";
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leadData) });
        if (response.ok) console.log("✅ Synced to Make.com!");
    } catch (err) { console.error("❌ Sync Error:", err.message); }
}


// ==========================================
// 💰 12. COST TRACKING
// ==========================================
function calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * COST_CONFIG.INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * COST_CONFIG.OUTPUT_COST_PER_1M;
    const totalUSD = inputCost + outputCost;
    return { totalUSD, totalMYR: totalUSD * COST_CONFIG.USD_TO_MYR };
}

async function trackAPIUsage(inputTokens, outputTokens, source = "customer_service") {
    const today = new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    if (dailyUsage.date !== today) {
        console.log(`📅 New day — previous: RM ${dailyUsage.costMYR.toFixed(2)} / ${dailyUsage.calls} calls`);
        Object.assign(dailyUsage, { date: today, calls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0, costMYR: 0, warningsSent: {}, capOverride: false, blockedCalls: 0 });
    }

    const { totalUSD, totalMYR } = calculateCost(inputTokens, outputTokens);
    dailyUsage.calls++; dailyUsage.inputTokens += inputTokens; dailyUsage.outputTokens += outputTokens;
    dailyUsage.costUSD += totalUSD; dailyUsage.costMYR += totalMYR;
    monthlyUsage.calls++; monthlyUsage.costMYR += totalMYR;

    console.log(`💰 [${source}] In:${inputTokens} Out:${outputTokens} | RM${totalMYR.toFixed(3)} | Day: RM${dailyUsage.costMYR.toFixed(2)}`);
    await checkCostThresholds();
}

async function checkCostThresholds() {
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_WARNING && !dailyUsage.warningsSent.daily_warning) {
        dailyUsage.warningsSent.daily_warning = true;
        await sendWhatsAppMessage(BOSS_PHONE, `⚠️ DAILY COST WARNING\n\nSpend: RM ${dailyUsage.costMYR.toFixed(2)} | Calls: ${dailyUsage.calls}\nMonthly: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_BUDGET}`);
    }
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_CRITICAL && !dailyUsage.warningsSent.daily_critical) {
        dailyUsage.warningsSent.daily_critical = true;
        await sendWhatsAppMessage(BOSS_PHONE, `🚨🚨🚨 CRITICAL: RM ${dailyUsage.costMYR.toFixed(2)} TODAY\n\nCheck Render logs. Consider pausing.`);
    }
    const monthlyWarnKey = `monthly_80_${new Date().getDate()}`;
    if (monthlyUsage.costMYR >= (COST_CONFIG.MONTHLY_BUDGET * 0.8) && !dailyUsage.warningsSent[monthlyWarnKey]) {
        dailyUsage.warningsSent[monthlyWarnKey] = true;
        await sendWhatsAppMessage(BOSS_PHONE, `⚠️ MONTHLY BUDGET 80%: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_BUDGET}`);
    }
}

function isCostCapExceeded() {
    if (dailyUsage.capOverride) return false;
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_HARD_CAP) return { reason: 'daily', current: dailyUsage.costMYR, cap: COST_CONFIG.DAILY_HARD_CAP };
    if (monthlyUsage.costMYR >= COST_CONFIG.MONTHLY_HARD_CAP) return { reason: 'monthly', current: monthlyUsage.costMYR, cap: COST_CONFIG.MONTHLY_HARD_CAP };
    return false;
}

async function notifyCapTriggered(cap) {
    const alertKey = `cap_${cap.reason}_triggered`;
    if (dailyUsage.warningsSent[alertKey]) return;
    dailyUsage.warningsSent[alertKey] = true;
    await sendWhatsAppMessage(BOSS_PHONE, `🛑🛑🛑 SOPHIA STOPPED\n\n${cap.reason.toUpperCase()} CAP HIT: RM ${cap.current.toFixed(2)} / RM ${cap.cap.toFixed(2)}\nBlocked: ${dailyUsage.blockedCalls}\n\nText "RESET COST" to resume.`);
}


// ==========================================
// 🌐 13. UNIFIED ANTHROPIC TRACKING (Admin API)
// ==========================================
const ANTHROPIC_COST_API = "https://api.anthropic.com/v1/organizations/cost_report";
let adminCostCache = { today: null, monthToDate: null, lastError: null };

async function fetchAnthropicCost(startDate, endDate) {
    if (!ANTHROPIC_ADMIN_KEY) return null;
    try {
        const startingAt = startDate.toISOString().split('.')[0] + 'Z';
        const endingAt = endDate.toISOString().split('.')[0] + 'Z';
        if (endDate.getTime() <= startDate.getTime()) return null;

        const params = new URLSearchParams({ starting_at: startingAt, ending_at: endingAt, bucket_width: '1d' });
        const response = await fetch(`${ANTHROPIC_COST_API}?${params.toString()}`, {
            method: 'GET',
            headers: { 'anthropic-version': '2023-06-01', 'x-api-key': ANTHROPIC_ADMIN_KEY }
        });

        if (!response.ok) { adminCostCache.lastError = `${response.status}`; return null; }

        const data = await response.json();
        let totalCents = 0;
        if (data.data && Array.isArray(data.data)) {
            for (const bucket of data.data) {
                if (bucket.results && Array.isArray(bucket.results)) {
                    for (const entry of bucket.results) totalCents += parseFloat(entry.amount || "0");
                }
            }
        }
        return { usd: totalCents / 100, myr: (totalCents / 100) * COST_CONFIG.USD_TO_MYR, fetchedAt: new Date() };
    } catch (err) { adminCostCache.lastError = err.message; return null; }
}

async function refreshAdminCostData() {
    if (!ANTHROPIC_ADMIN_KEY) return;
    const now = new Date();
    const mytFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [mytYear, mytMonth, mytDay] = mytFormatter.format(now).split('-').map(Number);

    const todayUtcStart = new Date(Date.UTC(mytYear, mytMonth - 1, mytDay - 1, 0, 0, 0));
    const todayUtcEnd = new Date(Date.UTC(mytYear, mytMonth - 1, mytDay + 1, 0, 0, 0));
    const monthUtcStart = new Date(Date.UTC(mytYear, mytMonth - 1, 1, 0, 0, 0));

    const [todayCost, monthCost] = await Promise.all([
        fetchAnthropicCost(todayUtcStart, todayUtcEnd),
        fetchAnthropicCost(monthUtcStart, todayUtcEnd)
    ]);
    if (todayCost) adminCostCache.today = todayCost;
    if (monthCost) adminCostCache.monthToDate = monthCost;
}

async function getUnifiedCostData() {
    if (!ANTHROPIC_ADMIN_KEY) return null;
    const cacheAge = adminCostCache.today ? Date.now() - adminCostCache.today.fetchedAt.getTime() : Infinity;
    if (cacheAge > 10 * 60 * 1000) await refreshAdminCostData();
    if (!adminCostCache.today && !adminCostCache.monthToDate) return null;

    const todayTotal = adminCostCache.today ? adminCostCache.today.myr : dailyUsage.costMYR;
    const todayTotalUSD = adminCostCache.today ? adminCostCache.today.usd : dailyUsage.costUSD;
    const monthTotal = adminCostCache.monthToDate ? adminCostCache.monthToDate.myr : monthlyUsage.costMYR;
    const monthTotalUSD = adminCostCache.monthToDate ? adminCostCache.monthToDate.usd : monthlyUsage.costMYR / COST_CONFIG.USD_TO_MYR;

    return {
        today: { total: todayTotal, totalUSD: todayTotalUSD, sophia: dailyUsage.costMYR, other: Math.max(0, todayTotal - dailyUsage.costMYR) },
        month: { total: monthTotal, totalUSD: monthTotalUSD, sophia: monthlyUsage.costMYR, other: Math.max(0, monthTotal - monthlyUsage.costMYR) },
        cachedAt: (adminCostCache.today || adminCostCache.monthToDate).fetchedAt
    };
}

async function buildUsageReport() {
    const statusEmoji = dailyUsage.costMYR < COST_CONFIG.DAILY_WARNING ? '🟢' : dailyUsage.costMYR < COST_CONFIG.DAILY_CRITICAL ? '🟡' : '🔴';
    const unified = await getUnifiedCostData();

    let unifiedSection = "";
    if (unified) {
        unifiedSection = `\n\n━━ 🌐 ALL APPS ━━\nToday: RM ${unified.today.total.toFixed(2)} ($${unified.today.totalUSD.toFixed(2)})\nMonth: RM ${unified.month.total.toFixed(2)} ($${unified.month.totalUSD.toFixed(2)})\nSophia: RM ${unified.today.sophia.toFixed(2)} | Other: RM ${unified.today.other.toFixed(2)}`;
    } else if (ANTHROPIC_ADMIN_KEY) {
        unifiedSection = `\n\n⚠️ Admin API: ${adminCostCache.lastError || 'unreachable'}`;
    }

    return `📊 USAGE REPORT ${statusEmoji}\n\n━━ SOPHIA TODAY ━━\nCalls: ${dailyUsage.calls}\nTokens: ${dailyUsage.inputTokens.toLocaleString()} in / ${dailyUsage.outputTokens.toLocaleString()} out\nCost: RM ${dailyUsage.costMYR.toFixed(2)} ($${dailyUsage.costUSD.toFixed(2)})\n\n━━ MONTH ━━\nCalls: ${monthlyUsage.calls}\nCost: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_BUDGET}${unifiedSection}\n\n━━ CAPS ━━\nDaily: ${((dailyUsage.costMYR / COST_CONFIG.DAILY_HARD_CAP) * 100).toFixed(0)}% | Monthly: ${((monthlyUsage.costMYR / COST_CONFIG.MONTHLY_HARD_CAP) * 100).toFixed(0)}%\nBlocked: ${dailyUsage.blockedCalls}\n\n💡 lead report | cron status | revenue report | pipeline report | batch report | customer report | market news`;
}

refreshAdminCostData().catch(err => console.error("Initial admin fetch failed:", err.message));
setInterval(() => { refreshAdminCostData().catch(err => console.error("Admin refresh failed:", err.message)); }, 15 * 60 * 1000);


// ==========================================
// 🧠 14. SOPHIA BRAIN (Customer AI)
// ==========================================
async function routeToAgentTeam(senderId, messageText, senderName, memory) {
    try {
        if (!userSessions.has(senderId)) userSessions.set(senderId, []);
        let history = userSessions.get(senderId);

        let safeText = String(messageText).trim();
        if (!safeText) safeText = "[Media/Empty]";
        history.push({ role: "user", content: safeText });

        let formattedMessages = [];
        for (let msg of history) {
            if (formattedMessages.length === 0) {
                if (msg.role === "user") formattedMessages.push({ role: "user", content: msg.content });
            } else {
                let lastMsg = formattedMessages[formattedMessages.length - 1];
                if (lastMsg.role === msg.role) lastMsg.content += "\n\n[Follow-up]: " + msg.content;
                else formattedMessages.push({ role: msg.role, content: msg.content });
            }
        }

        while (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role !== "user") formattedMessages.pop();
        if (formattedMessages.length > 5) { formattedMessages = formattedMessages.slice(-5); if (formattedMessages[0].role !== "user") formattedMessages.shift(); }

        // Build memory context
        let memoryContext = "New customer — no history yet.";
        if (memory) {
            const parts = [];
            if (memory.name) parts.push(`Name: ${memory.name}`);
            if (memory.conversationCount > 1) parts.push(`Returning customer (${memory.conversationCount} conversations)`);
            if (memory.orderHistory.length > 0) {
                parts.push(`Previous orders:`);
                for (const o of memory.orderHistory.slice(-3)) parts.push(`- ${o.date}: ${o.items} (RM ${o.total})`);
            }
            if (memory.totalSpent > 0) parts.push(`Total spent: RM ${memory.totalSpent}`);
            if (memory.tags.length > 0) parts.push(`Tags: ${memory.tags.join(', ')}`);
            if (parts.length > 0) memoryContext = parts.join('\n');
        }

        const systemPrompt = SOPHIA_SYSTEM_PROMPT.replace('{CUSTOMER_MEMORY}', memoryContext) + "\n\n=== PRODUCTS ===\n" + JPRESSO_PRODUCTS;

        console.log(`🧠 Sophia — ${formattedMessages.length} msgs → ${ACTIVE_MODEL}`);

        const msg = await anthropic.messages.create({
            model: ACTIVE_MODEL, max_tokens: 1200,
            system: systemPrompt, messages: formattedMessages
        });

        if (msg.usage) await trackAPIUsage(msg.usage.input_tokens || 0, msg.usage.output_tokens || 0, "customer_service");

        const rawText = msg.content[0].text.trim();
        let parsed;
        try {
            parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
        } catch (parseErr) {
            console.error("❌ JSON parse failed. Raw:", rawText.slice(0, 200));
            parsed = { reply: rawText, confidence: 5, alert_type: "NONE", alert_details: "", tags: [] };
        }

        history.push({ role: "assistant", content: parsed.reply });
        if (history.length > 20) history = history.slice(-20);
        userSessions.set(senderId, history);

        console.log(`💬 Sophia (conf ${parsed.confidence}/10, alert=${parsed.alert_type}): "${(parsed.reply || '').substring(0, 80)}..."`);
        return parsed;
    } catch (error) {
        console.error("❌ AI CRASH:", error.message);
        return { reply: "Sorry Boss, my internal boiler is resetting. Let me get the Chief to help you!", confidence: 0, alert_type: "LOW_CONFIDENCE", alert_details: "Sophia crashed." };
    }
}


// ==========================================
// 🎨 15. MARKETING WORKFLOW
// ==========================================
async function generateThreeDrafts() {
    const drafts = [];

    // 🔄 BEAN ROTATION — pick 3 different beans each day, never repeat Moon White every time
    const allBeans = [
        "Moon White Blend", "Phoenix Das Blend", "Cham Velvet Blend", "Emerald White Blend",
        "Babydas Blend", "Sunrise Walker Blend", "Sunrise Dreamer Blend",
        "Ethiopia Yirgacheffe Aricha", "Ethiopia Yirgacheffe Amederaro", "Ethiopia Lekempti",
        "Colombia Supremo", "Brazil Santos", "Guatemala Antigua", "Guatemala Huehuetenango",
        "Sumatra Mandheling", "El Salvador La Fany", "Indonesia Mount Kerinci"
    ];

    // Shuffle and pick 3 different beans
    const shuffled = allBeans.sort(() => Math.random() - 0.5);
    const todaysBeans = shuffled.slice(0, 3);

    const angles = [
        { direction: `SOPHIA PERSONAL RECOMMENDATION — Feature "${todaysBeans[0]}" specifically. Describe its unique tasting notes and why you love it. Lead with 500g pricing. Include https://bloomdaily.io/subscribe.html`, photo_hint: "sophia_speaks OR sophia_drinks OR product_showcase" },
        { direction: `BEHIND-THE-SCENES CRAFT — Feature "${todaysBeans[1]}" and tell the story of how it's roasted. Mention which roaster (Garanti drum or Santoker air) suits this bean. 48hr fresh. Build authority.`, photo_hint: "roasting_craft OR sophia_roasts OR founders_story" },
        { direction: `LIFESTYLE / MORNING RITUAL — Feature "${todaysBeans[2]}" in a cozy KL morning scenario. What brewing method suits it best? Weber's Law upsell on 500g. Include https://bloomdaily.io/subscribe.html`, photo_hint: "sophia_lifestyle OR brewing_craft OR lifestyle" }
    ];

    console.log(`🎨 Today's featured beans: ${todaysBeans.join(', ')}`);

    for (let i = 0; i < 3; i++) {
        try {
            const post = await anthropic.messages.create({
                model: ACTIVE_MODEL, max_tokens: 500,
                system: `You are Sophia writing for Jpresso IG + FB.
VOICE: First-person. You ARE Sophia.
PRODUCT CONTEXT: ${JPRESSO_PRODUCTS}
CAPTION RULES:
- Under 150 words, Manglish, 5-8 emojis, 8-10 hashtags
- CTA to bloomdaily.io
- Lead with 500g as smart choice
- IMPORTANT: Feature the SPECIFIC bean mentioned in the direction. Do NOT default to Moon White unless it is the specified bean.
- Include the bean's actual tasting notes and pricing from the product context above
END WITH: PHOTO_THEMES: [relevant themes]`,
                messages: [{ role: "user", content: `Write ONE caption. ${angles[i].direction}\n\nPhoto themes: ${angles[i].photo_hint}` }]
            });
            if (post.usage) await trackAPIUsage(post.usage.input_tokens || 0, post.usage.output_tokens || 0, "marketing_draft");

            const fullText = post.content[0].text.trim();
            const themeMatch = fullText.match(/PHOTO_THEMES:\s*(.+)$/m);
            const photoThemes = themeMatch ? themeMatch[1].split(',').map(t => t.trim().toLowerCase()) : [];
            const caption = fullText.replace(/PHOTO_THEMES:.*$/m, '').trim();
            drafts.push({ caption, themes: photoThemes, photo: findBestPhoto(caption, photoThemes) });
        } catch (err) {
            console.error(`❌ Draft ${i + 1} failed:`, err.message);
            drafts.push({ caption: `[Draft ${i + 1} failed]`, themes: [], photo: null });
        }
    }
    return drafts;
}

function findBestPhoto(caption, themes) {
    const captionLower = caption.toLowerCase();
    const scored = PHOTO_LIBRARY.map(photo => {
        let score = 0;
        for (const theme of themes) { if (photo.themes.some(pt => pt.toLowerCase().includes(theme) || theme.includes(pt.toLowerCase()))) score += 10; }
        for (const tag of photo.tags) { if (captionLower.includes(tag.toLowerCase().replace(/_/g, ' '))) score += 5; if (captionLower.includes(tag.toLowerCase())) score += 3; }
        return { ...photo, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(p => p.score === scored[0].score);
    if (top.length === 0 || top[0].score === 0) {
        const sophias = PHOTO_LIBRARY.filter(p => p.tags.includes('sophia') && p.tags.includes('portrait'));
        return sophias.length ? sophias[Math.floor(Math.random() * sophias.length)] : PHOTO_LIBRARY[0];
    }
    return top[Math.floor(Math.random() * top.length)];
}

async function sendDraftsToBoss(drafts) {
    const today = new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    let message = `☀️ Good morning, Boss! 3 drafts for ${today}:\n\n`;
    drafts.forEach((draft, i) => {
        message += `━━━ DRAFT ${i + 1} ━━━\n${draft.caption}\n\n`;
        if (draft.photo) message += `📸 ${draft.photo.file}\n🔗 ${draft.photo.url}\n\n`;
    });
    message += `Reply: ✅ PICK 1/2/3 | 🔄 RETRY | ❌ SKIP`;
    pendingDrafts.set(BOSS_PHONE, { drafts, sentAt: new Date().toISOString() });
    await sendWhatsAppMessage(BOSS_PHONE, message);
}

function isMarketingApprovalReply(messageText) {
    const text = messageText.trim().toUpperCase();
    return pendingDrafts.has(BOSS_PHONE) && ['PICK 1', 'PICK 2', 'PICK 3', 'RETRY', 'SKIP'].some(k => text === k || text.startsWith(k));
}

async function handleMarketingApproval(senderPhone, messageText) {
    const text = messageText.trim().toUpperCase();
    const pending = pendingDrafts.get(BOSS_PHONE);
    if (!pending) { await sendWhatsAppMessage(BOSS_PHONE, "No pending drafts. Tomorrow 9 AM!"); return; }

    if (text.startsWith('PICK')) {
        const pickNum = parseInt(text.split(' ')[1]);
        if (pickNum >= 1 && pickNum <= 3) {
            const approved = pending.drafts[pickNum - 1];
            approvedPosts.push({ caption: approved.caption, photo: approved.photo, approvedAt: new Date().toISOString() });
            let confirmMsg = `✅ Draft ${pickNum} approved!\n\n${approved.caption}\n\n`;
            if (approved.photo) confirmMsg += `📸 ${approved.photo.url}\n\n`;
            confirmMsg += `Save image → post to IG + FB. ☕`;
            await sendWhatsAppMessage(BOSS_PHONE, confirmMsg);
            pendingDrafts.delete(BOSS_PHONE);
            return;
        }
    }
    if (text === 'RETRY') { await sendWhatsAppMessage(BOSS_PHONE, "🔄 Regenerating..."); const nd = await generateThreeDrafts(); await sendDraftsToBoss(nd); return; }
    if (text === 'SKIP') { pendingDrafts.delete(BOSS_PHONE); await sendWhatsAppMessage(BOSS_PHONE, "❌ Skipped. See you tomorrow! ☕"); return; }
}


// ==========================================
// ⏰ 16. CRON JOBS
// ==========================================

// 9 AM MYT — Marketing drafts
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ [9 AM MYT] Marketing...");
    try { const drafts = await generateThreeDrafts(); await sendDraftsToBoss(drafts); }
    catch (err) { console.error("❌ Marketing failed:", err); }
}, { timezone: "Asia/Kuala_Lumpur" });

// 11 PM MYT — Daily cost summary
cron.schedule('0 23 * * *', async () => {
    console.log("📊 Daily summary...");
    await refreshAdminCostData();
    const report = await buildUsageReport();
    await sendWhatsAppMessage(BOSS_PHONE, `📊 DAILY REPORT\n${report}\n\nGood night, Boss! ☕`);
}, { timezone: "Asia/Kuala_Lumpur" });

// Clean up stale sessions every 4 hours
cron.schedule('0 */4 * * *', () => {
    let cleaned = 0;
    for (const [phone, session] of userSessions.entries()) {
        if (session.length > 20) { userSessions.delete(phone); cleaned++; }
    }
    if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} stale sessions`);
});


// ==========================================
// 🛒 17. STRIPE WEBHOOK — Order Notifications
// ==========================================
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!STRIPE_WEBHOOK_SECRET) {
        console.error("❌ STRIPE_WEBHOOK_SECRET not configured");
        return res.sendStatus(500);
    }

    const sig = req.headers['stripe-signature'];
    let event;

    // Verify signature
    try {
        const crypto = require('crypto');
        const payload = req.body.toString();
        const sigParts = {};
        sig.split(',').forEach(part => {
            const [key, value] = part.split('=');
            sigParts[key] = value;
        });

        const timestamp = sigParts.t;
        const signedPayload = `${timestamp}.${payload}`;
        const expectedSig = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET)
            .update(signedPayload).digest('hex');

        if (expectedSig !== sigParts.v1) {
            console.error("❌ Stripe signature verification failed");
            return res.sendStatus(400);
        }

        event = JSON.parse(payload);
    } catch (err) {
        console.error("❌ Stripe webhook error:", err.message);
        return res.sendStatus(400);
    }

    console.log(`💳 Stripe event: ${event.type}`);

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const customerName = session.customer_details?.name || 'Unknown';
        const customerEmail = session.customer_details?.email || 'No email';
        const customerPhone = session.customer_details?.phone || '';
        const amountTotal = ((session.amount_total || 0) / 100).toFixed(2);
        const currency = (session.currency || 'myr').toUpperCase();
        const paymentStatus = session.payment_status || 'unknown';
        const sessionId = session.id || '';
        const paymentMethod = session.payment_method_types?.[0] || 'card';

        // Get line items description if available
        const lineItems = session.metadata?.items || session.metadata?.description || '';

        const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });

        const orderMsg = `🛒 NEW BLOOMDAILY ORDER!\n━━━━━━━━━━━━━━━\n📅 ${timestamp} MYT\n\n👤 ${customerName}\n📧 ${customerEmail}${customerPhone ? '\n📞 ' + customerPhone : ''}\n\n💰 ${currency} ${amountTotal}\n💳 ${paymentMethod.toUpperCase()} — ${paymentStatus === 'paid' ? '✅ Paid' : '⏳ ' + paymentStatus}${lineItems ? '\n📦 ' + lineItems : ''}\n\n🔗 Session: ${sessionId.slice(-12)}\n━━━━━━━━━━━━━━━\nCheck Stripe dashboard for full details.`;

        try {
            await sendWhatsAppMessage(BOSS_PHONE, orderMsg);
            console.log(`✅ Order notification sent to Boss: ${currency} ${amountTotal} from ${customerName}`);
        } catch (err) {
            console.error("❌ Failed to send order notification:", err.message);
        }

        // Save to customer memory if phone available
        if (customerPhone) {
            const cleanPhone = customerPhone.replace(/\D/g, '');
            if (cleanPhone) {
                const mem = await loadCustomerMemory(cleanPhone);
                if (!mem.name && customerName !== 'Unknown') mem.name = customerName;
                mem.orderHistory.push({
                    date: new Date().toISOString().slice(0, 10),
                    items: lineItems || 'bloomdaily.io order',
                    total: parseFloat(amountTotal),
                    source: 'stripe'
                });
                mem.totalSpent += parseFloat(amountTotal);
                mem.lastOrderDate = new Date().toISOString().slice(0, 10);
                if (!mem.tags.includes('stripe_customer')) mem.tags.push('stripe_customer');
                await saveCustomerMemory(cleanPhone);
                console.log(`🧠 Customer memory updated for +${cleanPhone}`);
            }
        }
    }

    // Handle subscription events too
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
        const sub = event.data.object;
        const status = sub.status || 'unknown';
        const interval = sub.items?.data?.[0]?.plan?.interval || '';
        const amount = ((sub.items?.data?.[0]?.plan?.amount || 0) / 100).toFixed(2);
        const currency = (sub.currency || 'myr').toUpperCase();

        const subMsg = `📦 SUBSCRIPTION ${event.type.includes('created') ? 'NEW' : 'UPDATED'}\n━━━━━━━━━━━━━━━\nStatus: ${status}\nPlan: ${currency} ${amount}/${interval}\nCustomer: ${sub.customer}\n━━━━━━━━━━━━━━━`;

        await sendWhatsAppMessage(BOSS_PHONE, subMsg);
        console.log(`📦 Subscription notification sent`);
    }

    res.json({ received: true });
});


// ==========================================
// 🏥 18. HEALTH
// ==========================================
app.get('/', (req, res) => {
    res.json({
        status: 'Sophia v3.0 ☕',
        features: 'Boss Mode + Customer Memory + Order Engine + Marketing + Alerts',
        model: ACTIVE_MODEL, uptime: Math.floor(process.uptime()) + 's',
        photos: PHOTO_LIBRARY.length, customers: customerMemoryCache.size,
        dailyCost: `RM ${dailyUsage.costMYR.toFixed(2)}`, monthlyCost: `RM ${monthlyUsage.costMYR.toFixed(2)}`
    });
});
app.get('/health', (req, res) => res.json({ ok: true }));


// ==========================================
// 🚀 19. START
// ==========================================
app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════╗`);
    console.log(`║  SOPHIA v3.0 — Boss Mode + Memory + Orders    ║`);
    console.log(`╚════════════════════════════════════════════════╝`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🧠 Model: ${ACTIVE_MODEL}`);
    console.log(`👑 Boss Mode: ACTIVE (+${BOSS_PHONE})`);
    console.log(`🧠 Customer Memory: Supabase-backed`);
    console.log(`🛒 Order Engine: ACTIVE`);
    console.log(`📸 Photos: Auto-discovery (every 6hrs)`);
    console.log(`🛑 Caps: Daily RM ${COST_CONFIG.DAILY_HARD_CAP} | Monthly RM ${COST_CONFIG.MONTHLY_HARD_CAP}`);
    console.log(`🌐 Admin API: ${ANTHROPIC_ADMIN_KEY ? 'ACTIVE' : 'DISABLED'}`);
    console.log(`🚨 Alerts: ACTIVE`);
    console.log(`📅 Marketing: 9 AM MYT | Report: 11 PM MYT`);
    console.log(`🛍️  Retail: ${RETAIL_URL}`);
    console.log(`✅ Ready.\n`);
});
