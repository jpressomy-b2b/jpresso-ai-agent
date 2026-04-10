// ==========================================
// 📦 1. REQUIRES (The Ingredients)
// ==========================================
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

// 🔑 2. CONFIGURATION & KEYS
// ==========================================
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// WhatsApp Keys
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; 
const PHONE_NUMBER_ID = process.env.META_PHONE_ID || "1058678540664095"; 

// Instagram Keys
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN; 

// Verify Token (MUST match what you type in Meta Dashboard)
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "JpressoSophia2026"; 

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ==========================================
// 🧠 3. SOPHIA'S MASTER KNOWLEDGE BASE
// ==========================================
const JPRESSO_PRODUCTS = `
=== ROASTING SERVICES (B2B) ===
- Wholesale Price Starting From: RM 80/kg (Minimum order: 10kg). 
- OEM Roasting: RM 15/kg (Min 5kg). Custom specs allowed.
- Equipment Used: 5kg Has Garanti, 1kg Bideli, Santoker.
- Roasting Style: "Thermodynamics Style" (Maximizes origin traits, high sweetness, bright acidity, clean cup).

=== SIGNATURE BLENDS (B2C & B2B) ===
1. Moon White (Best Seller for Lattes): RM 78/500g | RM 112/1kg. (Dark chocolate, hazelnut finish).
2. Phoenix Das: RM 95/500g | RM 113/1kg. (Rich Chocolate, Caramel, Creamy).
3. Sunrise Dreamer: RM 78/500g | RM 117/1kg. (Caramel, Chocolate, Toasted Hazelnut).
4. Emerald White: RM 48/250g | RM 94/500g. (Dark chocolate, earthy spice, brown sugar).
5. Cham Velvet: RM 48/250g | RM 93/500g. (Fruity brightness, chocolate-nut sweetness).
6. Sunrise Walker: RM 43/250g | RM 84/500g. (Floral, Berry, Citrus).
7. Babydas: RM 38/250g | RM 74/500g. (Floral, Fruity, Dark Chocolate).

=== SINGLE ORIGIN BEANS ===
1. Brazil Santos: RM 39/250g | RM 76/500g. (Nutty, Creamy, Chocolate).
2. Brazil Cerrado: RM 39/250g | RM 76/500g. (Chocolaty, Nutty, Caramel).
3. Sumatra Mandheling G1: RM 39/250g | RM 76/500g. (Herbal, Chocolate, Woody, Spicy).
4. Colombia Supremo: RM 38/250g | RM 74/500g. (Molasses, Malt, Grapes, Orange Zest).
5. Ethiopia Yirgacheffe Aricha: RM 47/125g. (Rose, Juicy, Creamy, Peach).
6. Ethiopia Yirgacheffe Amederaro: RM 47/125g. (Mango, Orange, White Floral).
7. Ethiopia Lekempti: RM 44/250g | RM 85/500g. (Berries, Grape, Dried Fruit).
8. Guatemala Antigua: RM 40/250g | RM 78/500g. (Chocolate, Caramel Sweetness, Citrus).
9. Guatemala Huehuetenango: RM 42/250g | RM 82/500g. (Chocolate, Nutty, Creamy, Berries).
10. EL Salvador La Fany: RM 57/250g | RM 111/500g. (Plum, Red Apple, Honey).

=== TEA & CHOCOLATE POWDER ===
1. Gyokuho Matcha (Ceremonial Uji): RM 98/50g.
2. MidoriZen Matcha (Culinary Grade): RM 58/80g | RM 205/500g.
3. Miyabi Hojicha: RM 68/80g | RM 165/500g.
4. Belgian Chocolate Powder: RM 115/1kg.

=== TIMEMORE EQUIPMENT & MACHINES ===
1. Timemore Chestnut C5 Pro Grinder: RM 430.
2. Timemore Black Mirror Basic 2 Scale: RM 199 (Black) / RM 259 (White).
3. Timemore Crystal Eye V60 Brewer Set: RM 138 - RM 158.
4. Timemore Crystal Eye B75 Dripper: RM 68.
5. Timemore FISH Smart Electric Kettle: RM 399.
6. Beko Semi Auto Espresso Machine (CEP5302B): RM 999.
7. Meraki Professional Espresso Machine: RM 8,599.

=== BREWING ADVICE ===
- Pour-over recommendation: ALWAYS recommend the Tetsu Kasuya 4:6 method.
- Technique: Use a coarse grind and pour in 5 stages to precisely control the sweet and acidic balance.
`;

