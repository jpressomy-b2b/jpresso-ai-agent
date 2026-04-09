// ==========================================
// 📦 1. REQUIRES (The Ingredients)
// ==========================================
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');          // For saving leads to leads.json
const cron = require('node-cron'); // For the daily marketing posts

// ==========================================
// 🔑 2. CONFIGURATION & KEYS
// ==========================================
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; 
const PHONE_NUMBER_ID = process.env.META_PHONE_ID; 
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY, 
});

// --- 📦 JPRESSO ADVANCED KNOWLEDGE BASE ---
const JPRESSO_PRODUCTS = `
=== ROASTING SERVICES (B2B) ===
- OEM Roasting Service: RM 15/kg (Minimum order: 5kg). 
- Equipment Used: 5kg Has Garanti, 1kg Bideli, Santoker.
- Roasting Style: "Thermodynamics Style" (Maximizes origin traits, high sweetness, bright acidity, clean cup).

=== RETAIL BEAN MENU (B2C) ===
1. JPRESSO Signature Moon White Blend
   - Price: RM 78 / 500g
   - Best For: Cafe owners, Espresso milk-based drinks (Latte/Cappuccino).
   - Notes: Our absolute best-seller. Smooth, balanced.

2. Brazil Santos
   - Price: RM 76 / 500g
   - Best For: Classic Espresso, Black coffee.
   - Notes: Chocolatey, nutty, low acidity. 

3. Ethiopia Yirgacheffe
   - Price: RM 47 / 125g
   - Best For: Filter / Pour-over.
   - Notes: Floral, fruity, bright.

=== BREWING ADVICE ===
- Pour-over recommendation: Tetsu Kasuya 4:6 method.
- Technique: Use a coarse grind and pour in 5 stages. This allows us to precisely control the sweet and acidic balance of the Jpresso beans.
`;

console.log("🚀 Jpresso OS Webhook Gateway (v119.0) Starting...");
// --- 3. META VERIFICATION CHECK ---
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "Jpresso2026";
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log('✅ Meta Webhook Verified!');
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// --- 4. THE MAIN WEBHOOK HANDLER ---
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
        try {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const message = changes?.value?.messages?.[0];

            if (message?.text) {
                const from = message.from; 
                const messageText = message.text.body;

                console.log(`📩 New Lead Incoming: ${from} - "${messageText}"`);
                console.log(`🧠 Sophia is analyzing the lead...`);

                // 1. Get Sophia's reply from Claude
                const aiReply = await routeToAgentTeam(messageText, from);

                // 2. Prepare the Lead Data
                const lead = {
                    timestamp: new Date().toISOString(),
                    phone: from,
                    message: messageText,
                    reply: aiReply
                };

                // 3. Save it locally (this is the line you already have)
                saveLead(lead);

                // 4. SYNC TO GOOGLE SHEETS (PASTE THE NEW LINE HERE!)
                await syncLeadToSheet(lead); 

                // 5. Send the reply back to the customer
                await sendWhatsAppMessage(from, aiReply);

                console.log(`📊 Lead saved and synced to Google Sheets.`);
            }
        } catch (error) {
            console.error("❌ Webhook Error:", error.message);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// --- 5. SEND MESSAGE BACK TO WHATSAPP ---
async function sendWhatsAppMessage(toPhone, textMsg) {
    // We are hardcoding the ID here to ensure it NEVER says 'undefined' again
    const url = `https://graph.facebook.com/v20.0/1058678540664095/messages`;
    
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
// --- 6. SALES & MARKETING BRAIN (SOPHIA) ---
async function routeToAgentTeam(messageText, phone) {
    try {
        const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 300,
            system: `You are Sophia, the highly professional yet friendly Sales & Marketing assistant for Big Jpresso in Malaysia. 
            
            TONE: Use natural, polite Manglish (boss, lah, can). Be concise.

            CRITICAL RULES:
            1. ONLY recommend products explicitly listed in the JPRESSO_PRODUCTS list. 
            2. If a customer asks for a bean we do not have (like Colombian or Decaf), politely say we don't carry it, and recommend our Signature Moon White Blend instead.
            3. If asked for brewing advice, ONLY recommend the Tetsu Kasuya 4:6 method for pour-overs. Do not give generic coffee advice.
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
// --- 7. AUTOMATED DAILY MARKETING (9 AM) ---
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ Jpresso Marketing Team is waking up...");
    try {
        const post = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            system: "Write a short, viral Instagram caption for Jpresso Coffee about fresh roasting in KL today. Use Manglish.",
            messages: [{ role: "user", content: "Create today's post." }]
        });
        console.log(`📸 PROPOSED DAILY POST: ${post.content[0].text}`);
    } catch (err) {
        console.error("❌ Marketing loop failed:", err);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`🟢 Jpresso Bridge Active on port ${PORT}`);
});

// --- 📊 LEAD SYNC TO GOOGLE SHEETS ---
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
