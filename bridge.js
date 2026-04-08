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
1. ROASTING CAPABILITIES (For B2B/Cafe Clients): 
- Equipment: 5kg Has Garanti (commercial batches), 1kg Bideli (specialty/micro-lots), Santoker (sample air roasting).
- Style Specialization: Thermodynamics Style - we focus on maximizing origin characteristics, high sweetness, bright acidity, and a clean cup.
- OEM Roasting Service: RM 15/kg (Min 5kg).

2. RETAIL BEAN MENU:
- Brazil Santos: RM 76/500g. Chocolatey, nutty. Great for espresso.
- Ethiopia Yirgacheffe: RM 47/125g. Floral, Fruity. Perfect for filter/pour-over.
- JPRESSO Signature Moon White Blend: RM 78/500g. Our cafe best-seller.

3. BREWING ADVICE (If clients ask for tips):
- Pour-over recommendation: Tetsu Kasuya 4:6 method (Use a coarse grind, pour in 5 stages to control the sweet/acidic balance).
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

// --- 4. RECEIVE INCOMING LEAD & LOG TO FILE ---
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

                // --- 📝 AUTOMATIC LEAD CAPTURE ---
                // This saves every customer number and message to a local file
                const leadEntry = { phone: senderNumber, msg: messageText, time: new Date().toISOString() };
                fs.appendFileSync('leads.json', JSON.stringify(leadEntry) + '\n');
                
                console.log("🧠 Sophia is analyzing the lead...");
                const agentResponse = await routeToAgentTeam(messageText, senderNumber);
                
                await sendWhatsAppMessage(senderNumber, agentResponse);
                console.log(`📊 Lead saved to leads.json and reply delivered.`);
            }
        }
    } catch (error) {
        console.error("❌ Gateway Error:", error.message);
    }
});

// --- 5. SEND MESSAGE BACK TO WHATSAPP ---
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

// --- 6. SALES & MARKETING BRAIN (SOPHIA) ---
async function routeToAgentTeam(messageText, phone) {
    try {
        const msg = await anthropic.messages.create({
            model: "claude-haiku-4-5",
            max_tokens: 300,
            system: `You are Sophia, the Sales & Marketing assistant for Big Jpresso in Malaysia. 
            Use natural Manglish (boss, lah, can).
            PRODUCT LIST: ${JPRESSO_PRODUCTS}
            CONTEXT: In Malaysia, 'PM' means 'Private Message'—they want info or prices. 
            Goal: Answer their request and ask if they want to order or visit the roastery.`,
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