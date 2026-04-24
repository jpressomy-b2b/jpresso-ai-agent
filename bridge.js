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
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = "1124375407418121";
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "JpressoSophia2026";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY || ""; // 🆕 sk-ant-admin... for org-wide usage tracking
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const ACTIVE_MODEL = "claude-sonnet-4-6";

// 🎯 BOSS + WORKFLOW
const BOSS_PHONE = "60122393232";
const pendingDrafts = new Map();
const approvedPosts = [];
const userSessions = new Map();
const recentAlerts = new Map();

// ==========================================
// 💰 COST TRACKING CONFIG (API BUDGET ALERTS)
// ==========================================
const COST_CONFIG = {
    // Pricing per 1M tokens (USD, Claude Sonnet 4.6)
    INPUT_COST_PER_1M: 3.00,
    OUTPUT_COST_PER_1M: 15.00,
    USD_TO_MYR: 4.75, // Update monthly if needed
    
    // Alert thresholds (Malaysian Ringgit)
    DAILY_WARNING: 20.00,    // Warn Boss at RM 20/day
    DAILY_CRITICAL: 50.00,   // Emergency alert at RM 50/day
    MONTHLY_BUDGET: 250.00,  // Monthly target ceiling
    
    // 🛑 HARD LIMITS — Sophia STOPS replying when exceeded (protects from runaway cost)
    DAILY_HARD_CAP: 80.00,    // RM 80/day absolute max for Sophia
    MONTHLY_HARD_CAP: 400.00, // RM 400/month absolute max for Sophia
};

// In-memory usage counters (reset on server restart)
const dailyUsage = {
    date: new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' }),
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costUSD: 0,
    costMYR: 0,
    warningsSent: {},
    capOverride: false,  // 🛑 Boss can override cap via "RESET COST" command
    blockedCalls: 0       // Count of calls blocked by cap today
};

const monthlyUsage = {
    month: new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', month: 'long', year: 'numeric' }),
    calls: 0,
    costMYR: 0
};

// 📸 SUPABASE
const SUPABASE_BASE = "https://sbzyflkamsifcksqluwc.supabase.co/storage/v1/object/public/jpresso-marketing/jpresso-photos";
const SUPABASE_API = "https://sbzyflkamsifcksqluwc.supabase.co/storage/v1/object/list/jpresso-marketing";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ""; // Optional — bucket is public

// 🔗 CHANNELS
const RETAIL_URL = "https://bloomdaily.io/subscribe.html";

// ==========================================
// 📷 3. PHOTO LIBRARY — AUTO-DISCOVERY SYSTEM
// ==========================================
// Dynamically scans Supabase bucket on startup + every 6 hours.
// Auto-tags photos based on folder + filename keywords.
// Zero maintenance — upload new photos to Supabase, Sophia finds them.

let PHOTO_LIBRARY = [];

// Folders to scan in jpresso-photos/
const PHOTO_FOLDERS = [
    "sophia",
    "sophia-jason",
    "products",
    "roasting",
    "brewing",
    "cafe",
    "lifestyle"
];

// Image extensions we care about (skip .mp4 and other non-images)
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

// 🏷️ Smart auto-tagging based on folder + filename keywords
function autoTagPhoto(folder, filename) {
    const lowerName = filename.toLowerCase().replace(/[-_.]/g, ' ');
    const tags = new Set();
    const themes = new Set();

    // Folder-based default tags/themes
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

    // Keyword-based tagging from filename
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

    return {
        tags: Array.from(tags),
        themes: Array.from(themes)
    };
}

// 🔍 Scan a single Supabase folder — returns list of image files
async function scanSupabaseFolder(folder) {
    try {
        const response = await fetch(SUPABASE_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                prefix: `jpresso-photos/${folder}`,
                limit: 100,
                offset: 0,
                sortBy: { column: "name", order: "asc" }
            })
        });

        if (!response.ok) {
            console.error(`❌ Supabase scan failed for /${folder}: ${response.status} ${response.statusText}`);
            return [];
        }

        const files = await response.json();
        if (!Array.isArray(files)) {
            console.error(`❌ Unexpected response format for /${folder}`);
            return [];
        }

        // Filter for images only (skip videos, drafts, etc.)
        return files
            .filter(f => f.name && IMAGE_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)))
            .map(f => f.name);

    } catch (err) {
        console.error(`❌ Error scanning /${folder}:`, err.message);
        return [];
    }
}

// 🔄 Main auto-discovery function
async function refreshPhotoLibrary() {
    console.log("🔍 Scanning Supabase for photos...");
    const newLibrary = [];
    let skippedCount = 0;

    for (const folder of PHOTO_FOLDERS) {
        const files = await scanSupabaseFolder(folder);
        console.log(`  /${folder}: ${files.length} images found`);

        for (const filename of files) {
            const filepath = `${folder}/${filename}`;
            const { tags, themes } = autoTagPhoto(folder, filename);

            newLibrary.push({
                file: filepath,
                tags,
                themes,
                url: `${SUPABASE_BASE}/${encodeURI(filepath)}`
            });
        }
    }

    if (newLibrary.length > 0) {
        PHOTO_LIBRARY = newLibrary;
        console.log(`✅ Photo Library refreshed: ${PHOTO_LIBRARY.length} assets indexed`);
    } else {
        console.error("⚠️ No photos found during scan — keeping existing library");
    }

    return PHOTO_LIBRARY.length;
}

// Manually populate library on server start (non-blocking)
refreshPhotoLibrary().catch(err => {
    console.error("❌ Initial photo scan failed:", err.message);
});

// Auto-refresh every 6 hours
setInterval(() => {
    refreshPhotoLibrary().catch(err => console.error("❌ Photo refresh failed:", err.message));
}, 6 * 60 * 60 * 1000);

// ==========================================
// 🧠 4. JPRESSO KNOWLEDGE BASE (BLOOMDAILY-FOCUSED)
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
Free shipping: Peninsular Malaysia | East Malaysia: RM 15

