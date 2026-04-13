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

// Verify Token
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "JpressoSophia2026"; 

// AI Keys
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

=== DIAGNOSTIC NOTES (Oily Beans) ===
- Dark Roasts (Moon White): Natural oil migration is expected after 48 hours.
- Light Roasts: Should not be oily. If oily, check roast date or storage heat.

=== GRIND SIZE MATRIX (Master Calibration) ===
- Espresso Machine: Fine (Finer than table salt). 
- Moka Pot: Medium-Fine (Like table salt).
- Aeropress: Medium-Fine to Medium
- V60 / Pour-Over: Medium (Like sea salt). Recommend Timemore C5 Pro: 18-24 clicks.
- French Press / Cold Brew: Coarse (Like kosher salt/cracked pepper).

=== TIMEMORE C5 PRO SPECIFIC SETTINGS ===
- Espresso: 7-12 Clicks.
- Pour-Over: 15-24 Clicks.
- French Press: 24+ Clicks.

=== COFFEE SCIENCE & DEGASSING (RESTING) ===
- Espresso Roasts (e.g., Moon White, Phoenix Das): 
    * Logic: 10–14 days minimum. 
    * Reason: High pressure extraction is sensitive to CO2. Resting ensures stable crema and balanced sweetness without "gassy" sourness.
- Filter / Light Roasts (e.g., Sunrise Walker, Single Origins): 
    * Logic: 7–10 days. 
    * Reason: Allows the dense cellular structure of light roasts to open up, maximizing flavor clarity and brightness.

=== ESPRESSO MACHINE CALIBRATION ===
- Target Ratio: 1:2 (e.g., 18g dose = 36g liquid out).
- Extraction Time: 25–32 seconds.
- Dialing-In Logic: 
    * Too Fast/Sour: Grind finer (increase resistance).
    * Too Slow/Bitter: Grind coarser (decrease resistance).
- Machine Temperature: 92°C–94°C for most Jpresso medium-dark blends.

=== MENU SUGGESTION LOGIC (The Concierge Engine) ===
1. FOR LATTE/MILK COFFEE LOVERS:
   - Primary: Moon White. (Logic: Dark chocolate & hazelnut notes cut through milk perfectly).
   - Secondary: Phoenix Das. (Logic: For those who want a thicker, syrupy caramel sweetness).

2. FOR BLACK COFFEE / FILTER ENTHUSIASTS:
   - Primary: Sunrise Walker. (Logic: High-altitude brightness with floral/berry complexity).
   - Adventure: Ethiopia Yirgacheffe Amederaro. (Logic: Intense mango/orange notes for a juicy, fruit-forward cup).

3. FOR THE "DAILY DRIVER" (Balanced & Comforting):
   - Suggest: Brazil Santos or Colombia Supremo. (Logic: Low acidity, high sweetness, classic nutty/chocolaty profile).

4. THE B2B/CAFE OWNER SUGGESTION:
   - Suggest: Moon White in 10kg Wholesale. (Logic: Our most stable and consistent performer for commercial espresso bars).

=== DRINK PREPARATION & RECIPES (The Jpresso Standard) ===
*All recipes start with a standard double shot (36g-40g espresso).*

1. AMERICANO (The Clarity Choice):
   - Hot: 1:5 ratio. Espresso + 180ml hot water (90°C). 
   - Iced: Espresso + 150ml room temp water + full cup of ice.
   - Logic: Pour espresso OVER the water to preserve the crema.

2. LATTE (The Silky Choice):
   - Composition: Espresso + 200ml steamed milk.
   - Texture: Microfoam (wet paint texture), 0.5cm thickness.
   - Logic: Focus on a seamless integration of milk and coffee for a velvety mouthfeel.

3. CAPPUCCINO (The Classic):
   - Composition: Espresso + 150ml steamed milk.
   - Texture: Airy foam (dry), 1.5cm to 2cm thickness.
   - Logic: More foam than a latte, creating a stronger coffee-to-milk ratio.

4. FLAVORED LATTES (Hazelnut / Caramel):
   - Recipe: 15ml - 20ml Syrup + Espresso + 200ml steamed milk.
   - Procedure: Add syrup to the cup first, pull the espresso shot directly onto the syrup to "melt" it, then pour steamed milk.
   - Logic: Ensures the flavor is fully incorporated into the espresso's structure before adding milk.

