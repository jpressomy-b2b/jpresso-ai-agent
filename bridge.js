// ==========================================
// 📦 1. REQUIRES (The Ingredients)
// ==========================================
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const cron = require('node-cron');

// ==========================================
// 🔑 2. CONFIGURATION & KEYS
// ==========================================
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; 
const PHONE_NUMBER_ID = process.env.META_PHONE_ID || "1058678540664095"; 
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "Jpresso2026";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY, 
});

//// ==========================================
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
// 🛡️ 4. META VERIFICATION CHECK
// ==========================================
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log('✅ Meta Webhook Verified!');
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// ==========================================
// 📥 5. RECEIVE INCOMING LEAD & PROCESS
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        res.sendStatus(200); 
        const body = req.body;
        
        if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes) {
            const webhook_event = body.entry[0].changes[0].value.messages;
            
            if (webhook_event && webhook_event[0]) {
                const messageData = webhook_event[0];
                const senderNumber = messageData.from;
                const messageText = messageData.text ? messageData.text.body : "No text";
                
                console.log(`\n📥 New Lead Incoming: +${senderNumber} - "${messageText}"`);
                console.log("🧠 Sophia is analyzing the lead...");

                // 1. Get Sophia's expert coffee advice
                const agentResponse = await routeToAgentTeam(messageText, senderNumber);

                // 2. Prepare the Lead Data
                const leadEntry = { 
                    phone: senderNumber, 
                    msg: messageText, 
                    reply: agentResponse, 
                    time: new Date().toISOString() 
                };

                // 3. Save locally to leads.json
                fs.appendFileSync('leads.json', JSON.stringify(leadEntry) + '\n');
                
                // 4. Sync to Google Sheets (Make.com)
                await syncLeadToSheet(leadEntry); 
                
                // 5. Send the reply back to the customer
                await sendWhatsAppMessage(senderNumber, agentResponse);

                console.log(`📊 Lead synced to Google Sheets. Reply delivered.`);
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
async function sendWhatsAppMessage(toPhone, textMsg) {
    const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
    
    const payload = {
        messaging_product: "whatsapp",
        to: toPhone,
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

        if(response.ok) {
            console.log(`✅ Reply successfully delivered!`);
        } else {
            const errorData = await response.json();
            console.error("❌ META API ERROR:", JSON.stringify(errorData));
        }
    } catch (err) {
        console.error("❌ Network Error sending message:", err);
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
async function routeToAgentTeam(messageText, phone) {
    try {
        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022", // Fixed Model Name
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
            model: "claude-3-5-sonnet-20241022", // Fixed Model Name
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