🎯 SIZE STRATEGY (Weber's Law — ALWAYS LEAD WITH 500g):
- 500g saves ~RM 8-17 vs buying 2x 250g
- 500g = "The Smart Choice" for anyone drinking coffee 3+ times/week
- 250g is for "first-time trial" or "gift" framing only
- Typical savings: 12-13% better value per gram on 500g

=== SIGNATURE BLENDS (Jpresso in-house recipes) ===

MOON WHITE BLEND (BESTSELLER, everyday tier)
- 250g: RM 40  |  500g: RM 70  (save RM 10, 12.5% better value)
- Notes: Smooth, milk chocolate, caramel, clean finish
- Roast: Medium Dark  |  Brew: Espresso at 93°C or drip coffee
- Best for: Espresso, milk drinks, everyday daily driver

PHOENIX DAS BLEND (PREMIUM signature)
- 250g: RM 49  |  500g: RM 86  (save RM 12)
- Notes: Bold, rich, dark chocolate, caramel, full body
- Roast: Medium Dark  |  Brew: Espresso 18g:36g at 93°C, great in lattes
- Best for: Espresso 18g:36g, latte art, premium café operations

CHAM VELVET BLEND (specialty)
- 250g: RM 48  |  500g: RM 84  (save RM 12)
- Notes: Velvety, cocoa, brown sugar, silky mouthfeel
- Roast: Medium  |  Brew: Espresso or pour-over at 92°C

EMERALD WHITE BLEND (specialty)
- 250g: RM 48  |  500g: RM 84  (save RM 12)
- Notes: Complex, fruity, dark chocolate undertones
- Roast: Medium Dark  |  Brew: Espresso or pour-over at 92°C

BABYDAS BLEND (everyday comfort)
- 250g: RM 38  |  500g: RM 66  (save RM 10)
- Notes: Balanced, sweet, smooth, everyday comfort
- Roast: Medium  |  Brew: Versatile — espresso, drip, or pour-over

SUNRISE WALKER BLEND (specialty — fruity morning brew)
- 250g: RM 43  |  500g: RM 75  (save RM 11)
- Notes: Bright, fruity, balanced, morning cup
- Roast: Medium  |  Brew: Pour-over or drip at 92°C

SUNRISE DREAMER BLEND (everyday espresso)
- 250g: RM 40  |  500g: RM 70  (save RM 10)
- Notes: Rich, bold, cocoa, toasted almond
- Roast: Medium Dark  |  Brew: Espresso 18g:38g at 93°C

=== SINGLE ORIGINS — EVERYDAY TIER ===

BRAZIL SANTOS (Medium — DARK available)
- 250g: RM 35  |  500g: RM 61  (save RM 9)
- Notes: Nutty, chocolatey, smooth body, low acidity
- Best for: Espresso or pour-over at 92°C
- DARK version: Dark chocolate, caramel, toasted nuts, full body, espresso 18g:36g at 93°C

BRAZIL CERRADO (Medium — DARK available)
- 250g: RM 35  |  500g: RM 61
- Notes: Sweet, nutty, milk chocolate, clean finish
- Best for: Pour-over at 92°C, 1:16
- DARK version: Dark chocolate, hazelnut, caramel, bold body

MANDHELING G1 (Indonesia — DARK available)
- 250g: RM 35  |  500g: RM 61
- Notes: Earthy, herbal, dark chocolate, full body
- Process: Wet Hulled (Sumatra)
- Best for: French press or pour-over at 93°C
- DARK version: Smoky, earthy, bittersweet cocoa, spice

COLOMBIA SUPREMO (LIGHT / MEDIUM / DARK available)
- 250g: RM 38  |  500g: RM 66  (save RM 10)
- Notes (Medium): Balanced, caramel, milk chocolate, clean
- Best for: Pour-over or AeroPress at 93°C
- LIGHT: Bright citrus, caramel, juicy, floral hints — V60 at 92°C
- DARK: Brown sugar, dark chocolate, walnut, smooth — Espresso at 93°C

GUATEMALA ANTIGUA (LIGHT / MEDIUM available)
- 250g: RM 40  |  500g: RM 70  (save RM 10)
- Notes (Medium): Cocoa, orange peel, spice, balanced
- Origin: Antigua Valley
- Best for: Pour-over at 92°C
- LIGHT: Citrus, floral, bright acidity, smooth finish — V60 at 91°C

=== SINGLE ORIGINS — SPECIALTY TIER ===

GUATEMALA HUEHUETENANGO
- 250g: RM 42  |  500g: RM 74  (save RM 10)
- Notes: Wine-like, stone fruit, chocolate, complex
- Origin: Huehuetenango Region
- Best for: V60 at 92°C, 1:15

ETHIOPIA LEKEMPTI (Natural process)
- 250g: RM 44  |  500g: RM 77  (save RM 11)
- Notes: Fruity, winey, blueberry, wild berry
- Origin: Lekempti, Wollega
- Best for: AeroPress or V60 at 91°C

ETHIOPIA YIRGACHEFFE ARICHA WEBANCHI (Filter roast)
- 250g: RM 71  |  500g: RM 124  (save RM 18)
- Notes: Floral, bright citrus, bergamot, tea-like
- Origin: Aricha Webanchi, Yirgacheffe (Heirloom varietal)
- Best for: V60 at 91°C, 1:16

ETHIOPIA YIRGACHEFFE AMEDERARO (Filter roast)
- 250g: RM 71  |  500g: RM 124  (save RM 18)
- Notes: Jasmine, lemon zest, peach, silky
- Origin: Amederaro, Yirgacheffe (Heirloom varietal)
- Best for: Pour-over at 90°C

EL SALVADOR LA FANY (Medium — FILTER roast available)
- 250g: RM 57  |  500g: RM 100  (save RM 14)
- Notes (Medium): Sweet, honey, stone fruit, balanced acidity
- Origin: Finca La Fany
- Best for: Pour-over at 92°C, 1:16
- FILTER version: Bright, floral, peach, clean cup — V60 at 91°C

INDONESIA SUMATRA MOUNT KERINCI
- 250g: RM 66  |  500g: RM 116  (save RM 16)
- Origin: Alko Sumatra Kopi, Kerinci  |  Altitude: 1,300-1,650m
- Varietal: Andungsari/Sigararutang
- 4 processes available, each in MEDIUM or DARK roast:
  • FULL WASHED — Grassy, spicy, nutty, lemon, strong & smooth body
  • HONEY — Grassy, spicy, fruit, black tea, smooth body (sweetest)
  • NATURAL — Spicy, fruity, black tea, lemon, smooth body (fruitiest)
  • SEMI WASHED — Grassy, spicy, nutty, fruity, smooth body (balanced)
- If asked: "Which process?" → Ask customer preference (Honey = sweetest, Natural = fruitiest, Full Washed = cleanest, Semi Washed = balanced)
- Medium: Pour-over at 92°C  |  Dark: Espresso 18g:36g at 93-94°C

=============================================================
=== WHOLESALE (10kg minimum — order direct with Sophia) ===
=============================================================
SECTION A — Single Origin (RM 80/kg): Indonesia Mandheling
SECTION B — Signature Blends (RM 85/kg): Moon White, Brazil Cerrado, Cham Velvet
SECTION C — Premium Blends: Sunrise Dreamer RM 90/kg, Emerald White RM 90/kg, Phoenix Das RM 95/kg

=============================================================
=== OEM ROASTING: RM 15/kg (5kg min) ===
=============================================================
Customer supplies green beans (or we source). Custom roast profile. Private label packaging.

=============================================================
=== MATH OF QUALITY (wholesale price objection) ===
=============================================================
RM 1,500 monthly difference = RM 0.27 per double shot. Offer 200g Calibration Sample.

=============================================================
=== BREWING GUIDELINES ===
=============================================================
- Espresso rest: 10-14 days after roast | Filter/light rest: 7-10 days
- Pour-over: Tetsu Kasuya 4:6 method
- Espresso: 1:2 ratio, 25-32 sec, 92-94°C
- Grind (Timemore C5 Pro): Espresso 7-12 clicks | V60 15-24 | French Press 24+

=============================================================
=== EQUIPMENT (bloomdaily.io too) ===
=============================================================
Timemore C5 Pro Grinder RM 430 | Black Mirror Scale RM 199/259 | V60 Set RM 138-158 | Meraki Espresso Machine RM 8,599
`;

// ==========================================
// 🧠 5. SOPHIA SYSTEM PROMPT
// ==========================================
const SOPHIA_SYSTEM_PROMPT = `
You are Sophia — AI Assistant, Product Marketing Lead, Coffee Knowledge Authority, and Brand Ambassador of Big Jpresso Sdn Bhd.

CRITICAL: You MUST respond in STRICT JSON format for EVERY reply. Nothing before, nothing after.

Output schema:
{
  "reply": "Your natural conversational reply, first-person as Sophia, warm + 'Boss' tone",
  "confidence": <integer 1-10>,
  "alert_type": "NONE" | "ORDER_PLACED" | "LOW_CONFIDENCE" | "COMPLAINT" | "ESCALATION",
  "alert_details": "If alert_type is not NONE, summarize for Boss Jason. Otherwise empty string."
}

=== ALERT TRIGGERS ===
- ORDER_PLACED: Customer confirms wholesale/OEM order ("I'll take 20kg", "confirm order", "send invoice")
- LOW_CONFIDENCE: Unfamiliar question, can't answer with knowledge base (confidence ≤ 5)
- COMPLAINT: Angry/refund/"this is terrible"
- ESCALATION: Customer asks for Jason/owner/"real person"
- NONE: Normal conversations

=== CORE VOICE RULES ===
- First-person. You ARE Sophia.
- Call customers "Boss"
- Warm, confident, Chief Coffee Officer energy
- Zero generic AI fluff

=== CHANNEL ROUTING ===

📦 RETAIL (250g / 500g questions, home use, individuals):
→ ALWAYS pitch bloomdaily.io: https://bloomdaily.io/subscribe.html
→ NEVER mention Shopee unless customer asks first (then: "Yes, we're on Shopee too — but bloomdaily.io is our direct-from-roastery home, where the best selection and subscription savings live.")
→ ALWAYS lead with 500g as "the smart choice" (Weber's Law upsell)
→ Free shipping within Peninsular Malaysia

☕ WHOLESALE (10kg+, cafés, "bulk"):
→ Quote per-kg tier pricing (Section A/B/C)
→ 10kg minimum
→ Take order directly via WhatsApp
→ If price objection → "Math of Quality" pitch

🏭 OEM:
→ RM 15/kg, 5kg min
→ Ask: brand name, target roast, monthly volume, green beans source

UNCLEAR → Ask: "Boss, buying for personal use or your café?"

=== CRITICAL: 500g UPSELL STRATEGY ===

When a customer asks about any bean, ALWAYS present 500g as the default recommendation:
- "Moon White is RM 70 for 500g — that's my recommendation. You also have 250g at RM 40, but on 500g you save RM 10 (about 12.5% better value per gram)."
- Frame 250g only for "first-time trial" or "gift" scenarios
- Explain WHY 500g makes sense: daily drinkers, café pros, freshness (you finish in 2-3 weeks, perfect brew window)

=== PRODUCT EXAMPLES TO ANCHOR LANGUAGE ===

<example_retail_upsell>
User: How much is Moon White?
JSON: {"reply": "Boss, Moon White is our bestseller for lattes — milk chocolate, caramel, clean finish. On bloomdaily.io:\\n\\n• 500g at RM 70 (my recommendation — save RM 10 vs 250g)\\n• 250g at RM 40 (good for first-time try)\\n\\nFree shipping within Peninsular Malaysia. Order direct: https://bloomdaily.io/subscribe.html\\n\\nAre you brewing espresso or drip? I can suggest the perfect grind setting too!", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_retail_upsell>

<example_roast_variant>
User: Do you have Brazil Santos?
JSON: {"reply": "Yes Boss! Brazil Santos is one of my personal everyday picks — nutty, chocolatey, smooth body, low acidity. Available in:\\n\\n• Medium roast (balanced) or Dark roast (bolder, more chocolate)\\n• 500g RM 61 (smart choice) | 250g RM 35\\n\\nWhich roast style do you lean toward — Medium or Dark? And espresso or pour-over?\\n\\nOrder at https://bloomdaily.io/subscribe.html", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_roast_variant>

<example_order_placed>
User: Confirmed. I'll take 20kg Phoenix Das monthly.
JSON: {"reply": "Excellent decision, Boss! Locking in 20kg Phoenix Das monthly — that's our premium espresso blend, perfect for high-volume cafés. Section C @ RM 95/kg = RM 1,900/month. Let me pass this to the Chief to prepare your invoice and confirm delivery schedule. What's your café name and delivery address?", "confidence": 10, "alert_type": "ORDER_PLACED", "alert_details": "20kg Phoenix Das MONTHLY | Section C Premium @ RM 95/kg | Est RM 1,900/month"}
</example_order_placed>

<example_yirgacheffe>
User: How much is Yirgacheffe?
JSON: {"reply": "Boss, you've got great taste — Yirgacheffe is Ethiopia's finest. I have two washed lots right now:\\n\\n✨ Aricha Webanchi — Floral, bright citrus, bergamot, tea-like\\n✨ Amederaro — Jasmine, lemon zest, peach, silky\\n\\nBoth filter roasts, best for V60 or pour-over @ 91°C.\\n\\nPricing: 500g RM 124 (smart pick) | 250g RM 71\\n\\nOrder at https://bloomdaily.io/subscribe.html — free shipping within Peninsular Malaysia. Which flavor profile calls to you?", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_yirgacheffe>

<example_kerinci>
User: What's Mount Kerinci?
JSON: {"reply": "Ah Boss, great question — Mount Kerinci is Sumatran specialty at its finest. Grown at 1,300-1,650m by Alko Sumatra Kopi. Notes: grassy, spicy, nutty, lemon, smooth body.\\n\\nWhat makes it special — we offer it in 4 processes:\\n• Full Washed (cleanest, brightest)\\n• Honey (sweet, fruity)\\n• Natural (fruitiest, most complex)\\n• Semi Washed (balanced)\\n\\nEach in Medium or Dark roast.\\n\\nPricing: 500g RM 116 (recommended) | 250g RM 66\\n\\nWhich process calls to you? Tell me your brewing style and I'll suggest the perfect match. Order: https://bloomdaily.io/subscribe.html", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_kerinci>

<example_low_confidence>
User: Do you offer 60-day credit terms?
JSON: {"reply": "Boss, payment terms for new accounts is the Chief's call. Let me flag him now — he'll come back to you shortly. In the meantime, tell me about your café and which beans interest you!", "confidence": 3, "alert_type": "LOW_CONFIDENCE", "alert_details": "Customer asking about 60-day credit terms — not in knowledge base, need Jason to respond."}
</example_low_confidence>

<example_complaint>
User: My Moon White tasted burnt. Want refund.
JSON: {"reply": "Boss, I'm really sorry — that's not the Moon White experience we stand for. Let me get the Chief on this right away. Can you share your order number and when you received it? He'll review and make it right personally.", "confidence": 4, "alert_type": "COMPLAINT", "alert_details": "Customer reports burnt Moon White, requesting refund. Needs Jason immediately."}
</example_complaint>

REMEMBER: Response MUST be valid JSON starting with { and ending with }. No markdown fences. No prose before/after.
`;

// ==========================================
// 🛡️ 6. META VERIFICATION
// ==========================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED!');
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
});

// ==========================================
// 📥 7. RECEIVE INCOMING MESSAGES
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        const receivedAt = new Date().toISOString();

        if (body.entry?.[0]?.changes?.[0]?.value?.statuses) {
            console.log(`📬 [${receivedAt}] WA status callback (ignored)`);
            return res.sendStatus(200);
        }
        if (body.entry?.[0]?.messaging?.[0]?.read || body.entry?.[0]?.messaging?.[0]?.delivery) {
            console.log(`📬 [${receivedAt}] IG status callback (ignored)`);
            return res.sendStatus(200);
        }

        console.log(`\n📬 [${receivedAt}] INCOMING MESSAGE:`, JSON.stringify(body, null, 2));

        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const senderName = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Unknown";
                const messageText = webhook_event.text?.body || "No text";

                console.log(`📥 [WhatsApp] ${senderName} (+${senderNumber}): "${messageText}"`);

                // 💰 Boss commands: USAGE / COST / STATUS — instant cost report
                if (senderNumber === BOSS_PHONE) {
                    const upperText = messageText.trim().toUpperCase();
                    
                    // 🔄 RESCAN: Force photo library refresh
                    if (upperText === 'RESCAN' || upperText === 'REFRESH PHOTOS') {
                        await sendWhatsAppMessage(BOSS_PHONE, "🔍 Scanning Supabase for photos... (check logs for details)");
                        const count = await refreshPhotoLibrary();
                        await sendWhatsAppMessage(BOSS_PHONE, `✅ Photo library refreshed.\n\n📸 Total images indexed: ${count}\n\nBreakdown:\n${PHOTO_FOLDERS.map(f => {
                            const n = PHOTO_LIBRARY.filter(p => p.file.startsWith(f + '/')).length;
                            return `  /${f}: ${n}`;
                        }).join('\n')}`);
                        return res.sendStatus(200);
                    }
                    
                    // 🛑 RESET COST: Override hard cap — resume Sophia after investigation
                    if (upperText === 'RESET COST' || upperText === 'RESUME SOPHIA' || upperText === 'OVERRIDE CAP') {
                        dailyUsage.capOverride = true;
                        // Clear the alert flags so warnings can fire again if needed
                        delete dailyUsage.warningsSent.cap_daily_triggered;
                        delete dailyUsage.warningsSent.cap_monthly_triggered;
                        
                        await sendWhatsAppMessage(BOSS_PHONE, `✅ HARD CAP OVERRIDE ACTIVE

Sophia is resuming normal operation.

⚠️ Current state:
• Today: RM ${dailyUsage.costMYR.toFixed(2)} (cap was RM ${COST_CONFIG.DAILY_HARD_CAP})
• Month: RM ${monthlyUsage.costMYR.toFixed(2)} (cap was RM ${COST_CONFIG.MONTHLY_HARD_CAP})
• Blocked calls today: ${dailyUsage.blockedCalls}

Override resets at midnight MYT (or next server restart).

Monitor carefully. Text "USAGE" anytime for status.`);
                        console.log(`⚠️ Boss overrode hard cap — Sophia resumed`);
                        return res.sendStatus(200);
                    }
                    
                    if (upperText === 'USAGE' || upperText === 'COST' || upperText === 'STATUS') {
                        const statusEmoji = dailyUsage.costMYR < COST_CONFIG.DAILY_WARNING ? '🟢 Healthy' :
                                            dailyUsage.costMYR < COST_CONFIG.DAILY_CRITICAL ? '🟡 Elevated' : '🔴 Critical';
                        
                        // Hard cap status line
                        const capStatus = dailyUsage.capOverride ? '⚠️ OVERRIDE ACTIVE' :
                                         dailyUsage.costMYR >= COST_CONFIG.DAILY_HARD_CAP ? '🛑 DAILY CAP HIT' :
                                         monthlyUsage.costMYR >= COST_CONFIG.MONTHLY_HARD_CAP ? '🛑 MONTHLY CAP HIT' :
                                         '✅ Within caps';
                        
                        const dailyCapPct = ((dailyUsage.costMYR / COST_CONFIG.DAILY_HARD_CAP) * 100).toFixed(0);
                        const monthlyCapPct = ((monthlyUsage.costMYR / COST_CONFIG.MONTHLY_HARD_CAP) * 100).toFixed(0);
                        
                        // 🌐 Fetch unified tracking (if configured)
                        const unified = await getUnifiedCostData();
                        
                        let unifiedSection = "";
                        if (unified) {
                            const otherPct = unified.today.total > 0 ? ((unified.today.other / unified.today.total) * 100).toFixed(0) : 0;
                            unifiedSection = `

━━ 🌐 ALL ANTHROPIC APPS ━━
💰 Total today: RM ${unified.today.total.toFixed(2)} ($${unified.today.totalUSD.toFixed(2)})
💰 Total this month: RM ${unified.month.total.toFixed(2)} ($${unified.month.totalUSD.toFixed(2)})

━━ BREAKDOWN (TODAY) ━━
• Sophia WhatsApp: RM ${unified.today.sophia.toFixed(2)}
• Other apps: RM ${unified.today.other.toFixed(2)} (${otherPct}%)
  (Enterprise OS, Claude Code, etc.)

(Admin data cached ${Math.round((Date.now() - unified.cachedAt.getTime()) / 60000)} min ago)`;
                        } else if (ANTHROPIC_ADMIN_KEY) {
                            unifiedSection = `\n\n⚠️ Admin API unreachable: ${adminCostCache.lastError || 'unknown'}`;
                        } else {
                            unifiedSection = `\n\n💡 Set ANTHROPIC_ADMIN_KEY env var for total-spend tracking across all apps`;
                        }
                        
                        const report = `📊 INSTANT USAGE CHECK

🕐 ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}

━━ SOPHIA WHATSAPP (TODAY) ━━
💬 Calls: ${dailyUsage.calls}
📥 In tokens: ${dailyUsage.inputTokens.toLocaleString()}
📤 Out tokens: ${dailyUsage.outputTokens.toLocaleString()}
💰 Cost: RM ${dailyUsage.costMYR.toFixed(2)} ($${dailyUsage.costUSD.toFixed(2)})
📊 Avg: RM ${dailyUsage.calls > 0 ? (dailyUsage.costMYR / dailyUsage.calls).toFixed(3) : '0.000'}/call
Status: ${statusEmoji}

━━ SOPHIA WHATSAPP (MONTH) ━━
💬 Calls: ${monthlyUsage.calls}
💰 Spent: RM ${monthlyUsage.costMYR.toFixed(2)}
📈 ${((monthlyUsage.costMYR / COST_CONFIG.MONTHLY_BUDGET) * 100).toFixed(1)}% of RM ${COST_CONFIG.MONTHLY_BUDGET} budget${unifiedSection}

━━ 🛑 HARD CAPS ━━
${capStatus}
Daily: RM ${dailyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.DAILY_HARD_CAP} (${dailyCapPct}%)
Monthly: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_HARD_CAP} (${monthlyCapPct}%)
Blocked calls today: ${dailyUsage.blockedCalls}

💡 COMMANDS:
• RESET COST → override cap and resume
• RESCAN → refresh photo library
• REFRESH COST → force refresh admin API`;
                        await sendWhatsAppMessage(BOSS_PHONE, report);
                        return res.sendStatus(200);
                    }
                    
                    // 🔄 REFRESH COST: Force immediate admin API fetch
                    if (upperText === 'REFRESH COST' || upperText === 'REFRESH ADMIN') {
                        await sendWhatsAppMessage(BOSS_PHONE, "🌐 Fetching latest data from Anthropic Admin API...");
                        await refreshAdminCostData();
                        const unified = await getUnifiedCostData();
                        if (unified) {
                            await sendWhatsAppMessage(BOSS_PHONE, `✅ Admin data refreshed.\n\nToday total: RM ${unified.today.total.toFixed(2)}\nMonth total: RM ${unified.month.total.toFixed(2)}\n\nText USAGE for full report.`);
                        } else {
                            await sendWhatsAppMessage(BOSS_PHONE, `❌ Admin API unreachable.\n\nError: ${adminCostCache.lastError || 'unknown'}\n\nCheck ANTHROPIC_ADMIN_KEY env var in Render.`);
                        }
                        return res.sendStatus(200);
                    }
                }

                if (senderNumber === BOSS_PHONE && isMarketingApprovalReply(messageText)) {
                    await handleMarketingApproval(senderNumber, messageText);
                    return res.sendStatus(200);
                }

                const aiResponse = await routeToAgentTeam(senderNumber, messageText, senderName);
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: aiResponse.reply, platform: "WhatsApp", alert_type: aiResponse.alert_type });
                await sendWhatsAppMessage(senderNumber, aiResponse.reply);

                if (aiResponse.alert_type !== "NONE" && senderNumber !== BOSS_PHONE) {
                    await sendBossAlert({
                        alert_type: aiResponse.alert_type,
                        alert_details: aiResponse.alert_details,
                        customer_phone: senderNumber,
                        customer_name: senderName,
                        customer_message: messageText,
                        sophia_reply: aiResponse.reply,
                        confidence: aiResponse.confidence,
                        platform: "WhatsApp"
                    });
                }
            }
        }

        if (body.object === 'instagram') {
            const messagingEvent = body.entry?.[0]?.messaging?.[0];
            const changesEvent = body.entry?.[0]?.changes?.[0]?.value;

            if (messagingEvent?.message?.is_echo || changesEvent?.message?.is_echo) {
                console.log("🤫 Echo detected. Ignoring.");
            } else {
                let igSenderId = null;
                let messageText = "No text";

                if (messagingEvent && messagingEvent.message) {
                    igSenderId = messagingEvent.sender.id;
                    messageText = messagingEvent.message.text || "No text";
                } else if (changesEvent && changesEvent.message) {
                    igSenderId = changesEvent.sender.id;
                    messageText = changesEvent.message.text || "No text";
                }

                if (igSenderId) {
                    console.log(`📥 [Instagram] ${igSenderId}: "${messageText}"`);
                    const aiResponse = await routeToAgentTeam(igSenderId, messageText, "IG User");
                    await syncLeadToSheet({ phone: igSenderId, msg: messageText, reply: aiResponse.reply, platform: "Instagram", alert_type: aiResponse.alert_type });
                    await sendInstagramMessage(igSenderId, aiResponse.reply);

                    if (aiResponse.alert_type !== "NONE") {
                        await sendBossAlert({
                            alert_type: aiResponse.alert_type,
                            alert_details: aiResponse.alert_details,
                            customer_phone: igSenderId,
                            customer_name: "IG User",
                            customer_message: messageText,
                            sophia_reply: aiResponse.reply,
                            confidence: aiResponse.confidence,
                            platform: "Instagram"
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
// 🛠️ 8. CORE FUNCTIONS
// ==========================================

async function sendWhatsAppMessage(recipientPhone, textMsg) {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: textMsg, preview_url: true }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) console.log(`✅ WhatsApp delivered!`);
        else console.error(`❌ WhatsApp API Error:`, await response.text());
    } catch (err) {
        console.error("❌ WhatsApp Network Error:", err);
    }
}

async function sendInstagramMessage(recipientId, textMsg) {
    const url = `https://graph.facebook.com/v20.0/me/messages`;
    const payload = { recipient: { id: recipientId }, message: { text: textMsg } };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${IG_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) console.log(`✅ IG delivered!`);
        else console.error(`❌ IG API Error:`, await response.text());
    } catch (err) {
        console.error("❌ IG Network Error:", err);
    }
}

// ==========================================
// 🚨 9. BOSS ALERT
// ==========================================
async function sendBossAlert(alertData) {
    const lastAlertAt = recentAlerts.get(alertData.customer_phone);
    const now = Date.now();
    if (lastAlertAt && (now - lastAlertAt) < 5 * 60 * 1000) {
        console.log(`🚨 Alert suppressed (rate-limited)`);
        return;
    }
    recentAlerts.set(alertData.customer_phone, now);

    const emojiMap = { "ORDER_PLACED": "🛒", "LOW_CONFIDENCE": "🆘", "COMPLAINT": "⚠️", "ESCALATION": "📞" };
    const titleMap = { "ORDER_PLACED": "WHOLESALE/OEM ORDER PLACED", "LOW_CONFIDENCE": "SOPHIA NEEDS HELP", "COMPLAINT": "CUSTOMER COMPLAINT", "ESCALATION": "ESCALATION REQUEST" };

    const emoji = emojiMap[alertData.alert_type] || "🔔";
    const title = titleMap[alertData.alert_type] || "ALERT";
    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour12: false });

    const alertMessage = `${emoji} ${title} ${emoji}

📅 ${timestamp} MYT
📱 ${alertData.platform}
👤 ${alertData.customer_name}
📞 +${alertData.customer_phone}

━━━ DETAILS ━━━
${alertData.alert_details}

━━━ CUSTOMER SAID ━━━
"${alertData.customer_message}"

━━━ SOPHIA REPLIED ━━━
"${alertData.sophia_reply}"

Confidence: ${alertData.confidence}/10

→ wa.me/${alertData.customer_phone}`;

    try {
        await sendWhatsAppMessage(BOSS_PHONE, alertMessage);
        console.log(`🚨 ALERT fired: ${alertData.alert_type}`);

        await syncLeadToSheet({
            phone: alertData.customer_phone,
            msg: `[ALERT: ${alertData.alert_type}] ${alertData.customer_message}`,
            reply: alertData.sophia_reply,
            platform: alertData.platform,
            alert_type: alertData.alert_type,
            alert_details: alertData.alert_details,
            confidence: alertData.confidence
        });
    } catch (err) {
        console.error("❌ Alert send failed:", err.message);
    }
}

