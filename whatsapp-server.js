// whatsapp-server.js - For 24/7 hosting (NOT Vercel)
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// WhatsApp client
let client = null;
let isReady = false;
let groupId = null;
let groupName = null;

// Start WhatsApp
function initWhatsApp() {
    console.log("🚀 WhatsApp Server Starting...");
    
    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "bb-demand-production",
            dataPath: "./whatsapp-session"
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote'
            ]
        }
    });

    client.on("qr", (qr) => {
        console.log("\n" + "=".repeat(60));
        console.log("📱 SCAN QR CODE (One-time setup)");
        console.log("=".repeat(60));
        qrcode.generate(qr, { small: true });
        console.log("\n📱 WhatsApp → Settings → Linked Devices → Link a Device");
        console.log("=".repeat(60));
    });

    client.on("ready", async () => {
        console.log("✅ WhatsApp READY for BB-Demand & Supply!");
        isReady = true;
        
        // Auto-find group
        try {
            const chats = await client.getChats();
            const groups = chats.filter(c => c.isGroup);
            
            const bbGroup = groups.find(g => 
                g.name && (
                    g.name.toLowerCase().includes("bb-demand") ||
                    g.name.toLowerCase().includes("demand & supply") ||
                    (g.name.toLowerCase().includes("demand") && g.name.toLowerCase().includes("supply"))
                )
            );
            
            if (bbGroup) {
                groupId = bbGroup.id._serialized;
                groupName = bbGroup.name;
                console.log(`🎯 Group found: ${groupName}`);
            }
        } catch (error) {
            console.log("⚠️ Auto-find failed, set group ID via API");
        }
    });

    client.on("disconnected", (reason) => {
        console.log("⚠️ WhatsApp disconnected:", reason);
        isReady = false;
        console.log("🔄 Reconnecting in 10 seconds...");
        setTimeout(() => client.initialize(), 10000);
    });

    client.initialize();
}

// API Endpoints
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        whatsapp: isReady ? "connected" : "disconnected",
        group: groupName || "not set",
        timestamp: new Date().toISOString()
    });
});

app.post("/send", async (req, res) => {
    try {
        const { message, type } = req.body;
        
        if (!isReady || !groupId) {
            return res.status(400).json({
                success: false,
                error: "WhatsApp not ready or group not set"
            });
        }
        
        const icons = {
            demand: "🟢 DEMAND",
            supply: "🔵 SUPPLY",
            alert: "🚨 ALERT",
            info: "📌 INFO"
        };
        
        const prefix = icons[type] || "📌 INFO";
        const timestamp = new Date().toLocaleString("en-PK", {
            hour12: true,
            timeZone: "Asia/Karachi"
        });
        
        const fullMessage = `${prefix}\n${message}\n\n🕒 ${timestamp}`;
        
        await client.sendMessage(groupId, fullMessage);
        
        res.json({
            success: true,
            message: "Sent to WhatsApp",
            group: groupName
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post("/set-group", (req, res) => {
    const { groupId: newGroupId } = req.body;
    
    if (!newGroupId || !newGroupId.endsWith('@g.us')) {
        return res.status(400).json({
            success: false,
            error: "Invalid group ID"
        });
    }
    
    groupId = newGroupId;
    isReady = true;
    
    res.json({
        success: true,
        message: "Group ID set"
    });
});

app.get("/status", (req, res) => {
    res.json({
        ready: isReady,
        groupId: groupId,
        groupName: groupName,
        status: isReady ? "connected" : "disconnected"
    });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`📡 WhatsApp Server running on port ${PORT}`);
    console.log(`🔗 Health: http://localhost:${PORT}/health`);
    console.log(`🔗 Status: http://localhost:${PORT}/status`);
    console.log(`🔗 Send: POST http://localhost:${PORT}/send`);
    console.log("\n💡 Deploy this on Railway/Render/Heroku for 24/7 WhatsApp");
    
    initWhatsApp();
});