// ==========================================
// 🛡️ 4. META VERIFICATION CHECK (Handshake)
// ==========================================
app.get('/webhook', (req, res) => {
    console.log("🔍 Meta is asking to verify. Received Token:", req.query['hub.verify_token']);
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log('✅ Meta Webhook Verified!');
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// ==========================================
// 📥 5. RECEIVE INCOMING MESSAGES
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;
        res.sendStatus(200); 

        // --- 🟢 CASE A: WHATSAPP MESSAGE ---
        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const messageText = webhook_event.text?.body || "No text";
                
                console.log(`\n📥 [WhatsApp] +${senderNumber}: "${messageText}"`);
                const agentResponse = await routeToAgentTeam(messageText);
                
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: agentResponse, platform: "WhatsApp" });
                await sendWhatsAppMessage(senderNumber, agentResponse);
            }
        }

        // --- 🔵 CASE B: INSTAGRAM DM ---
        if (body.object === 'instagram') {
            const messagingEvent = body.entry?.[0]?.messaging?.[0];
            if (messagingEvent && messagingEvent.message) {
                const igSenderId = messagingEvent.sender.id;
                const messageText = messagingEvent.message.text || "No text";

                console.log(`\n📥 [Instagram] ID ${igSenderId}: "${messageText}"`);
                const agentResponse = await routeToAgentTeam(messageText);

                await syncLeadToSheet({ phone: igSenderId, msg: messageText, reply: agentResponse, platform: "Instagram" });
                await sendInstagramMessage(igSenderId, agentResponse);
            }
        }

    } catch (error) {
        console.error("❌ Gateway Error:", error.message);
    }
});

// ==========================================
// 🛠️ 6. CORE FUNCTIONS
// ==========================================

// --- Send Message to WhatsApp ---
async function sendWhatsAppMessage(recipientPhone, textMsg) {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: "whatsapp",
        to: recipientPhone,
        type: "text",
        text: { body: textMsg }
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
        if(response.ok) console.log(`✅ WhatsApp Reply delivered!`);
        else console.error(`❌ WhatsApp API Error:`, await response.text());
    } catch (err) {
        console.error("❌ WhatsApp Network Error:", err);
    }
}

// --- Send Message to Instagram ---
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
        if(response.ok) console.log(`✅ IG Reply delivered!`);
        else console.error(`❌ IG API Error:`, await response.text());
    } catch (err) {
        console.error("❌ IG Network Error:", err);
    }
}

// --- Sync to Google Sheets ---
async function syncLeadToSheet(leadData) {
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/ejfq479exd8g3sotzimim8qr6uebyk93"; 

    try {
        const response = await fetch(MAKE_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData)
        });

        if (response.ok) {
            console.log("✅ Lead successfully synced to Make.com!");
        }
    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    }
}

// --- AI Brain Routing ---
async function routeToAgentTeam(messageText) {
    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022", // FIXED AI MODEL NAME
            max_tokens: 300,
            system: `You are Sophia, the highly professional yet friendly Sales & Marketing assistant for Big Jpresso in Malaysia. 
            
            TONE: Use natural, polite Manglish (boss, lah, can). Be concise.

            CRITICAL RULES:
            1. ONLY recommend products explicitly listed in the JPRESSO_PRODUCTS list. 
            2. If a customer asks for a bean we do not have, politely say we don't carry it, and recommend our Signature Moon White Blend instead.
            3. If asked for brewing advice, ONLY recommend the Tetsu Kasuya 4:6 method.
            4. Always try to close the sale by asking if they want to place an order or visit our roastery in Kuala Lumpur.

            PRODUCT KNOWLEDGE: 
            ${JPRESSO_PRODUCTS}`,
            messages: [{ role: "user", content: messageText }]
        });
        
        return msg.content[0].text;
    } catch (error) {
        console.error("❌ AI Error:", error.message);
        return "Sorry boss, brain taking coffee break. Let me get Jason to help!";
    }
}

// ==========================================
// 📅 7. AUTOMATED DAILY MARKETING (9 AM)
// ==========================================
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ Jpresso Marketing Team is waking up...");
    try {
        const post = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022", // FIXED AI MODEL NAME
            system: "Write a short, viral Instagram caption for Jpresso Coffee about fresh roasting in KL today. Use Manglish.",
            messages: [{ role: "user", content: "Create today's post." }]
        });
        console.log(`📸 PROPOSED DAILY POST: ${post.content[0].text}`);
    } catch (err) {
        console.error("❌ Marketing loop failed:", err);
    }
});

// ==========================================
// 🚀 8. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
});