async function syncLeadToSheet(leadData) {
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/ejfq479exd8g3sotzimim8qr6uebyk93";
    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });
        if (response.ok) console.log("✅ Synced to Make.com!");
    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    }
}

// ==========================================
// 💰 COST TRACKING FUNCTIONS
// ==========================================
function calculateCost(inputTokens, outputTokens) {
    const inputCost = (inputTokens / 1_000_000) * COST_CONFIG.INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * COST_CONFIG.OUTPUT_COST_PER_1M;
    const totalUSD = inputCost + outputCost;
    const totalMYR = totalUSD * COST_CONFIG.USD_TO_MYR;
    return { totalUSD, totalMYR };
}

async function trackAPIUsage(inputTokens, outputTokens, source = "customer_service") {
    const today = new Date().toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    
    // Reset counter if new day
    if (dailyUsage.date !== today) {
        console.log(`📅 New day — previous: RM ${dailyUsage.costMYR.toFixed(2)} / ${dailyUsage.calls} calls`);
        Object.assign(dailyUsage, {
            date: today, calls: 0, inputTokens: 0, outputTokens: 0,
            costUSD: 0, costMYR: 0, warningsSent: {},
            capOverride: false, blockedCalls: 0
        });
    }
    
    const { totalUSD, totalMYR } = calculateCost(inputTokens, outputTokens);
    
    dailyUsage.calls++;
    dailyUsage.inputTokens += inputTokens;
    dailyUsage.outputTokens += outputTokens;
    dailyUsage.costUSD += totalUSD;
    dailyUsage.costMYR += totalMYR;
    
    monthlyUsage.calls++;
    monthlyUsage.costMYR += totalMYR;
    
    console.log(`💰 [${source}] In:${inputTokens} Out:${outputTokens} | RM${totalMYR.toFixed(3)} | Day: RM${dailyUsage.costMYR.toFixed(2)}`);
    
    await checkCostThresholds();
}

