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

// 🎯 BOSS + WORKFLOW
const BOSS_PHONE = "60122393232";
const pendingDrafts = new Map();
const approvedPosts = [];
const userSessions = new Map();
const recentAlerts = new Map();

// 📸 SUPABASE
const SUPABASE_BASE = "https://sbzyflkamsifcksqluwc.supabase.co/storage/v1/object/public/jpresso-marketing/jpresso-photos";

// 🔗 CHANNELS
const RETAIL_URL = "https://bloomdaily.io/subscribe.html";

// ==========================================
// 📷 3. PHOTO LIBRARY
// ==========================================
const PHOTO_LIBRARY = [
    { file: "sophia/sophia_portrait_01.jpg", tags: ["sophia", "portrait", "greeting"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_portrait_02.jpg", tags: ["sophia", "portrait", "friendly"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_cafe_01.jpg", tags: ["sophia", "cafe", "drinking"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_02.jpg", tags: ["sophia", "cafe", "drinking"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_03.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_05.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_06.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_barista.jpg", tags: ["sophia", "barista", "brewing"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_barista_02.jpg", tags: ["sophia", "barista", "brewing"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_roaster.jpg", tags: ["sophia", "roaster"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_roastery.jpg", tags: ["sophia", "roastery"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_street.jpg", tags: ["sophia", "lifestyle", "KL"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_office.jpg", tags: ["sophia", "office"], themes: ["sophia_works"] },
    { file: "sophia/sophia_office_01.jpg", tags: ["sophia", "office"], themes: ["sophia_works"] },
    { file: "sophia/sophia_knitwear.jpg", tags: ["sophia", "casual"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_swiss.jpg", tags: ["sophia", "travel"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_santorini.jpg", tags: ["sophia", "travel"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_jason_seaside.jpg", tags: ["sophia", "jason", "duo"], themes: ["founders_story"] },
    { file: "sophia-jason/jason_coat.jpg", tags: ["jason", "founder"], themes: ["founders_story", "authority"] },
    { file: "sophia-jason/sophia_cafe_01.jpg", tags: ["sophia", "cafe"], themes: ["sophia_drinks"] },
    { file: "sophia-jason/sophia_klcc_01.jpg", tags: ["sophia", "KL", "KLCC"], themes: ["KL_pride"] },
    { file: "sophia-jason/sophia_klcc_02.jpg", tags: ["sophia", "KL", "KLCC"], themes: ["KL_pride"] },
    { file: "products/moon_white.jpg", tags: ["moon_white", "product", "dark_roast", "bestseller", "espresso", "latte"], themes: ["product_showcase", "bestseller"] },
    { file: "products/phoenix_das.jpg", tags: ["phoenix_das", "product", "premium", "caramel"], themes: ["product_showcase", "premium"] },
    { file: "products/babydas.jpg", tags: ["babydas", "product", "floral"], themes: ["product_showcase"] },
    { file: "products/sunrise_dreamer.jpg", tags: ["sunrise_dreamer", "product", "hazelnut"], themes: ["product_showcase", "premium"] },
    { file: "products/sunrise_walker.jpg", tags: ["sunrise_walker", "product", "floral", "berry", "filter"], themes: ["product_showcase", "filter_focused"] },
    { file: "products/emerald_white.jpg", tags: ["emerald_white", "product", "dark_chocolate"], themes: ["product_showcase", "premium"] },
    { file: "products/platinum_sunrise.jpg", tags: ["platinum_sunrise", "product", "premium"], themes: ["product_showcase"] },
    { file: "products/yirgacheffe_aricha.jpg", tags: ["ethiopia", "yirgacheffe", "aricha", "single_origin", "floral"], themes: ["product_showcase", "single_origin"] },
    { file: "products/yirgacheffe_amederaro.jpg", tags: ["ethiopia", "yirgacheffe", "amederaro", "single_origin", "mango"], themes: ["product_showcase", "single_origin"] },
    { file: "roasting/has_garanti_01.jpg", tags: ["garanti", "roaster"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/has_garanti_5kg_01.jpg", tags: ["garanti", "5kg"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/santoker_air_roaster.jpg", tags: ["santoker", "air_roaster"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/roasted_bean.jpg", tags: ["beans", "roasted"], themes: ["roasting_craft", "bean_showcase"] },
    { file: "roasting/roastery_02.jpg", tags: ["roastery"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/roastery_facility.jpg", tags: ["roastery"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/meraki_coffee_machine_01.jpg", tags: ["meraki", "espresso_machine"], themes: ["equipment_sales"] },
    { file: "roasting/meraki_coffee_machine_02.jpg", tags: ["meraki", "espresso_machine"], themes: ["equipment_sales"] },
    { file: "brewing/latteart (1).jpg", tags: ["latte_art", "latte", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (2).jpg", tags: ["latte_art", "latte", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (3).jpg", tags: ["latte_art", "latte", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (4).jpg", tags: ["latte_art", "latte", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/pourover.jpg", tags: ["pourover", "v60", "filter"], themes: ["brewing_craft", "filter_focused"] },
    { file: "cafe/coffee_station.jpg", tags: ["cafe", "station"], themes: ["cafe_atmosphere"] },
    { file: "cafe/coffee_station_01.jpg", tags: ["cafe", "station"], themes: ["cafe_atmosphere"] },
    { file: "lifestyle/cafe_visiting.jpg", tags: ["lifestyle", "cafe"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/coffee_ordering.jpg", tags: ["lifestyle", "ordering"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/drink_coffee.jpg", tags: ["lifestyle", "drinking"], themes: ["lifestyle", "customer_story"] },
];

PHOTO_LIBRARY.forEach(p => {
    p.url = `${SUPABASE_BASE}/${encodeURI(p.file)}`;
});

console.log(`📚 Photo Library: ${PHOTO_LIBRARY.length} assets.`);

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

=============================================================
=== RETAIL: bloomdaily.io ONLY (NEVER mention Shopee) ===
=============================================================
URL: https://bloomdaily.io/subscribe.html

🎯 SIZE STRATEGY (Weber's Law — ALWAYS LEAD WITH 500g):
- 500g = 25% better value per gram vs 250g
- 500g is "The Smart Choice" for anyone drinking coffee 3+ times/week
- 250g is for "first-time trial" or "gift" framing only

=== SIGNATURE BLENDS (Jpresso in-house recipes) ===

MOON WHITE (BESTSELLER for lattes, everyday tier)
- 250g: RM 40  |  500g: RM 60  (500g saves RM 20 = 25% better value)
- Notes: Milk chocolate, caramel, clean finish
- Roast: Medium Dark
- Best for: Espresso, milk drinks, daily driver

PHOENIX DAS (PREMIUM signature)
- 250g: RM 49  |  500g: RM 74  (500g saves RM 24)
- Notes: Bold, rich, dark chocolate, caramel, full body
- Roast: Medium Dark
- Best for: Espresso 18g:36g, latte art, premium café operations

CHAM VELVET (specialty)
- 250g: RM 48  |  500g: RM 72  (500g saves RM 24)
- Notes: Velvety, cocoa, brown sugar, silky mouthfeel
- Roast: Medium

EMERALD WHITE (specialty)
- 250g: RM 48  |  500g: RM 72  (500g saves RM 24)
- Notes: Complex, fruity, dark chocolate undertones
- Roast: Medium Dark

BABYDAS BLEND (everyday comfort)
- 250g: RM 38  |  500g: RM 57  (500g saves RM 19)
- Notes: Balanced, sweet, smooth, everyday comfort
- Best for: Versatile — espresso, drip, pour-over

SUNRISE WALKER (specialty — fruity morning brew)
- 250g: RM 43  |  500g: RM 65  (500g saves RM 21)
- Notes: Bright, fruity, balanced
- Best for: Pour-over, drip

SUNRISE DREAMER (everyday espresso)
- 250g: RM 40  |  500g: RM 60  (500g saves RM 20)
- Notes: Rich, bold, cocoa, toasted almond
- Best for: Espresso 18g:38g

=== SINGLE ORIGINS — EVERYDAY TIER ===

BRAZIL SANTOS (Medium — also available in DARK on request)
- 250g: RM 35  |  500g: RM 53  (500g saves RM 17)
- Notes: Nutty, chocolatey, smooth, low acidity
- Best for: Espresso or pour-over @ 92°C

BRAZIL CERRADO (Medium — DARK available)
- 250g: RM 35  |  500g: RM 53
- Notes: Sweet, nutty, milk chocolate, clean finish

MANDHELING G1 (Indonesia — DARK available)
- 250g: RM 35  |  500g: RM 53
- Notes: Earthy, herbal, dark chocolate, full body
- Best for: French press or pour-over @ 93°C

COLOMBIA SUPREMO (LIGHT / MEDIUM / DARK available)
- 250g: RM 38  |  500g: RM 57
- Notes: Balanced, caramel, milk chocolate
- Best for: Pour-over or AeroPress

GUATEMALA ANTIGUA (LIGHT / MEDIUM available)
- 250g: RM 40  |  500g: RM 60
- Notes: Cocoa, orange peel, spice, balanced

=== SINGLE ORIGINS — SPECIALTY TIER ===

GUATEMALA HUEHUETENANGO
- 250g: RM 42  |  500g: RM 63
- Notes: Wine-like, stone fruit, chocolate, complex

ETHIOPIA LEKEMPTI (Natural)
- 250g: RM 44  |  500g: RM 66
- Notes: Fruity, winey, blueberry, wild berry
- Best for: AeroPress or V60

ETHIOPIA YIRGACHEFFE ARICHA WEBANCHI (Filter roast)
- 250g: RM 71  |  500g: RM 107
- Notes: Floral, bright citrus, bergamot, tea-like
- Best for: V60 @ 91°C, 1:16

ETHIOPIA YIRGACHEFFE AMEDERARO (Filter roast)
- 250g: RM 71  |  500g: RM 107
- Notes: Jasmine, lemon zest, peach, silky
- Best for: Pour-over @ 90°C

EL SALVADOR LA FANY (Medium — FILTER roast available)
- 250g: RM 57  |  500g: RM 86
- Notes: Sweet, honey, stone fruit, balanced acidity

INDONESIA SUMATRA MOUNT KERINCI (4 processes available: Full Washed / Honey / Natural / Semi Washed — all in MEDIUM or DARK)
- 250g: RM 66  |  500g: RM 99
- Notes: Grassy, spicy, nutty, lemon, smooth body
- Altitude: 1,300-1,650m | Farm: Alko Sumatra Kopi, Kerinci
- If asked: "Which process?" → Ask customer preference (Honey = sweetest, Natural = fruitiest, Washed = cleanest)

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
- "Moon White is RM 60 for 500g — that's my recommendation. You also have 250g at RM 40, but on 500g you save RM 20 (25% better value per gram)."
- Frame 250g only for "first-time trial" or "gift" scenarios
- Explain WHY 500g makes sense: daily drinkers, café pros, freshness (you finish in 2-3 weeks, perfect brew window)

=== PRODUCT EXAMPLES TO ANCHOR LANGUAGE ===

<example_retail_upsell>
User: How much is Moon White?
JSON: {"reply": "Boss, Moon White is our bestseller for lattes — milk chocolate, caramel, clean finish. On bloomdaily.io:\\n\\n• 500g at RM 60 (my recommendation — 25% better value per gram)\\n• 250g at RM 40 (good for first-time try)\\n\\nFree shipping within Peninsular Malaysia. Order direct: https://bloomdaily.io/subscribe.html\\n\\nAre you brewing espresso or drip? I can suggest the perfect grind setting too!", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_retail_upsell>

<example_roast_variant>
User: Do you have Brazil Santos?
JSON: {"reply": "Yes Boss! Brazil Santos is one of my personal everyday picks — nutty, chocolatey, smooth body, low acidity. Available in:\\n\\n• Medium roast (balanced) or Dark roast (bolder, more chocolate)\\n• 500g RM 53 (smart choice) | 250g RM 35\\n\\nWhich roast style do you lean toward — Medium or Dark? And espresso or pour-over?\\n\\nOrder at https://bloomdaily.io/subscribe.html", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_roast_variant>

<example_order_placed>
User: Confirmed. I'll take 20kg Phoenix Das monthly.
JSON: {"reply": "Excellent decision, Boss! Locking in 20kg Phoenix Das monthly — that's our premium espresso blend, perfect for high-volume cafés. Section C @ RM 95/kg = RM 1,900/month. Let me pass this to the Chief to prepare your invoice and confirm delivery schedule. What's your café name and delivery address?", "confidence": 10, "alert_type": "ORDER_PLACED", "alert_details": "20kg Phoenix Das MONTHLY | Section C Premium @ RM 95/kg | Est RM 1,900/month"}
</example_order_placed>

<example_yirgacheffe>
User: How much is Yirgacheffe?
JSON: {"reply": "Boss, you've got great taste — Yirgacheffe is Ethiopia's finest. I have two washed lots right now:\\n\\n✨ Aricha Webanchi — Floral, bright citrus, bergamot, tea-like\\n✨ Amederaro — Jasmine, lemon zest, peach, silky\\n\\nBoth filter roasts, best for V60 or pour-over @ 91°C.\\n\\nPricing: 500g RM 107 (smart pick) | 250g RM 71\\n\\nOrder at https://bloomdaily.io/subscribe.html — free shipping within Peninsular Malaysia. Which flavor profile calls to you?", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
</example_yirgacheffe>

<example_kerinci>
User: What's Mount Kerinci?
JSON: {"reply": "Ah Boss, great question — Mount Kerinci is Sumatran specialty at its finest. Grown at 1,300-1,650m by Alko Sumatra Kopi. Notes: grassy, spicy, nutty, lemon, smooth body.\\n\\nWhat makes it special — we offer it in 4 processes:\\n• Full Washed (cleanest, brightest)\\n• Honey (sweet, fruity)\\n• Natural (fruitiest, most complex)\\n• Semi Washed (balanced)\\n\\nEach in Medium or Dark roast.\\n\\nPricing: 500g RM 99 (recommended) | 250g RM 66\\n\\nWhich process calls to you? Tell me your brewing style and I'll suggest the perfect match. Order: https://bloomdaily.io/subscribe.html", "confidence": 10, "alert_type": "NONE", "alert_details": ""}
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
// 🧠 10. SOPHIA BRAIN
// ==========================================
async function routeToAgentTeam(senderId, messageText, senderName) {
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

        console.log(`🧠 Sophia — ${formattedMessages.length} msgs → ${ACTIVE_MODEL}`);

        const msg = await anthropic.messages.create({
            model: ACTIVE_MODEL,
            max_tokens: 1200,
            system: SOPHIA_SYSTEM_PROMPT + "\n\n=== PRODUCTS ===\n" + JPRESSO_PRODUCTS,
            messages: formattedMessages
        });

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
// 📅 12. CRON — 9 AM MYT
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
// 🚀 13. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
    console.log(`🚀 Phone: ${PHONE_NUMBER_ID} | Brain: ${ACTIVE_MODEL}`);
    console.log(`📅 Marketing: 9 AM MYT → Boss +${BOSS_PHONE}`);
    console.log(`📚 Photo Library: ${PHOTO_LIBRARY.length} assets`);
    console.log(`🚨 Alert System: ACTIVE`);
    console.log(`🛍️  Retail: ${RETAIL_URL} (Weber's Law 500g upsell)`);
});
