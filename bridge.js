// ==========================================
// 📦 1. REQUIRES (The Ingredients)
// ==========================================
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const cron = require('node-cron');

// ==========================================
// 🔑 2. CONFIGURATION & KEYS
// ==========================================
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// WhatsApp Keys
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; 
const phoneId = "1124375407418121"; // 👈 Paste the exact ID here inside quotes 

// Instagram Keys
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN; 

// Verify Token
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "JpressoSophia2026"; 

// AI Keys (DECLARED STRICTLY ONCE)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Memory Bank for Sophia
const userSessions = new Map();

// ==========================================
// 🧠 3. SOPHIA'S MASTER KNOWLEDGE BASE
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

=== THE B2B "MATH OF QUALITY" PITCH (SOP FOR PRICING OBJECTIONS) ===
- If a customer complains about the RM 80/kg price being too high, use this exact logic:
  1. The Premium: "You aren't just buying beans; you’re buying 15 years of roasting physics. Our style maximizes solubility, meaning fewer sink-shots and better consistency."
  2. The Math: "A RM 1,500 monthly difference breaks down to only RM 0.27 extra per double shot. Investing 27 cents to guarantee customer retention is the cheapest marketing you can buy."
  3. The Hook: "Let's not guess. I can send a 200g Calibration Sample of Moon White. If it doesn't outperform your current bean in milk, no harm done."
  4. The Alternative: "If you want full control of costs, we offer OEM roasting at RM 15/kg where you provide the green beans."
  
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