async function checkCostThresholds() {
    // Daily warning at RM 20
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_WARNING && !dailyUsage.warningsSent.daily_warning) {
        dailyUsage.warningsSent.daily_warning = true;
        const msg = `⚠️ DAILY COST WARNING ⚠️

Boss, Sophia crossed RM ${COST_CONFIG.DAILY_WARNING} today.

Spend: RM ${dailyUsage.costMYR.toFixed(2)}
Calls: ${dailyUsage.calls}
Avg/call: RM ${(dailyUsage.costMYR / dailyUsage.calls).toFixed(3)}

Monthly: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_BUDGET} budget

Heads-up only. Sophia still operating normally.`;
        await sendWhatsAppMessage(BOSS_PHONE, msg);
        console.log(`⚠️ Daily warning fired: RM ${dailyUsage.costMYR.toFixed(2)}`);
    }
    
    // Daily CRITICAL at RM 50
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_CRITICAL && !dailyUsage.warningsSent.daily_critical) {
        dailyUsage.warningsSent.daily_critical = true;
        const msg = `🚨🚨🚨 CRITICAL COST ALERT 🚨🚨🚨

Boss, Sophia crossed RM ${COST_CONFIG.DAILY_CRITICAL} TODAY.

Spend: RM ${dailyUsage.costMYR.toFixed(2)}
Calls: ${dailyUsage.calls}

Possible causes:
• Viral traffic spike
• Spam/abusive customer
• Infinite loop bug

IMMEDIATE ACTIONS:
1. Check Render logs
2. Review recent conversations
3. Consider pausing Sophia (Render → Suspend Service)

Anthropic hard cap protects against runaway damage.`;
        await sendWhatsAppMessage(BOSS_PHONE, msg);
        console.log(`🚨 CRITICAL threshold fired: RM ${dailyUsage.costMYR.toFixed(2)}`);
    }
    
    // Monthly 80% warning (once per day)
    const monthlyWarnKey = `monthly_80_${new Date().getDate()}`;
    if (monthlyUsage.costMYR >= (COST_CONFIG.MONTHLY_BUDGET * 0.8) && !dailyUsage.warningsSent[monthlyWarnKey]) {
        dailyUsage.warningsSent[monthlyWarnKey] = true;
        await sendWhatsAppMessage(BOSS_PHONE, `⚠️ MONTHLY BUDGET 80% USED

Sophia used RM ${monthlyUsage.costMYR.toFixed(2)} of RM ${COST_CONFIG.MONTHLY_BUDGET}.

Calls this month: ${monthlyUsage.calls}

Consider reviewing usage.`);
    }
}

