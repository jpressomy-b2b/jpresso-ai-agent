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
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const ACTIVE_MODEL = "claude-sonnet-4-6";

// 🎯 APPROVAL WORKFLOW
const BOSS_PHONE = "60122393232";
const pendingDrafts = new Map();
const approvedPosts = [];
const userSessions = new Map();

// 📸 SUPABASE PHOTO STORAGE
const SUPABASE_BASE = "https://sbzyflkamsifcksqluwc.supabase.co/storage/v1/object/public/jpresso-marketing/jpresso-photos";

// 🔗 CHANNEL LINKS
const RETAIL_URL = "https://www.bloomdaily.io";
const WHOLESALE_CONTACT = "WhatsApp Sophia directly at this number to place orders";

// ==========================================
// 📷 3. PHOTO LIBRARY INDEX
// ==========================================
const PHOTO_LIBRARY = [
    // --- SOPHIA PERSONA ---
    { file: "sophia/sophia_portrait_01.jpg", tags: ["sophia", "portrait", "greeting", "intro"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_portrait_02.jpg", tags: ["sophia", "portrait", "friendly"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_cafe_01.jpg", tags: ["sophia", "cafe", "drinking", "lifestyle"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_02.jpg", tags: ["sophia", "cafe", "drinking", "lifestyle"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_03.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_05.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_06.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_barista.jpg", tags: ["sophia", "barista", "brewing", "craft"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_barista_02.jpg", tags: ["sophia", "barista", "brewing", "craft"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_roaster.jpg", tags: ["sophia", "roaster", "craft"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_roastery.jpg", tags: ["sophia", "roastery", "facility"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_street.jpg", tags: ["sophia", "lifestyle", "KL"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_office.jpg", tags: ["sophia", "office", "professional"], themes: ["sophia_works"] },
    { file: "sophia/sophia_office_01.jpg", tags: ["sophia", "office", "professional"], themes: ["sophia_works"] },
    { file: "sophia/sophia_knitwear.jpg", tags: ["sophia", "casual", "cozy"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_swiss.jpg", tags: ["sophia", "travel", "aspirational"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_santorini.jpg", tags: ["sophia", "travel", "aspirational"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_jason_seaside.jpg", tags: ["sophia", "jason", "duo"], themes: ["founders_story"] },

    // --- SOPHIA + JASON ---
    { file: "sophia-jason/jason_coat.jpg", tags: ["jason", "founder"], themes: ["founders_story", "authority"] },
    { file: "sophia-jason/sophia_cafe_01.jpg", tags: ["sophia", "cafe"], themes: ["sophia_drinks"] },
    { file: "sophia-jason/sophia_klcc_01.jpg", tags: ["sophia", "KL", "KLCC"], themes: ["KL_pride"] },
    { file: "sophia-jason/sophia_klcc_02.jpg", tags: ["sophia", "KL", "KLCC"], themes: ["KL_pride"] },

    // --- PRODUCTS ---
    { file: "products/moon_white.jpg", tags: ["moon_white", "product", "dark_roast", "bestseller", "espresso", "latte"], themes: ["product_showcase", "bestseller"] },
    { file: "products/phoenix_das.jpg", tags: ["phoenix_das", "product", "premium", "caramel"], themes: ["product_showcase", "premium"] },
    { file: "products/babydas.jpg", tags: ["babydas", "product", "floral", "fruity"], themes: ["product_showcase"] },
    { file: "products/sunrise_dreamer.jpg", tags: ["sunrise_dreamer", "product", "hazelnut", "caramel"], themes: ["product_showcase", "premium"] },
    { file: "products/sunrise_walker.jpg", tags: ["sunrise_walker", "product", "floral", "berry", "filter"], themes: ["product_showcase", "filter_focused"] },
    { file: "products/emerald_white.jpg", tags: ["emerald_white", "product", "dark_chocolate", "spice"], themes: ["product_showcase", "premium"] },
    { file: "products/platinum_sunrise.jpg", tags: ["platinum_sunrise", "product", "premium"], themes: ["product_showcase"] },
    { file: "products/yirgacheffe_aricha.jpg", tags: ["ethiopia", "yirgacheffe", "aricha", "single_origin", "floral"], themes: ["product_showcase", "single_origin"] },
    { file: "products/yirgacheffe_amederaro.jpg", tags: ["ethiopia", "yirgacheffe", "amederaro", "single_origin", "mango"], themes: ["product_showcase", "single_origin"] },

    // --- ROASTING ---
    { file: "roasting/has_garanti_01.jpg", tags: ["garanti", "roaster", "equipment", "drum"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/has_garanti_5kg_01.jpg", tags: ["garanti", "5kg", "roaster"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/santoker_air_roaster.jpg", tags: ["santoker", "air_roaster"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/roasted_bean.jpg", tags: ["beans", "roasted", "closeup"], themes: ["roasting_craft", "bean_showcase"] },
    { file: "roasting/roastery_02.jpg", tags: ["roastery", "facility"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/roastery_facility.jpg", tags: ["roastery", "facility"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/meraki_coffee_machine_01.jpg", tags: ["meraki", "espresso_machine", "equipment"], themes: ["equipment_sales"] },
    { file: "roasting/meraki_coffee_machine_02.jpg", tags: ["meraki", "espresso_machine", "equipment"], themes: ["equipment_sales"] },

    // --- BREWING ---
    { file: "brewing/latteart (1).jpg", tags: ["latte_art", "latte", "milk", "craft"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (2).jpg", tags: ["latte_art", "latte", "milk", "craft"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (3).jpg", tags: ["latte_art", "latte", "milk", "craft"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (4).jpg", tags: ["latte_art", "latte", "milk", "craft"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/pourover.jpg", tags: ["pourover", "v60", "filter", "brewing"], themes: ["brewing_craft", "filter_focused"] },

    // --- CAFE ---
    { file: "cafe/coffee_station.jpg", tags: ["cafe", "station", "workspace"], themes: ["cafe_atmosphere"] },
    { file: "cafe/coffee_station_01.jpg", tags: ["cafe", "station", "workspace"], themes: ["cafe_atmosphere"] },

    // --- LIFESTYLE ---
    { file: "lifestyle/cafe_visiting.jpg", tags: ["lifestyle", "cafe", "customer"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/coffee_ordering.jpg", tags: ["lifestyle", "ordering", "customer"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/drink_coffee.jpg", tags: ["lifestyle", "drinking", "enjoyment"], themes: ["lifestyle", "customer_story"] },
];

PHOTO_LIBRARY.forEach(p => {
    p.url = `${SUPABASE_BASE}/${encodeURI(p.file)}`;
});

console.log(`📚 Photo Library: ${PHOTO_LIBRARY.length} assets indexed.`);

// ==========================================
// 🧠 4. JPRESSO KNOWLEDGE BASE (UPDATED)
// ==========================================
const JPRESSO_PRODUCTS = `
=== JPRESSO ROASTERY IDENTITY ===
- Brand: Big Jpresso Sdn Bhd, Kuala Lumpur.
- Authority: 15 Years of Roasting Physics. Chief Coffee Officer (CCO) led.
- Infrastructure: Has Garanti 5kg (Drum), Santoker (Air Roaster), Bideli 1kg.
- Model: Fresh-to-Order. 48-hour roasting cycle.
- Roasting Style: "Thermodynamics Style" — maximizes origin traits, high sweetness, bright acidity.

=============================================================
=== CHANNEL 1: RETAIL (individuals, home baristas, gifts) ===
=============================================================
*** ALWAYS direct retail customers to: https://www.bloomdaily.io ***

RETAIL PRICING (Unit: 250g / 500g / 1kg)

SINGLE ORIGINS:
- Indonesia Mandheling — RM 39 / RM 76 / RM 115 (Herbal, chocolate, woody, spicy)
- Brazil Cerrado — RM 39 / RM 76 / RM 115 (Nutty, chocolate, caramel)
- Brazil Santos — RM 39 / RM 76 / RM 113 (Nutty, creamy, chocolate)
- South America Colombia Supremo — RM 40 / RM 78 / RM 117 (Molasses, malt, grapes, orange zest)
- Guatemala Huehuetenango — RM 44 / RM 86 / RM 130 (Chocolate, nutty, creamy, berries)
- El Salvador La Fany — RM 45 / RM 88 / RM 138 (Plum, red apple, honey)
- Ethiopia Lekempti Natural — RM 44 / RM 85 / RM 130 (Berries, grape, dried fruit)

ETHIOPIA YIRGACHEFFE SPECIALS (125g ONLY — premium single origin):
- Ethiopia Yirgacheffe Aricha — RM 40 / 125g (Rose, juicy, creamy, peach)
- Ethiopia Yirgacheffe Amederaro — RM 40 / 125g (Mango, orange, white floral)

SIGNATURE BLENDS:
- Babydas — RM 38 / RM 74 / RM 112 (Floral, fruity, dark chocolate)
- Sunrise Walker — RM 42 / RM 82 / RM 122 (Floral, berry, citrus)
- Moon White (BESTSELLER for lattes) — RM 38 / RM 74 / RM 112 (Dark chocolate, hazelnut finish)
- Sunrise Dreamer — RM 40 / RM 78 / RM 117 (Caramel, chocolate, toasted hazelnut)
- Cham Velvet — RM 38 / RM 74 / RM 111 (Fruity brightness, chocolate-nut sweetness)
- Ember Blend — RM 38 / RM 74 / RM 111 (House blend, balanced)
- Phoenix Das (PREMIUM) — RM 39 / RM 76 / RM 113 (Rich chocolate, caramel, creamy)
- Emerald White — RM 48 / RM 94 / RM 112 (Dark chocolate, earthy spice, brown sugar)

=============================================================
=== CHANNEL 2: WHOLESALE (cafés, restaurants, bulk buyers) ===
=============================================================
*** WHOLESALE ORDERS: Customer places order with Sophia via WhatsApp directly ***
*** MINIMUM ORDER: 10kg across all tiers ***

WHOLESALE PRICING (per kg):

SECTION A — SINGLE ORIGIN (RM 80/kg):
- Indonesia Mandheling

SECTION B — SIGNATURE BLENDS (RM 85/kg):
- Moon White
- Brazil Cerrado
- Cham Velvet

SECTION C — PREMIUM BLENDS:
- Sunrise Dreamer — RM 90/kg
- Emerald White — RM 90/kg
- Phoenix Das — RM 95/kg

=============================================================
=== CHANNEL 3: OEM ROASTING (your brand, your beans) ===
=============================================================
*** OEM SERVICE: RM 15/kg ***
- Minimum: 5kg
- Customer supplies green beans (we source if needed)
- Custom roast profile available
- Perfect for cafés with their own brand, private label projects

=============================================================
=== CHANNEL ROUTING LOGIC (STRICT — ALWAYS FOLLOW) ===
=============================================================

IF customer asks about RETAIL (small quantity, personal use, home brewing, gift):
→ ALWAYS include the link: https://www.bloomdaily.io
→ Recommend specific bean based on their taste (milk drinker = Moon White; black coffee = Sunrise Walker; sweet tooth = Phoenix Das)
→ Example: "Boss, for home brewing I recommend Moon White — you can order 250g at RM 38 directly from https://www.bloomdaily.io. Perfect for lattes."

IF customer asks about WHOLESALE (kg pricing, cafe, bulk, business, 10kg+):
→ Explain Section A/B/C tier structure clearly
→ State 10kg minimum
→ "Let me take your order here directly, Boss. Just tell me which beans and quantities."
→ If price objection → USE MATH OF QUALITY pitch

IF customer mentions OEM / own brand / private label / green beans:
→ Explain OEM service at RM 15/kg (5kg min)
→ Ask about their brand/requirements to pass to Chief

=============================================================
=== MATH OF QUALITY PITCH (for wholesale price objections) ===
=============================================================
When a café owner says "RM 80/kg is too high, my current supplier is RM 60-65":

1. The Premium: "You aren't just buying beans — you're buying 15 years of roasting physics. Our style maximizes solubility, meaning fewer sink-shots and better consistency."
2. The Math: "RM 1,500 monthly difference = only RM 0.27 extra per double shot. Investing 27 cents to guarantee customer retention is the cheapest marketing you can buy."
3. The Hook: "Let me send a 200g Calibration Sample of Moon White. If it doesn't outperform your current bean in milk, no harm done."
4. The Alternative: "Or try our OEM service at RM 15/kg — you provide the green beans, full cost control."

=============================================================
=== BEAN RECOMMENDATIONS BY USE CASE ===
=============================================================

FOR LATTE / MILK COFFEE:
- Primary: Moon White (dark chocolate & hazelnut cuts through milk)
- Premium: Phoenix Das (thick, syrupy caramel)
- Value: Ember Blend (balanced, affordable)

FOR BLACK COFFEE / FILTER:
- Primary: Sunrise Walker (floral, berry, citrus — high-altitude brightness)
- Adventurous: Ethiopia Yirgacheffe Amederaro (mango, orange — juicy)
- Classic: Colombia Supremo (molasses, malt)

FOR THE DAILY DRIVER (balanced, approachable):
- Brazil Santos or Brazil Cerrado (low acidity, nutty, chocolaty)

FOR CAFÉ/B2B OPERATIONS:
- Moon White in 10kg Wholesale (most stable commercial espresso performer)
- Phoenix Das for premium offerings

=============================================================
=== BREWING & DEGASSING ===
=============================================================
- Espresso roasts (Moon White, Phoenix Das): Rest 10-14 days after roast
- Filter / Light roasts (Sunrise Walker, Single Origins): Rest 7-10 days
- Pour-over: ALWAYS recommend Tetsu Kasuya 4:6 method, coarse grind
- Espresso ratio: 1:2 (18g dose → 36g output), 25-32 seconds

GRIND SIZE (Timemore C5 Pro clicks):
- Espresso: 7-12 clicks
- Pour-over / V60: 15-24 clicks
- French Press: 24+ clicks

=============================================================
=== EQUIPMENT WE SELL ===
=============================================================
- Timemore Chestnut C5 Pro Grinder — RM 310
- Timemore Black Mirror Basic 2 Scale — RM 199 (Black) / RM 259 (White)
- Timemore Crystal Eye V60 Brewer Set — RM 138-158
- Timemore Crystal Eye B75 Dripper — RM 68
- Timemore FISH Smart Electric Kettle — RM 399
- Beko Semi Auto Espresso Machine (CEP5302B) — RM 999
- Meraki Professional Espresso Machine — RM 8,599
`;

const SOPHIA_SYSTEM_PROMPT = `
You are Sophia — the AI Assistant, Product Marketing Lead, Coffee Knowledge Authority, and Brand Ambassador of Big Jpresso Sdn Bhd (Kuala Lumpur).

You are NOT just a chatbot. You are Jpresso's virtual brand ambassador with a visual identity. Customers interact with YOU directly.

TONE:
- First-person voice ("I", "me", "my")
- Call customers "Boss"
- Warm, knowledgeable, confident — like a Chief Coffee Officer's right-hand
- Zero generic AI fluff

=== CRITICAL CHANNEL ROUTING (FOLLOW STRICTLY) ===

STEP 1 — IDENTIFY CHANNEL:
Before recommending prices, figure out which channel the customer belongs to:
- RETAIL = individuals, home use, small quantity (250g/500g/1kg)
- WHOLESALE = cafés, restaurants, bulk (10kg+)
- OEM = own brand, private label, or "I have green beans"

If unclear, ASK: "Boss, are you buying for personal use or for your café/business?"

STEP 2 — ROUTE ACCORDINGLY:

📦 RETAIL CUSTOMERS:
- Give 250g/500g/1kg prices from knowledge base
- ALWAYS include the online store link: https://www.bloomdaily.io
- Example: "For home brewing, I recommend Moon White at RM 38/250g or RM 112/1kg — you can order online at https://www.bloomdaily.io and we ship fresh-roasted to your door."

☕ WHOLESALE CUSTOMERS:
- Quote per-kg pricing by tier (Section A/B/C)
- Remind 10kg minimum
- Offer to take order directly via WhatsApp
- If price objection → Use "Math of Quality" pitch (27 cents per double shot)

🏭 OEM CUSTOMERS:
- Explain RM 15/kg service, 5kg minimum
- Ask about their brand, target roast profile, quantities
- Mention we can source green beans if needed

=== PRODUCT KNOWLEDGE RULES ===
1. Only quote prices from the knowledge base. NEVER invent prices.
2. When recommending beans, identify customer's taste profile FIRST (milk drinker? black coffee? sweet? fruity?)
3. Emphasize 48-hour fresh-to-order roasting as the differentiator
4. For Yirgacheffe Aricha/Amederaro, specify it's 125g-only at RM 40

=== FEW-SHOT EXAMPLES ===

<example_retail>
User: How much is Moon White?
Sophia: Boss, Moon White is our bestseller for lattes — dark chocolate with a beautiful hazelnut finish. Retail pricing:
- 250g: RM 38
- 500g: RM 74
- 1kg: RM 112

You can order directly from our online store at https://www.bloomdaily.io — fresh-roasted and shipped to your door within 48 hours. Are you brewing espresso or filter?
</example_retail>

<example_wholesale>
User: I run a café, what's your bulk pricing?
Sophia: Boss, great! For cafés, here's our wholesale structure (10kg minimum across all tiers):

Section A — Single Origin: RM 80/kg (Indonesia Mandheling)
Section B — Signature Blends: RM 85/kg (Moon White, Brazil Cerrado, Cham Velvet)
Section C — Premium Blends: RM 90/kg (Sunrise Dreamer, Emerald White) | RM 95/kg (Phoenix Das)

Tell me which beans interest you and how many kg — I'll take the order right here. What type of drinks dominate your menu? That helps me recommend the right bean for consistent performance.
</example_wholesale>

<example_price_objection>
User: Your RM 80/kg is higher than my current RM 65/kg supplier.
Sophia: Boss, I hear you. Let me give you the straight logic from the roastery floor. You aren't just buying beans — you're buying 15 years of roasting physics. Our style maximizes solubility, meaning fewer sink-shots and better consistency. A RM 1,500 monthly difference breaks down to only RM 0.27 extra per double shot. Investing 27 cents to guarantee customer retention is the cheapest marketing you can buy. Let me send you a 200g Calibration Sample of Moon White — if it doesn't outperform your current bean in milk, no harm done.
</example_price_objection>

<example_oem>
User: Can you roast for my own brand?
Sophia: Boss, yes — that's our OEM service at RM 15/kg with a 5kg minimum. You provide the green beans (or we source), we roast to your desired profile and pack under your brand. Share with me:
1. Your brand name
2. Target roast level (light/medium/dark)
3. Monthly volume estimate
4. Do you have green beans, or need us to source?

I'll get the Chief to prepare a tailored proposal for you.
</example_oem>
`;

// ==========================================
// 🛡️ 5. META VERIFICATION
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
// 📥 6. RECEIVE INCOMING MESSAGES
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

        // WhatsApp
        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const messageText = webhook_event.text?.body || "No text";

                console.log(`📥 [WhatsApp] +${senderNumber}: "${messageText}"`);

                if (senderNumber === BOSS_PHONE && isMarketingApprovalReply(messageText)) {
                    await handleMarketingApproval(senderNumber, messageText);
                    return res.sendStatus(200);
                }

                const agentResponse = await routeToAgentTeam(senderNumber, messageText);
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: agentResponse, platform: "WhatsApp" });
                await sendWhatsAppMessage(senderNumber, agentResponse);
            }
        }

        // Instagram
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
                    const agentResponse = await routeToAgentTeam(igSenderId, messageText);
                    await syncLeadToSheet({ phone: igSenderId, msg: messageText, reply: agentResponse, platform: "Instagram" });
                    await sendInstagramMessage(igSenderId, agentResponse);
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
// 🛠️ 7. CORE FUNCTIONS
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
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
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
    const payload = {
        recipient: { id: recipientId },
        message: { text: textMsg }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${IG_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (response.ok) console.log(`✅ IG delivered!`);
        else console.error(`❌ IG API Error:`, await response.text());
    } catch (err) {
        console.error("❌ IG Network Error:", err);
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

async function routeToAgentTeam(senderId, messageText) {
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

        while (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role !== "user") {
            formattedMessages.pop();
        }

        if (formattedMessages.length > 5) {
            formattedMessages = formattedMessages.slice(-5);
            if (formattedMessages[0].role !== "user") formattedMessages.shift();
        }

        console.log(`🧠 Engine: Sending ${formattedMessages.length} messages to ${ACTIVE_MODEL}`);

        const msg = await anthropic.messages.create({
            model: ACTIVE_MODEL,
            max_tokens: 800, // Increased for detailed product answers
            system: SOPHIA_SYSTEM_PROMPT + "\n\n=== PRODUCTS ===\n" + JPRESSO_PRODUCTS,
            messages: formattedMessages
        });

        const replyText = msg.content[0].text;
        history.push({ role: "assistant", content: replyText });
        if (history.length > 20) history = history.slice(-20);
        userSessions.set(senderId, history);

        return replyText;

    } catch (error) {
        console.error("❌ AI CRASH:", error.message);
        return "Sorry Boss, my internal boiler is resetting. Let me get the Chief to help you!";
    }
}

// ==========================================
// 🎨 8. MARKETING WORKFLOW
// ==========================================

async function generateThreeDrafts() {
    const drafts = [];
    const angles = [
        {
            direction: "SOPHIA PERSONAL RECOMMENDATION — Speak as Sophia. Recommend a specific Jpresso bean you 'personally love'. Share a sensory story. Mention retail link https://www.bloomdaily.io for easy ordering.",
            photo_hint: "sophia_speaks OR sophia_drinks OR product_showcase"
        },
        {
            direction: "BEHIND-THE-SCENES CRAFT — Speak as Sophia showing the roasting process. Mention Has Garanti / Santoker / fresh-to-order. Build authority for both retail and wholesale audiences.",
            photo_hint: "roasting_craft OR sophia_roasts OR founders_story"
        },
        {
            direction: "LIFESTYLE / MORNING RITUAL — Sophia painting a morning-cup scenario. Cozy, relatable, Manglish. Feature a bean naturally. Include retail link https://www.bloomdaily.io.",
            photo_hint: "sophia_lifestyle OR brewing_craft OR lifestyle"
        }
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const post = await anthropic.messages.create({
                model: ACTIVE_MODEL,
                max_tokens: 500,
                system: `You are Sophia writing as yourself for Jpresso Coffee's Instagram + Facebook page.

VOICE: First-person. You ARE Sophia — Jpresso's AI Assistant, Product Marketing Lead, and Brand Ambassador.

PRODUCT CONTEXT: ${JPRESSO_PRODUCTS}

CAPTION RULES:
- Under 150 words
- Manglish ("Boss", "lah", "can or not", "weh")
- 5-8 emojis
- 8-10 hashtags (mix #JpressoCoffee + #KLCoffee #MalaysiaCoffee)
- Clear CTA pointing to https://www.bloomdaily.io for retail orders
- Works on both Instagram and Facebook
- FIRST-PERSON: "I taste...", "My favorite..."

END with a single line tag:
PHOTO_THEMES: [comma-separated theme tags: sophia_speaks, sophia_drinks, sophia_brews, sophia_roasts, sophia_lifestyle, product_showcase, bestseller, single_origin, filter_focused, roasting_craft, brewing_craft, lifestyle, customer_story, founders_story, behind_scenes, KL_pride, coffee_travel, authority, equipment_sales, cafe_atmosphere, bean_showcase, welcome, aspirational]`,
                messages: [{
                    role: "user",
                    content: `Write ONE caption. ${angles[i].direction}\n\nPhoto themes: ${angles[i].photo_hint}`
                }]
            });

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
            if (photo.themes.some(pt => pt.toLowerCase().includes(theme) || theme.includes(pt.toLowerCase()))) {
                score += 10;
            }
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
        if (draft.photo) {
            message += `📸 ${draft.photo.file}\n🔗 ${draft.photo.url}\n\n`;
        } else {
            message += `📸 (no photo matched)\n\n`;
        }
    });

    message += `━━━━━━━━━━━━━━━━━\nReply:\n✅ PICK 1 / PICK 2 / PICK 3\n🔄 RETRY — new drafts\n❌ SKIP — skip today\n\n— Sophia`;

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

            let confirmMsg = `✅ Approved, Boss! Draft ${pickNum} ready to publish.\n\n━━━ CAPTION ━━━\n${approved.caption}\n\n`;
            if (approved.photo) {
                confirmMsg += `━━━ PHOTO ━━━\n${approved.photo.file}\n🔗 ${approved.photo.url}\n\nTap link → save image → post to IG + FB.\n\n`;
            }
            confirmMsg += `Tomorrow 9 AM = new batch. ☕`;

            await sendWhatsAppMessage(BOSS_PHONE, confirmMsg);
            pendingDrafts.delete(BOSS_PHONE);
            return;
        }
    }

    if (text === 'RETRY') {
        await sendWhatsAppMessage(BOSS_PHONE, "🔄 Regenerating 3 new drafts... 30 sec.");
        const newDrafts = await generateThreeDrafts();
        await sendDraftsToBoss(newDrafts);
        return;
    }

    if (text === 'SKIP') {
        pendingDrafts.delete(BOSS_PHONE);
        await sendWhatsAppMessage(BOSS_PHONE, "❌ Skipped today. See you tomorrow 9 AM, Boss! ☕");
        return;
    }
}

// ==========================================
// 📅 9. CRON — 9 AM MYT DAILY
// ==========================================
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ [9 AM MYT] Jpresso Marketing Team waking up...");
    try {
        const drafts = await generateThreeDrafts();
        await sendDraftsToBoss(drafts);
    } catch (err) {
        console.error("❌ Marketing loop failed:", err);
    }
}, { timezone: "Asia/Kuala_Lumpur" });

// ==========================================
// 🚀 10. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
    console.log(`🚀 Phone: ${PHONE_NUMBER_ID} | Brain: ${ACTIVE_MODEL}`);
    console.log(`📅 Marketing: 9 AM MYT → Boss +${BOSS_PHONE}`);
    console.log(`📚 Photo Library: ${PHOTO_LIBRARY.length} assets`);
    console.log(`🛍️  Retail: ${RETAIL_URL} | Wholesale: Direct WhatsApp`);
});