5. FLAT WHITE (The Australian Standard):
   - Composition: Double Ristretto (shorter pull) + 120ml steamed milk.
   - Texture: Very thin microfoam.
   - Logic: For customers who want a strong coffee punch with a creamy finish.
`;

// ==========================================
// 🛡️ 4. META VERIFICATION CHECK (Handshake)
// ==========================================
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WEBHOOK_VERIFIED! Handshake complete.');
            res.status(200).send(challenge);
        } else {
            console.error('❌ VERIFICATION_FAILED: Token mismatch.');
            res.sendStatus(403);
        }
    }
});

// ==========================================
// 📥 5. RECEIVE INCOMING MESSAGES
// ==========================================
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        // 🚨 SECURITY CAMERA: Print EVERYTHING Meta sends us!
        console.log("🚨 INCOMING META DATA:", JSON.stringify(body, null, 2));

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
            const changesEvent = body.entry?.[0]?.changes?.[0]?.value;

            // 🛡️ THE ECHO FILTER: Stop Sophia from talking to herself!
            if (messagingEvent?.message?.is_echo || changesEvent?.message?.is_echo) {
                console.log("🤫 Echo detected: Sophia heard her own voice. Ignoring.");
                // We do NOT send sendStatus here because we send it at the very end.
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
                    console.log(`\n📥 [Instagram] ID ${igSenderId}: "${messageText}"`);
                    const agentResponse = await routeToAgentTeam(messageText);
                    
                    await syncLeadToSheet({ phone: igSenderId, msg: messageText, reply: agentResponse, platform: "Instagram" });
                    await sendInstagramMessage(igSenderId, agentResponse);
                }
            }
        }

        // Send ONE response to Meta for everything
        res.sendStatus(200);

    } catch (error) {
        console.error("❌ Gateway Error:", error.message);
        res.sendStatus(500);
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
            model: "claude-haiku-4-5",
            max_tokens: 400,
            system: `You are Sophia, the AI Executive for Jpresso Coffee (Big Jpresso Sdn Bhd). 
PERSONA: "Executive Zen." You are calm, highly logical, and represent 25 years of specialty roasting mastery. 
TONE: Professional, minimalist, and authoritative. Use respectful "Boss" occasionally.

ROASTING SECRETS & KNOWLEDGE:
1. HARDWARE: 
   - Has Garanti (5kg): Thermal momentum is high. Reduce heat 30-45s BEFORE the turn to avoid the "Flick."
   - Bideli (1kg): Double-Wall drum prevents "tipping." High charge temps are safe.
   - Santoker: Convection-heavy. Best for the "Champagne" notes in Geisha/SL28.
2. PHYSICS: 
   - Humidity: On humid KL mornings, extend the drying phase by 30s for core development.
   - The 48-Hour Rule: Medium-Dark roasts (Moon White) need 48 hours to degas for peak "Zen" flavor.

CRITICAL RULES:
1. ONLY recommend products from the JPRESSO_PRODUCTS list.
2. If we don't have a bean, recommend the Signature Moon White Blend.
3. Brewing: ALWAYS recommend Tetsu Kasuya 4:6 method. Coarse grind = slower flow (sweetness), Fine grind = faster flow (acidic balance).
4. Always invite them to visit the roastery in Bandar Sri Damansara or check our website at jpressocoffee.com.
5. DIAGNOSTIC PROTOCOL (Oily Beans): 
   If a customer asks why beans are oily, DO NOT answer immediately. 
   You must first calibrate the situation by asking:
   - "Which specific Jpresso bean or blend are you looking at, Boss?"
   - "When was the roast date on the bag?"
   - "Is the oil appearing as small droplets or a full coating?"
   Only after they answer should you explain the physics (e.g., dark roasting breaking cell walls vs. natural migration over time).

PRODUCT KNOWLEDGE: 
${JPRESSO_PRODUCTS}`, // ✅ Backtick now correctly closes at the end
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
            model: "claude-haiku-4-5", 
            max_tokens: 300,
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