// ==========================================
// 🛑 HARD CAP ENFORCEMENT — STOPS SOPHIA FROM REPLYING
// ==========================================
// Called BEFORE every Anthropic API call. Returns true if Sophia should stop.
function isCostCapExceeded() {
    // Boss can override via "RESET COST" command
    if (dailyUsage.capOverride) {
        return false;
    }
    
    // Check daily cap
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_HARD_CAP) {
        return { reason: 'daily', current: dailyUsage.costMYR, cap: COST_CONFIG.DAILY_HARD_CAP };
    }
    
    // Check monthly cap
    if (monthlyUsage.costMYR >= COST_CONFIG.MONTHLY_HARD_CAP) {
        return { reason: 'monthly', current: monthlyUsage.costMYR, cap: COST_CONFIG.MONTHLY_HARD_CAP };
    }
    
    return false;
}

// Send ONE alert to Boss when the cap first triggers
async function notifyCapTriggered(cap) {
    const alertKey = `cap_${cap.reason}_triggered`;
    if (dailyUsage.warningsSent[alertKey]) return; // Already alerted today
    
    dailyUsage.warningsSent[alertKey] = true;
    
    const msg = `🛑🛑🛑 SOPHIA STOPPED 🛑🛑🛑

${cap.reason.toUpperCase()} HARD CAP HIT

Current: RM ${cap.current.toFixed(2)}
Cap: RM ${cap.cap.toFixed(2)}

Sophia has STOPPED replying to customers.
Customers receive a polite "we'll reply soon" message.

POSSIBLE CAUSES:
• Viral traffic spike
• Spam/abusive customer
• Runaway loop bug

TO RESUME SOPHIA:
1. Investigate Render logs + recent chats
2. Fix the root cause if needed
3. Text "RESET COST" to Sophia to override

⚠️ This protects your API wallet from runaway damage.`;
    
    await sendWhatsAppMessage(BOSS_PHONE, msg);
    console.log(`🛑 HARD CAP TRIGGERED: ${cap.reason} — Sophia stopped`);
}

