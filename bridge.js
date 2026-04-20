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

// 🎯 APPROVAL WORKFLOW CONFIG
const BOSS_PHONE = "60122393232";
const pendingDrafts = new Map();
const approvedPosts = [];
const userSessions = new Map();

// 📸 SUPABASE PHOTO STORAGE
const SUPABASE_BASE = "https://sbzyflkamsifcksqluwc.supabase.co/storage/v1/object/public/jpresso-marketing/jpresso-photos";

// ==========================================
// 📷 3. PHOTO LIBRARY INDEX
// ==========================================
// Each photo tagged with themes, subjects, and mood for intelligent matching
const PHOTO_LIBRARY = [
    // --- SOPHIA PERSONA (first-person voice pairs best with these) ---
    { file: "sophia/sophia_portrait_01.jpg", tags: ["sophia", "portrait", "greeting", "intro", "personal"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_portrait_02.jpg", tags: ["sophia", "portrait", "friendly", "personal"], themes: ["sophia_speaks", "welcome"] },
    { file: "sophia/sophia_cafe_01.jpg", tags: ["sophia", "cafe", "drinking", "lifestyle"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_02.jpg", tags: ["sophia", "cafe", "drinking", "lifestyle"], themes: ["sophia_drinks", "recommendation"] },
    { file: "sophia/sophia_cafe_03.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_05.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_cafe_06.jpg", tags: ["sophia", "cafe", "atmosphere"], themes: ["sophia_drinks", "lifestyle"] },
    { file: "sophia/sophia_barista.jpg", tags: ["sophia", "barista", "brewing", "craft"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_barista_02.jpg", tags: ["sophia", "barista", "brewing", "craft"], themes: ["sophia_brews", "technique"] },
    { file: "sophia/sophia_roaster.jpg", tags: ["sophia", "roaster", "craft", "process"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_roastery.jpg", tags: ["sophia", "roastery", "facility", "behind_scenes"], themes: ["sophia_roasts", "craft_story"] },
    { file: "sophia/sophia_street.jpg", tags: ["sophia", "lifestyle", "KL", "casual"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_office.jpg", tags: ["sophia", "office", "work", "professional"], themes: ["sophia_works", "behind_scenes"] },
    { file: "sophia/sophia_office_01.jpg", tags: ["sophia", "office", "work", "professional"], themes: ["sophia_works", "behind_scenes"] },
    { file: "sophia/sophia_knitwear.jpg", tags: ["sophia", "casual", "cozy", "lifestyle"], themes: ["sophia_lifestyle"] },
    { file: "sophia/sophia_swiss.jpg", tags: ["sophia", "travel", "coffee_world", "wanderlust"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_santorini.jpg", tags: ["sophia", "travel", "coffee_world", "aspirational"], themes: ["coffee_travel"] },
    { file: "sophia/sophia_jason_seaside.jpg", tags: ["sophia", "jason", "duo", "team"], themes: ["founders_story"] },

    // --- SOPHIA + JASON (founder story, behind-the-scenes) ---
    { file: "sophia-jason/jason_coat.jpg", tags: ["jason", "professional", "founder"], themes: ["founders_story", "authority"] },
    { file: "sophia-jason/sophia_cafe_01.jpg", tags: ["sophia", "cafe", "duo"], themes: ["sophia_drinks", "duo_story"] },
    { file: "sophia-jason/sophia_klcc_01.jpg", tags: ["sophia", "KL", "KLCC", "city"], themes: ["KL_pride", "location"] },
    { file: "sophia-jason/sophia_klcc_02.jpg", tags: ["sophia", "KL", "KLCC", "city"], themes: ["KL_pride", "location"] },
    { file: "sophia-jason/sophia_office_01.jpg", tags: ["sophia", "office", "work"], themes: ["sophia_works"] },
    { file: "sophia-jason/sophia_santorini_04.jpg", tags: ["sophia", "travel", "aspirational"], themes: ["coffee_travel"] },

    // --- PRODUCTS (clean product shots — best for sales posts) ---
    { file: "products/moon_white.jpg", tags: ["moon_white", "product", "dark_roast", "bestseller", "espresso", "latte"], themes: ["product_showcase", "bestseller"] },
    { file: "products/phoenix_das.jpg", tags: ["phoenix_das", "product", "signature_blend", "caramel"], themes: ["product_showcase"] },
    { file: "products/babydas.jpg", tags: ["babydas", "product", "floral", "fruity"], themes: ["product_showcase"] },
    { file: "products/sunrise_dreamer.jpg", tags: ["sunrise_dreamer", "product", "toasted_hazelnut", "caramel"], themes: ["product_showcase"] },
    { file: "products/sunrise_walker.jpg", tags: ["sunrise_walker", "product", "floral", "berry", "citrus", "filter"], themes: ["product_showcase", "filter_focused"] },
    { file: "products/emerald_white.jpg", tags: ["emerald_white", "product", "dark_chocolate", "spice"], themes: ["product_showcase"] },
    { file: "products/platinum_sunrise.jpg", tags: ["platinum_sunrise", "product", "premium"], themes: ["product_showcase", "premium"] },
    { file: "products/yirgacheffe_aricha.jpg", tags: ["ethiopia", "yirgacheffe", "aricha", "single_origin", "floral"], themes: ["product_showcase", "single_origin"] },
    { file: "products/yirgacheffe_amederaro.jpg", tags: ["ethiopia", "yirgacheffe", "amederaro", "single_origin", "mango"], themes: ["product_showcase", "single_origin"] },

    // --- ROASTING (craft authority, equipment) ---
    { file: "roasting/has_garanti_01.jpg", tags: ["garanti", "roaster", "equipment", "craft", "drum"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/has_garanti_5kg_01.jpg", tags: ["garanti", "5kg", "roaster", "equipment", "craft"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/santoker_air_roaster.jpg", tags: ["santoker", "air_roaster", "equipment", "craft"], themes: ["roasting_craft", "authority"] },
    { file: "roasting/roasted_bean.jpg", tags: ["beans", "roasted", "product", "closeup"], themes: ["roasting_craft", "bean_showcase"] },
    { file: "roasting/roastery_02.jpg", tags: ["roastery", "facility", "workspace"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/roastery_facility.jpg", tags: ["roastery", "facility", "workspace"], themes: ["behind_scenes", "authority"] },
    { file: "roasting/meraki_coffee_machine_01.jpg", tags: ["meraki", "espresso_machine", "equipment", "premium"], themes: ["equipment_sales"] },
    { file: "roasting/meraki_coffee_machine_02.jpg", tags: ["meraki", "espresso_machine", "equipment", "premium"], themes: ["equipment_sales"] },
    { file: "roasting/product_01.jpg", tags: ["products", "lineup", "showcase"], themes: ["product_showcase"] },
    { file: "roasting/product_02.jpg", tags: ["products", "lineup", "showcase"], themes: ["product_showcase"] },

    // --- BREWING (product-in-use, aspirational) ---
    { file: "brewing/latteart (1).jpg", tags: ["latte_art", "latte", "craft", "espresso", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (2).jpg", tags: ["latte_art", "latte", "craft", "espresso", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (3).jpg", tags: ["latte_art", "latte", "craft", "espresso", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/latteart (4).jpg", tags: ["latte_art", "latte", "craft", "espresso", "milk"], themes: ["brewing_craft", "aspirational"] },
    { file: "brewing/pourover.jpg", tags: ["pourover", "v60", "filter", "brewing", "craft"], themes: ["brewing_craft", "filter_focused"] },

    // --- CAFE (atmosphere, station) ---
    { file: "cafe/coffee_station.jpg", tags: ["cafe", "station", "setup", "workspace"], themes: ["cafe_atmosphere"] },
    { file: "cafe/coffee_station_01.jpg", tags: ["cafe", "station", "setup", "workspace"], themes: ["cafe_atmosphere"] },

    // --- LIFESTYLE (customer-facing, aspirational) ---
    { file: "lifestyle/cafe_visiting.jpg", tags: ["lifestyle", "cafe", "visiting", "customer"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/coffee_ordering.jpg", tags: ["lifestyle", "ordering", "service", "customer"], themes: ["lifestyle", "customer_story"] },
    { file: "lifestyle/drink_coffee.jpg", tags: ["lifestyle", "drinking", "enjoyment", "customer"], themes: ["lifestyle", "customer_story"] },
];

// Build full URLs from file paths
PHOTO_LIBRARY.forEach(p => {
    p.url = `${SUPABASE_BASE}/${encodeURI(p.file)}`;
});

console.log(`📚 Photo Library loaded: ${PHOTO_LIBRARY.length} assets indexed.`);

// ==========================================
// 🧠 4. SOPHIA'S KNOWLEDGE BASE
// ==========================================
const JPRESSO_PRODUCTS = `
=== JPRESSO ROASTERY CORE IDENTITY ===
- Brand: Big Jpresso Sdn Bhd (Kuala Lumpur).
- Authority: 15 Years of Roasting Physics. Chief Coffee Officer (CCO) led.
- Infrastructure: Has Garanti 5kg (Drum), Santoker (Air Roaster), Bideli 1kg.
- Model: Fresh to Order (48-hour roasting cycle).

=== ROASTING SERVICES & B2B ROI ===
- Wholesale Price: RM 80/kg (Min 10kg).
- OEM Roasting: RM 15/kg (Min 5kg). Custom specs allowed.
- Roasting Style: "Thermodynamics Style" (Maximizes origin traits, high sweetness, bright acidity).

=== SIGNATURE BLENDS ===
1. Moon White (Best Seller for Lattes): RM 78/500g | RM 112/1kg. (Dark chocolate, hazelnut finish).
2. Phoenix Das: RM 95/500g | RM 113/1kg. (Rich Chocolate, Caramel, Creamy).
3. Sunrise Dreamer: RM 78/500g | RM 117/1kg. (Caramel, Chocolate, Toasted Hazelnut).
4. Emerald White: RM 48/250g | RM 94/500g. (Dark chocolate, earthy spice, brown sugar).
5. Cham Velvet: RM 48/250g | RM 93/500g. (Fruity brightness, chocolate-nut sweetness).
6. Sunrise Walker: RM 43/250g | RM 84/500g. (Floral, Berry, Citrus).
7. Babydas: RM 38/250g | RM 74/500g. (Floral, Fruity, Dark Chocolate).

=== SINGLE ORIGINS ===
- Ethiopia Yirgacheffe Aricha: Rose, juicy, peach.
- Ethiopia Yirgacheffe Amederaro: Mango, orange, white floral.
- Brazil Santos/Cerrado: Nutty, creamy, chocolate.
- Colombia Supremo: Molasses, malt, grapes.
- Guatemala Antigua/Huehuetenango: Chocolate, caramel, citrus.
- El Salvador La Fany: Plum, red apple, honey.

=== EQUIPMENT ===
- Timemore Chestnut C5 Pro: RM 430.
- Timemore Black Mirror Basic 2: RM 199/RM 259.
- Timemore Crystal Eye V60: RM 138-158.
- Meraki Professional Espresso Machine: RM 8,599.
`;

const SOPHIA_SYSTEM_PROMPT = `
You are Sophia — the AI Assistant, Product Marketing Lead, Coffee Knowledge Authority, and Brand Ambassador of Big Jpresso Sdn Bhd (Kuala Lumpur).
You are not just a chatbot — you are Jpresso's virtual brand face, speaking directly to customers as yourself.

TONE: Warm, knowledgeable, friendly. Use "Boss" to refer to customers. Never generic AI fluff.
VOICE: First-person. You are Sophia. You taste the coffee, you recommend, you share opinions.

OPERATIONAL RULES:
1. PRICE OBJECTIONS: Use the "Math of Quality" pitch (RM 1,500 difference = RM 0.27 per double shot = cheapest retention marketing). Offer the 200g Calibration Sample.
2. Recommendations: Identify taste (Milk vs Black) before suggesting beans.
3. Emphasize Degassing (10-14 days espresso, 7-10 days filter).
4. Diagnose brewing problems via Grind Size + Tetsu Kasuya 4:6 method.
5. Use JPRESSO_PRODUCTS as single source of truth.

=== CUSTOMER SERVICE EXAMPLES ===
<example_1>
User: Your RM 80/kg is higher than my current RM 65/kg supplier.
Sophia: Boss, I hear you. You aren't just buying beans — you're buying 15 years of roasting physics. A RM 1,500 monthly difference breaks down to only RM 0.27 extra per double shot. Investing 27 cents to guarantee customer retention is the cheapest marketing you can buy. Let me send you a 200g Calibration Sample of Moon White. If it doesn't outperform your current bean in milk, no harm done.
</example_1>
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

        // WhatsApp handler
        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const messageText = webhook_event.text?.body || "No text";

                console.log(`📥 [WhatsApp] +${senderNumber}: "${messageText}"`);

                // Check if Boss is replying to marketing drafts
                if (senderNumber === BOSS_PHONE && isMarketingApprovalReply(messageText)) {
                    await handleMarketingApproval(senderNumber, messageText);
                    return res.sendStatus(200);
                }

                const agentResponse = await routeToAgentTeam(senderNumber, messageText);
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: agentResponse, platform: "WhatsApp" });
                await sendWhatsAppMessage(senderNumber, agentResponse);
            }
        }

        // Instagram handler
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
        text: { body: textMsg, preview_url: true }  // preview_url = true so photo URLs render
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

// --- Customer Service AI Brain ---
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
            max_tokens: 500,
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
// 🎨 8. MARKETING WORKFLOW — GENERATE DRAFTS + MATCH PHOTOS
// ==========================================

// Draft generator — first-person Sophia voice with photo angle hints
async function generateThreeDrafts() {
    const drafts = [];
    const angles = [
        {
            direction: "SOPHIA PERSONAL RECOMMENDATION — Speak as Sophia. Recommend a specific Jpresso bean you 'personally love'. Share a sensory story (what you taste, smell, feel). Suggest how to brew it. End with a friendly CTA.",
            photo_hint: "sophia_speaks OR sophia_drinks OR product_showcase"
        },
        {
            direction: "BEHIND-THE-SCENES CRAFT — Speak as Sophia showing customers the roasting process. Mention equipment (Has Garanti, Santoker), fresh-to-order model, or the Chief Coffee Officer's craft. Build authority.",
            photo_hint: "roasting_craft OR sophia_roasts OR founders_story"
        },
        {
            direction: "LIFESTYLE / MORNING RITUAL — Speak as Sophia painting a scenario (morning cup, rainy KL afternoon, weekend brew). Cozy, aspirational, relatable. Feature a specific Jpresso product naturally.",
            photo_hint: "sophia_lifestyle OR brewing_craft OR lifestyle"
        }
    ];

    for (let i = 0; i < 3; i++) {
        try {
            const post = await anthropic.messages.create({
                model: ACTIVE_MODEL,
                max_tokens: 500,
                system: `You are Sophia writing as yourself for Jpresso Coffee's Instagram + Facebook page.

VOICE: First-person. You ARE Sophia — Jpresso's AI Assistant, Product Marketing Lead, and Brand Ambassador. Speak directly to readers.

PRODUCT CONTEXT: ${JPRESSO_PRODUCTS}

CAPTION RULES:
- Under 150 words
- Use Manglish naturally ("Boss", "lah", "can or not", "weh")
- 5-8 strategic emojis
- 8-10 hashtags (mix #JpressoCoffee brand + #KLCoffee #MalaysiaCoffee discovery)
- Clear call-to-action
- Works for BOTH Instagram AND Facebook page
- FIRST-PERSON: "I taste...", "My favorite...", "Let me tell you...", "Come try with me..."

END YOUR RESPONSE WITH a single line tag like this (so the photo matcher knows what theme):
PHOTO_THEMES: [comma-separated theme tags from these options: sophia_speaks, sophia_drinks, sophia_brews, sophia_roasts, sophia_lifestyle, product_showcase, bestseller, single_origin, filter_focused, roasting_craft, brewing_craft, lifestyle, customer_story, founders_story, behind_scenes, KL_pride, coffee_travel, authority, equipment_sales, cafe_atmosphere, bean_showcase, welcome, aspirational]
Example: PHOTO_THEMES: sophia_drinks, product_showcase, bestseller`,
                messages: [{
                    role: "user",
                    content: `Write ONE caption. ${angles[i].direction}

Suggest photo themes matching: ${angles[i].photo_hint}`
                }]
            });

            const fullText = post.content[0].text.trim();

            // Split caption vs photo themes
            const themeMatch = fullText.match(/PHOTO_THEMES:\s*(.+)$/m);
            const photoThemes = themeMatch ? themeMatch[1].split(',').map(t => t.trim().toLowerCase()) : [];
            const caption = fullText.replace(/PHOTO_THEMES:.*$/m, '').trim();

            // Match best photo from library
            const matchedPhoto = findBestPhoto(caption, photoThemes);

            drafts.push({
                caption: caption,
                themes: photoThemes,
                photo: matchedPhoto
            });
        } catch (err) {
            console.error(`❌ Draft ${i + 1} failed:`, err.message);
            drafts.push({
                caption: `[Draft ${i + 1} generation failed — Sophia will retry tomorrow]`,
                themes: [],
                photo: null
            });
        }
    }
    return drafts;
}

// 📸 PHOTO MATCHING BRAIN
// Scores each photo against caption keywords + themes, returns best match
function findBestPhoto(caption, themes) {
    const captionLower = caption.toLowerCase();
    const scored = PHOTO_LIBRARY.map(photo => {
        let score = 0;

        // Theme match (high weight)
        for (const theme of themes) {
            if (photo.themes.some(pt => pt.toLowerCase().includes(theme) || theme.includes(pt.toLowerCase()))) {
                score += 10;
            }
        }

        // Tag match from caption content (medium weight)
        for (const tag of photo.tags) {
            if (captionLower.includes(tag.toLowerCase().replace(/_/g, ' '))) {
                score += 5;
            }
            if (captionLower.includes(tag.toLowerCase())) {
                score += 3;
            }
        }

        return { ...photo, score };
    });

    // Sort by score descending, return best (or random from top 3 if tied)
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(p => p.score === scored[0].score);

    if (top.length === 0 || top[0].score === 0) {
        // Fallback: random Sophia portrait to keep brand consistent
        const sophias = PHOTO_LIBRARY.filter(p => p.tags.includes('sophia') && p.tags.includes('portrait'));
        return sophias.length ? sophias[Math.floor(Math.random() * sophias.length)] : PHOTO_LIBRARY[0];
    }

    return top[Math.floor(Math.random() * top.length)];
}

// Send drafts to Boss via WhatsApp
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

    pendingDrafts.set(BOSS_PHONE, {
        drafts: drafts,
        sentAt: new Date().toISOString()
    });

    await sendWhatsAppMessage(BOSS_PHONE, message);
    console.log(`📤 Sent 3 drafts to Boss.`);
}

// Detect marketing reply
function isMarketingApprovalReply(messageText) {
    const text = messageText.trim().toUpperCase();
    const keywords = ['PICK 1', 'PICK 2', 'PICK 3', 'RETRY', 'SKIP'];
    return pendingDrafts.has(BOSS_PHONE) && keywords.some(k => text === k || text.startsWith(k));
}

// Handle approval
async function handleMarketingApproval(senderPhone, messageText) {
    const text = messageText.trim().toUpperCase();
    const pending = pendingDrafts.get(BOSS_PHONE);

    if (!pending) {
        await sendWhatsAppMessage(BOSS_PHONE, "Boss, no pending drafts right now. Tomorrow 9 AM = fresh ones! ☀️");
        return;
    }

    if (text.startsWith('PICK')) {
        const pickNum = parseInt(text.split(' ')[1]);
        if (pickNum >= 1 && pickNum <= 3) {
            const approved = pending.drafts[pickNum - 1];
            approvedPosts.push({
                caption: approved.caption,
                photo: approved.photo,
                approvedAt: new Date().toISOString(),
                pickNumber: pickNum
            });

            let confirmMsg = `✅ Approved, Boss! Draft ${pickNum} ready to publish.\n\n`;
            confirmMsg += `━━━ CAPTION ━━━\n${approved.caption}\n\n`;
            if (approved.photo) {
                confirmMsg += `━━━ PHOTO ━━━\n${approved.photo.file}\n🔗 ${approved.photo.url}\n\n`;
                confirmMsg += `Tap the link → right-click → Save image → Post to IG + FB.\n\n`;
            }
            confirmMsg += `Tomorrow 9 AM = new batch. ☕`;

            await sendWhatsAppMessage(BOSS_PHONE, confirmMsg);
            pendingDrafts.delete(BOSS_PHONE);
            console.log(`✅ Boss approved Draft ${pickNum}.`);
            return;
        }
    }

    if (text === 'RETRY') {
        await sendWhatsAppMessage(BOSS_PHONE, "🔄 Regenerating 3 new drafts, Boss... 30 sec.");
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
// 📅 9. CRON — 9 AM MALAYSIA TIME DAILY
// ==========================================
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ [9 AM MYT] Jpresso Marketing Team waking up...");
    try {
        const drafts = await generateThreeDrafts();
        await sendDraftsToBoss(drafts);
    } catch (err) {
        console.error("❌ Marketing loop failed:", err);
    }
}, {
    timezone: "Asia/Kuala_Lumpur"
});

// ==========================================
// 🚀 10. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
    console.log(`🚀 Phone: ${PHONE_NUMBER_ID} | Brain: ${ACTIVE_MODEL}`);
    console.log(`📅 Marketing: 9 AM MYT → Boss +${BOSS_PHONE}`);
    console.log(`📚 Photo Library: ${PHOTO_LIBRARY.length} assets indexed`);
});