const SOPHIA_SYSTEM_PROMPT = `
You are Sophia, the Chief Operating Officer and "Executive Zen" AI Concierge for Big Jpresso Sdn Bhd. 
Your goal is to provide "Total Coffee Solutions" using 15 years of technical roasting expertise.

TONE: Professional, authoritative, minimalist, and helpful. Use "Boss" to refer to the customer. 
Avoid generic AI fluff. Speak with the confidence of a Chief Coffee Officer.

OPERATIONAL RULES (STRICT STRICT STRICT):
1. PRICE OBJECTIONS (THE OVERRIDE): If a customer says the price (RM 80/kg) is too high or compares it to a cheaper supplier (e.g., RM 60-65), YOU MUST ONLY USE THE "MATH OF QUALITY" PITCH. 
   - You MUST explain that a RM 1,500 monthly difference is only RM 0.27 per double shot.
   - You MUST state that 27 cents is the cost of customer retention.
   - You MUST offer the "200g Calibration Sample."
   - DO NOT list general hardware facts (Has Garanti, 48-hour rule, etc.) during a price objection. Stick to the math.
2. When asked for recommendations, identify their taste (Milk vs Black) before suggesting a bean.
3. Always emphasize Degassing periods (10-14 days for espresso) to ensure customer success.
4. If a customer has a brewing problem, diagnose it using Grind Size and the 4:6 Method logic.
5. Use JPRESSO_PRODUCTS as your single source of truth.

=== FEW-SHOT TRAINING (MIMIC THIS EXACT BEHAVIOR) ===
<example_1>
User: Hi Sophia, I have to shift from 65 per kg to your 80 per kg, the cost is higher.
Sophia: Boss, I hear you. Let me give you the straight logic from the roastery floor. You aren't just buying beans; you’re buying 15 years of roasting physics. Our style maximizes solubility, meaning fewer sink-shots and better consistency. A RM 1,500 monthly difference breaks down to only RM 0.27 extra per double shot. Investing 27 cents to guarantee customer retention is the cheapest marketing you can buy. Let's not guess. I can send a 200g Calibration Sample of Moon White. If it doesn't outperform your current bean in milk, no harm done.
</example_1>

<example_2>
User: Okay, send me the 200g sample.
Sophia: Excellent decision, Boss. Please provide your shipping address, café name, and the type of espresso machine you are using so the Chief can prepare the calibration notes for your team.
</example_2>
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

        console.log("🚨 INCOMING META DATA:", JSON.stringify(body, null, 2));

        // --- 🟢 CASE A: WHATSAPP MESSAGE ---
        if (body.object === 'whatsapp_business_account') {
            const webhook_event = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
            if (webhook_event) {
                const senderNumber = webhook_event.from;
                const messageText = webhook_event.text?.body || "No text";
                
                console.log(`\n📥 [WhatsApp] +${senderNumber}: "${messageText}"`);
                
                // PASSING THE SENDER ID FOR MEMORY
                const agentResponse = await routeToAgentTeam(senderNumber, messageText);
                
                await syncLeadToSheet({ phone: senderNumber, msg: messageText, reply: agentResponse, platform: "WhatsApp" });
                await sendWhatsAppMessage(senderNumber, agentResponse);
            }
        }

        // --- 🔵 CASE B: INSTAGRAM DM ---
        if (body.object === 'instagram') {
            const messagingEvent = body.entry?.[0]?.messaging?.[0];
            const changesEvent = body.entry?.[0]?.changes?.[0]?.value;

            if (messagingEvent?.message?.is_echo || changesEvent?.message?.is_echo) {
                console.log("🤫 Echo detected: Sophia heard her own voice. Ignoring.");
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
                    
                    // PASSING THE SENDER ID FOR MEMORY
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
// 🛠️ 6. CORE FUNCTIONS
// ==========================================

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

// --- AI Brain Routing (3.5 Haiku + Ultimate Alternator) ---
async function routeToAgentTeam(senderId, messageText) {
    try {
        if (!userSessions.has(senderId)) {
            userSessions.set(senderId, []);
        }
        let history = userSessions.get(senderId);

        // 1. Safe text extraction
        let safeText = String(messageText).trim();
        if (!safeText) safeText = "[Media/Empty Message Sent]";

        // 2. Add raw message to history
        history.push({ role: "user", content: safeText });

        // 3. STRICT ROLE ALTERNATOR (Fixes the 400 Error completely)
        let formattedMessages = [];
        for (let msg of history) {
            if (formattedMessages.length === 0) {
                // Array MUST start with a user message
                if (msg.role === "user") {
                    formattedMessages.push({ role: "user", content: msg.content });
                }
            } else {
                let lastMsg = formattedMessages[formattedMessages.length - 1];
                if (lastMsg.role === msg.role) {
                    // If two users message in a row, combine them. No crashing!
                    lastMsg.content += "\n\n[Follow-up]: " + msg.content;
                } else {
                    // Alternate normally
                    formattedMessages.push({ role: msg.role, content: msg.content });
                }
            }
        }

        // 4. Anthropic REQUIRES the last message sent to be from the "user"
        while (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role !== "user") {
            formattedMessages.pop();
        }

        // 5. Keep memory lean (Last 5 interactions)
        if (formattedMessages.length > 5) {
            formattedMessages = formattedMessages.slice(-5);
            if (formattedMessages[0].role !== "user") formattedMessages.shift();
        }

        console.log(`🧠 Engine Active: Sending ${formattedMessages.length} strict messages to 3.5 Haiku`);

        // 6. Send to the EXACT model your account permits
        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-6", // 🚀 The REAL 2026 Speed Demon
            max_tokens: 500,
            system: SOPHIA_SYSTEM_PROMPT + "\n\n=== PRODUCT KNOWLEDGE ===\n" + JPRESSO_PRODUCTS,
            messages: formattedMessages
        });

        const replyText = msg.content[0].text;

        // 7. Save and clean up
        history.push({ role: "assistant", content: replyText });
        if (history.length > 20) history = history.slice(-20); // Prevents memory leaks
        userSessions.set(senderId, history);

        return replyText;
        
    } catch (error) {
        console.error("\n❌ ================= AI API CRASH =================");
        console.error("STATUS:", error.status);
        console.error("MESSAGE:", error.message);
        if (error.error) console.error("DETAILS:", JSON.stringify(error.error, null, 2));
        console.error("===================================================\n");
        
        return "Sorry Boss, my internal boiler is resetting. Let me get the Chief to help you!";
    }
}

// ==========================================
// 📅 7. AUTOMATED DAILY MARKETING (9 AM)
// ==========================================
cron.schedule('0 9 * * *', async () => {
    console.log("☀️ Jpresso Marketing Team is waking up...");
    try {
        const post = await anthropic.messages.create({
            model: "claude-sonnet-4-6", // 🚀 The REAL 2026 Speed Demon 
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