// ==========================================
// 🌐 UNIFIED ANTHROPIC TRACKING (Admin API)
// ==========================================
// Queries Anthropic's Admin API to get TOTAL spending across ALL apps
// using your API key (Sophia WhatsApp + Enterprise OS + Claude Code + etc.)
//
// REQUIREMENTS:
// 1. Admin API key set as env var ANTHROPIC_ADMIN_KEY (starts with sk-ant-admin...)
// 2. Generate at: console.anthropic.com → Settings → Admin Keys
// 3. If not set, this module silently skips — regular Sophia tracking still works
//
// DATA NOTES:
// - Anthropic returns cost in USD cents (e.g. "123.45" = $1.23)
// - Data usually appears within 5 minutes of API call completion
// - We convert USD → MYR at the current exchange rate

const ANTHROPIC_COST_API = "https://api.anthropic.com/v1/organizations/cost_report";

// Cache admin data (don't spam the API on every USAGE check)
let adminCostCache = {
    today: null,        // { usd: 0, myr: 0, fetchedAt: Date }
    monthToDate: null,  // { usd: 0, myr: 0, fetchedAt: Date }
    lastError: null
};

async function fetchAnthropicCost(startDate, endDate) {
    // Skip gracefully if Admin key not configured
    if (!ANTHROPIC_ADMIN_KEY) {
        return null;
    }
    
    try {
        // Use full RFC 3339 format with milliseconds stripped
        // Example: "2026-04-21T00:00:00Z"
        const startingAt = startDate.toISOString().split('.')[0] + 'Z';
        const endingAt = endDate.toISOString().split('.')[0] + 'Z';
        
        // Double-check the range is valid before sending
        if (endDate.getTime() <= startDate.getTime()) {
            console.error(`❌ Invalid date range: ${startingAt} → ${endingAt} (end must be after start)`);
            return null;
        }
        
        const params = new URLSearchParams({
            starting_at: startingAt,
            ending_at: endingAt,
            bucket_width: '1d'  // Daily buckets — required for predictable responses
        });
        
        const url = `${ANTHROPIC_COST_API}?${params.toString()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'anthropic-version': '2023-06-01',
                'x-api-key': ANTHROPIC_ADMIN_KEY
            }
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Admin API error ${response.status} (${startingAt} → ${endingAt}): ${errText.slice(0, 200)}`);
            adminCostCache.lastError = `${response.status}: ${errText.slice(0, 100)}`;
            return null;
        }
        
        const data = await response.json();
        
        // Sum all cost entries across all time buckets
        // Amount is returned as decimal string in USD cents (e.g. "123.45" = $1.23)
        let totalCents = 0;
        if (data.data && Array.isArray(data.data)) {
            for (const bucket of data.data) {
                if (bucket.results && Array.isArray(bucket.results)) {
                    for (const entry of bucket.results) {
                        totalCents += parseFloat(entry.amount || "0");
                    }
                }
            }
        }
        
        const totalUSD = totalCents / 100;
        const totalMYR = totalUSD * COST_CONFIG.USD_TO_MYR;
        
        return { usd: totalUSD, myr: totalMYR, fetchedAt: new Date() };
        
    } catch (err) {
        console.error(`❌ Admin API fetch failed: ${err.message}`);
        adminCostCache.lastError = err.message;
        return null;
    }
}

// Refresh both today + month-to-date cached values
async function refreshAdminCostData() {
    if (!ANTHROPIC_ADMIN_KEY) {
        console.log("ℹ️ ANTHROPIC_ADMIN_KEY not set — unified tracking disabled");
        return;
    }
    
    const now = new Date();
    
    // 🕐 Get today's MYT date (for display + logic)
    const mytFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const mytDateString = mytFormatter.format(now); // "2026-04-23"
    const [mytYear, mytMonth, mytDay] = mytDateString.split('-').map(Number);
    
    // 🎯 CRITICAL: bucket_width=1d requires EXACT UTC DAY BOUNDARIES
    // (Anthropic's quirk — you can't send mid-day timestamps with daily bucketing)
    //
    // Strategy: Send UTC day boundaries that COVER the MYT period we want.
    // Then sum all buckets in the response to get accurate totals.
    //
    // For "today in MYT" (Apr 23 MYT = Apr 22 16:00 UTC → Apr 23 16:00 UTC):
    //   Request UTC days Apr 22 + Apr 23 (both days contain MYT "today")
    //   Anthropic returns 2 daily buckets, we sum them.
    //   Slight over-counting: captures some of yesterday evening + some of tomorrow morning UTC time.
    //   This is acceptable since most API usage happens during MYT waking hours anyway.
    
    // Today-window: yesterday's UTC 00:00 → tomorrow's UTC 00:00
    const todayUtcStart = new Date(Date.UTC(mytYear, mytMonth - 1, mytDay - 1, 0, 0, 0));
    const todayUtcEnd = new Date(Date.UTC(mytYear, mytMonth - 1, mytDay + 1, 0, 0, 0));
    
    // Month-window: 1st of month UTC → tomorrow's UTC 00:00
    const monthUtcStart = new Date(Date.UTC(mytYear, mytMonth - 1, 1, 0, 0, 0));
    const monthUtcEnd = todayUtcEnd;
    
    console.log(`🌐 Admin API range — Today UTC days: ${todayUtcStart.toISOString()} → ${todayUtcEnd.toISOString()}`);
    console.log(`🌐 Admin API range — Month UTC days: ${monthUtcStart.toISOString()} → ${monthUtcEnd.toISOString()}`);
    
    const [todayCost, monthCost] = await Promise.all([
        fetchAnthropicCost(todayUtcStart, todayUtcEnd),
        fetchAnthropicCost(monthUtcStart, monthUtcEnd)
    ]);
    
    if (todayCost) {
        adminCostCache.today = todayCost;
        console.log(`🌐 Admin API — Today: $${todayCost.usd.toFixed(2)} (RM ${todayCost.myr.toFixed(2)})`);
    }
    if (monthCost) {
        adminCostCache.monthToDate = monthCost;
        console.log(`🌐 Admin API — MTD:   $${monthCost.usd.toFixed(2)} (RM ${monthCost.myr.toFixed(2)})`);
    }
}

// Get cached data, refresh if stale (>10 min old)
async function getUnifiedCostData() {
    if (!ANTHROPIC_ADMIN_KEY) return null;
    
    const now = Date.now();
    const cacheAge = adminCostCache.today ? now - adminCostCache.today.fetchedAt.getTime() :
                     adminCostCache.monthToDate ? now - adminCostCache.monthToDate.fetchedAt.getTime() :
                     Infinity;
    
    // Refresh if cache is missing or >10 min old
    if (cacheAge > 10 * 60 * 1000) {
        await refreshAdminCostData();
    }
    
    // Return partial data if only one side succeeded
    if (!adminCostCache.today && !adminCostCache.monthToDate) return null;
    
    const sophiaToday = dailyUsage.costMYR;
    const sophiaMonth = monthlyUsage.costMYR;
    
    // Today data (fallback: if today missing, assume 0 external so just Sophia)
    const todayTotal = adminCostCache.today ? adminCostCache.today.myr : sophiaToday;
    const todayTotalUSD = adminCostCache.today ? adminCostCache.today.usd : dailyUsage.costUSD;
    
    // Monthly data (fallback: just Sophia if missing)
    const monthTotal = adminCostCache.monthToDate ? adminCostCache.monthToDate.myr : sophiaMonth;
    const monthTotalUSD = adminCostCache.monthToDate ? adminCostCache.monthToDate.usd : sophiaMonth / COST_CONFIG.USD_TO_MYR;
    
    return {
        today: {
            total: todayTotal,
            totalUSD: todayTotalUSD,
            sophia: sophiaToday,
            other: Math.max(0, todayTotal - sophiaToday),
            hasAdminData: !!adminCostCache.today
        },
        month: {
            total: monthTotal,
            totalUSD: monthTotalUSD,
            sophia: sophiaMonth,
            other: Math.max(0, monthTotal - sophiaMonth),
            hasAdminData: !!adminCostCache.monthToDate
        },
        cachedAt: (adminCostCache.today || adminCostCache.monthToDate).fetchedAt
    };
}

// Initial fetch on server start (non-blocking)
refreshAdminCostData().catch(err => console.error("Initial admin fetch failed:", err.message));

// Auto-refresh every 15 minutes
setInterval(() => {
    refreshAdminCostData().catch(err => console.error("Admin refresh failed:", err.message));
}, 15 * 60 * 1000);

// ==========================================
// 🧠 10. SOPHIA BRAIN
// ==========================================
async function routeToAgentTeam(senderId, messageText, senderName) {
    try {
        // 🛑 HARD CAP CHECK — stop BEFORE expensive API call
        const cap = isCostCapExceeded();
        if (cap) {
            dailyUsage.blockedCalls++;
            await notifyCapTriggered(cap);
            
            // Return graceful fallback — customer doesn't know it's a cost issue
            return {
                reply: "Hi Boss, sorry — our team is momentarily unavailable. Your message is important. We'll get back to you within a few hours. 🙏",
                confidence: 10,
                alert_type: null,
                alert_details: null
            };
        }
        
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

        while (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role !== "user") {
            formattedMessages.pop();
        }

        if (formattedMessages.length > 5) {
            formattedMessages = formattedMessages.slice(-5);
            if (formattedMessages[0].role !== "user") formattedMessages.shift();
        }

        console.log(`🧠 Sophia — ${formattedMessages.length} msgs → ${ACTIVE_MODEL}`);

        const msg = await anthropic.messages.create({
            model: ACTIVE_MODEL,
            max_tokens: 1200,
            system: SOPHIA_SYSTEM_PROMPT + "\n\n=== PRODUCTS ===\n" + JPRESSO_PRODUCTS,
            messages: formattedMessages
        });

        // 💰 Track API cost
        if (msg.usage) {
            await trackAPIUsage(
                msg.usage.input_tokens || 0,
                msg.usage.output_tokens || 0,
                "customer_service"
            );
        }

        const rawText = msg.content[0].text.trim();

        let parsed;
        try {
            const cleanText = rawText.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleanText);
        } catch (parseErr) {
            console.error("❌ JSON parse failed. Raw:", rawText);
            parsed = {
                reply: rawText,
                confidence: 5,
                alert_type: "LOW_CONFIDENCE",
                alert_details: "Sophia returned non-JSON output. Raw response logged."
            };
        }

        history.push({ role: "assistant", content: parsed.reply });
        if (history.length > 20) history = history.slice(-20);
        userSessions.set(senderId, history);

        console.log(`💬 Sophia (conf ${parsed.confidence}/10, alert=${parsed.alert_type}): "${parsed.reply.substring(0, 80)}..."`);

        return parsed;

    } catch (error) {
        console.error("❌ AI CRASH:", error.message);
        return {
            reply: "Sorry Boss, my internal boiler is resetting. Let me get the Chief to help you!",
            confidence: 0,
            alert_type: "LOW_CONFIDENCE",
            alert_details: "Sophia crashed — needs Jason."
        };
    }
}

// ==========================================
// 🎨 11. MARKETING WORKFLOW
// ==========================================

async function generateThreeDrafts() {
    const drafts = [];
    const angles = [
        { direction: "SOPHIA PERSONAL RECOMMENDATION — recommend a bean you love. Lead with 500g as the smart choice. Include https://bloomdaily.io/subscribe.html", photo_hint: "sophia_speaks OR sophia_drinks OR product_showcase" },
        { direction: "BEHIND-THE-SCENES CRAFT — Has Garanti/Santoker/48hr fresh. Build authority. Feature the curation via bloomdaily.io platform.", photo_hint: "roasting_craft OR sophia_roasts OR founders_story" },
        { direction: "LIFESTYLE / MORNING RITUAL — cozy KL scenario, feature a bean naturally. Weber's Law upsell. Include https://bloomdaily.io/subscribe.html", photo_hint: "sophia_lifestyle OR brewing_craft OR lifestyle" }
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const post = await anthropic.messages.create({
                model: ACTIVE_MODEL,
                max_tokens: 500,
                system: `You are Sophia writing for Jpresso Coffee IG + FB.

VOICE: First-person. You ARE Sophia.

PRODUCT CONTEXT: ${JPRESSO_PRODUCTS}

CAPTION RULES:
- Under 150 words, Manglish, 5-8 emojis, 8-10 hashtags
- CTA to https://bloomdaily.io/subscribe.html
- Lead with 500g as smart choice (Weber's Law)
- Works on IG + FB
- FIRST-PERSON voice

END WITH: PHOTO_THEMES: [tags: sophia_speaks, sophia_drinks, sophia_brews, sophia_roasts, sophia_lifestyle, product_showcase, bestseller, single_origin, filter_focused, roasting_craft, brewing_craft, lifestyle, founders_story, behind_scenes, KL_pride, authority, bean_showcase, welcome, aspirational]`,
                messages: [{ role: "user", content: `Write ONE caption. ${angles[i].direction}\n\nPhoto themes: ${angles[i].photo_hint}` }]
            });

            // 💰 Track marketing draft cost
            if (post.usage) {
                await trackAPIUsage(
                    post.usage.input_tokens || 0,
                    post.usage.output_tokens || 0,
                    "marketing_draft"
                );
            }

            const fullText = post.content[0].text.trim();
            const themeMatch = fullText.match(/PHOTO_THEMES:\s*(.+)$/m);
            const photoThemes = themeMatch ? themeMatch[1].split(',').map(t => t.trim().toLowerCase()) : [];
            const caption = fullText.replace(/PHOTO_THEMES:.*$/m, '').trim();
            const matchedPhoto = findBestPhoto(caption, photoThemes);

            drafts.push({ caption, themes: photoThemes, photo: matchedPhoto });
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
        for (const theme of themes) {
            if (photo.themes.some(pt => pt.toLowerCase().includes(theme) || theme.includes(pt.toLowerCase()))) score += 10;
        }
        for (const tag of photo.tags) {
            if (captionLower.includes(tag.toLowerCase().replace(/_/g, ' '))) score += 5;
            if (captionLower.includes(tag.toLowerCase())) score += 3;
        }
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

    let message = `☀️ Good morning, Boss! 3 IG + FB drafts for ${today}:\n\n`;
    drafts.forEach((draft, i) => {
        message += `━━━━━ DRAFT ${i + 1} ━━━━━\n${draft.caption}\n\n`;
        if (draft.photo) message += `📸 ${draft.photo.file}\n🔗 ${draft.photo.url}\n\n`;
        else message += `📸 (no match)\n\n`;
    });
    message += `━━━━━━━━━━━━━━━━━\nReply:\n✅ PICK 1 / PICK 2 / PICK 3\n🔄 RETRY\n❌ SKIP\n\n— Sophia`;

    pendingDrafts.set(BOSS_PHONE, { drafts, sentAt: new Date().toISOString() });
    await sendWhatsAppMessage(BOSS_PHONE, message);
    console.log(`📤 Sent 3 drafts to Boss.`);
}

function isMarketingApprovalReply(messageText) {
    const text = messageText.trim().toUpperCase();
    const keywords = ['PICK 1', 'PICK 2', 'PICK 3', 'RETRY', 'SKIP'];
    return pendingDrafts.has(BOSS_PHONE) && keywords.some(k => text === k || text.startsWith(k));
}

async function handleMarketingApproval(senderPhone, messageText) {
    const text = messageText.trim().toUpperCase();
    const pending = pendingDrafts.get(BOSS_PHONE);

    if (!pending) {
        await sendWhatsAppMessage(BOSS_PHONE, "Boss, no pending drafts. Tomorrow 9 AM = fresh ones! ☀️");
        return;
    }

    if (text.startsWith('PICK')) {
        const pickNum = parseInt(text.split(' ')[1]);
        if (pickNum >= 1 && pickNum <= 3) {
            const approved = pending.drafts[pickNum - 1];
            approvedPosts.push({ caption: approved.caption, photo: approved.photo, approvedAt: new Date().toISOString(), pickNumber: pickNum });

            let confirmMsg = `✅ Approved, Boss! Draft ${pickNum} ready.\n\n━━━ CAPTION ━━━\n${approved.caption}\n\n`;
            if (approved.photo) confirmMsg += `━━━ PHOTO ━━━\n${approved.photo.file}\n🔗 ${approved.photo.url}\n\nSave image → post to IG + FB.\n\n`;
            confirmMsg += `Tomorrow 9 AM = new batch. ☕`;

            await sendWhatsAppMessage(BOSS_PHONE, confirmMsg);
            pendingDrafts.delete(BOSS_PHONE);
            return;
        }
    }

    if (text === 'RETRY') {
        await sendWhatsAppMessage(BOSS_PHONE, "🔄 Regenerating... 30 sec.");
        const newDrafts = await generateThreeDrafts();
        await sendDraftsToBoss(newDrafts);
        return;
    }

    if (text === 'SKIP') {
        pendingDrafts.delete(BOSS_PHONE);
        await sendWhatsAppMessage(BOSS_PHONE, "❌ Skipped today. See you tomorrow, Boss! ☕");
        return;
    }
}

// ==========================================
// 📅 12. CRON — 9 AM MYT (Marketing drafts)
// ==========================================
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ [9 AM MYT] Marketing Team waking up...");
    try {
        const drafts = await generateThreeDrafts();
        await sendDraftsToBoss(drafts);
    } catch (err) {
        console.error("❌ Marketing loop failed:", err);
    }
}, { timezone: "Asia/Kuala_Lumpur" });

// ==========================================
// 💰 DAILY COST SUMMARY — 11 PM MYT
// ==========================================
cron.schedule('0 23 * * *', async () => {
    console.log("📊 Sending daily cost summary to Boss...");
    
    let statusEmoji = "🟢";
    let statusText = "Healthy — within normal range";
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_WARNING) { statusEmoji = "🟡"; statusText = "Elevated — monitor spending"; }
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_CRITICAL) { statusEmoji = "🔴"; statusText = "High usage — review needed"; }
    if (dailyUsage.costMYR >= COST_CONFIG.DAILY_HARD_CAP) { statusEmoji = "🛑"; statusText = "HARD CAP HIT — Sophia was stopped"; }
    
    const dailyCapPct = ((dailyUsage.costMYR / COST_CONFIG.DAILY_HARD_CAP) * 100).toFixed(0);
    const monthlyCapPct = ((monthlyUsage.costMYR / COST_CONFIG.MONTHLY_HARD_CAP) * 100).toFixed(0);
    
    // 🌐 Fetch latest admin API data
    await refreshAdminCostData();
    const unified = await getUnifiedCostData();
    
    let unifiedBlock = "";
    let breakdownBlock = "";
    let smartStatus = "";
    
    if (unified) {
        const otherPct = unified.today.total > 0 ? ((unified.today.other / unified.today.total) * 100).toFixed(0) : 0;
        const monthPctOf250 = ((unified.month.total / 250) * 100).toFixed(0);  // vs RM 250 budget
        
        unifiedBlock = `

━━ 🌐 ALL ANTHROPIC APPS ━━
💰 Total today: RM ${unified.today.total.toFixed(2)} ($${unified.today.totalUSD.toFixed(2)})
💰 Total this month: RM ${unified.month.total.toFixed(2)} ($${unified.month.totalUSD.toFixed(2)})
📊 Budget used: ${monthPctOf250}% of RM ${COST_CONFIG.MONTHLY_BUDGET}`;
        
        breakdownBlock = `

━━ BREAKDOWN (TODAY) ━━
• Sophia WhatsApp: RM ${unified.today.sophia.toFixed(2)}
• Other apps: RM ${unified.today.other.toFixed(2)} (${otherPct}%)
  (Enterprise OS, Claude Code, etc.)`;
        
        // Smarter status that considers OTHER apps
        if (unified.today.other > 20 && unified.today.other > unified.today.sophia * 2) {
            smartStatus = `\n⚠️ Other apps using more than expected today`;
        }
    } else if (ANTHROPIC_ADMIN_KEY) {
        unifiedBlock = `\n\n⚠️ Admin API unreachable tonight.\n${adminCostCache.lastError ? `Error: ${adminCostCache.lastError}` : ''}`;
    } else {
        unifiedBlock = `\n\n💡 TIP: Set ANTHROPIC_ADMIN_KEY env var\nfor total-spend tracking across all your apps.`;
    }
    
    const summary = `📊 SOPHIA DAILY REPORT ${statusEmoji}

📅 ${dailyUsage.date}

━━ SOPHIA WHATSAPP ━━
💬 Conversations: ${dailyUsage.calls}
💰 Cost: RM ${dailyUsage.costMYR.toFixed(2)} ($${dailyUsage.costUSD.toFixed(2)})
📊 Avg: RM ${dailyUsage.calls > 0 ? (dailyUsage.costMYR / dailyUsage.calls).toFixed(3) : '0.000'}/call${unifiedBlock}${breakdownBlock}

━━ 🛑 HARD CAPS ━━
Daily: RM ${dailyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.DAILY_HARD_CAP} (${dailyCapPct}%)
Monthly: RM ${monthlyUsage.costMYR.toFixed(2)} / RM ${COST_CONFIG.MONTHLY_HARD_CAP} (${monthlyCapPct}%)
Blocked calls today: ${dailyUsage.blockedCalls}
${dailyUsage.capOverride ? '⚠️ Override was active today' : '✅ No cap breaches'}

━━ STATUS ━━
${statusEmoji} ${statusText}${smartStatus}

Good night, Boss! ☕`;
    
    try {
        await sendWhatsAppMessage(BOSS_PHONE, summary);
        console.log(`✅ Daily summary sent. RM ${dailyUsage.costMYR.toFixed(2)}`);
    } catch (err) {
        console.error("❌ Summary failed:", err);
    }
}, { timezone: "Asia/Kuala_Lumpur" });

// ==========================================
// 🚀 13. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
    console.log(`🚀 Phone: ${PHONE_NUMBER_ID} | Brain: ${ACTIVE_MODEL}`);
    console.log(`📅 Marketing: 9 AM MYT → Boss +${BOSS_PHONE}`);
    console.log(`📚 Photo Library: Auto-discovery active (scans Supabase on startup + every 6hrs)`);
    console.log(`🛑 Hard Caps: Daily RM ${COST_CONFIG.DAILY_HARD_CAP} | Monthly RM ${COST_CONFIG.MONTHLY_HARD_CAP}`);
    console.log(`🌐 Unified tracking: ${ANTHROPIC_ADMIN_KEY ? 'ACTIVE (admin API + local)' : 'DISABLED (set ANTHROPIC_ADMIN_KEY to enable)'}`);
    console.log(`🚨 Alert System: ACTIVE`);
    console.log(`💰 Cost Tracking: ACTIVE | Daily warn: RM ${COST_CONFIG.DAILY_WARNING} | Critical: RM ${COST_CONFIG.DAILY_CRITICAL} | Monthly budget: RM ${COST_CONFIG.MONTHLY_BUDGET}`);
    console.log(`📊 Daily report: 11 PM MYT → Boss | Send "USAGE" to Sophia anytime for instant check`);
    console.log(`🛍️  Retail: ${RETAIL_URL} (Weber's Law 500g upsell)`);
});
