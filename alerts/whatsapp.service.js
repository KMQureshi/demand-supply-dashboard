const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.groupInfo = null;
        this.isReady = false;
        this.messageQueue = [];
        this.GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || "Demand-Supply Alerts";
        
        // Don't auto-init - we'll call init() manually
    }
    
    async init() {
        console.log('📱 Initializing WhatsApp Service...');
        console.log('📧 Associated Email: bbdemandsupply@gmail.com');
        
        // Create session directory
        const sessionDir = path.join(__dirname, 'whatsapp-session');
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: "demand-supply-bb",
                dataPath: sessionDir
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        // QR Code for authentication
        this.client.on('qr', (qr) => {
            console.log('\n' + '='.repeat(50));
            console.log('📱 WHATSAPP SETUP REQUIRED');
            console.log('='.repeat(50));
            console.log('\nTo connect WhatsApp:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Tap Menu → Linked Devices → Link a Device');
            console.log('3. Scan this QR code:\n');
            
            qrcode.generate(qr, { small: true });
            
            // Save QR code to file
            const qrInfo = `
===========================================
WHATSAPP QR CODE - Demand-Supply Dashboard
===========================================
Email: bbdemandsupply@gmail.com
Group: ${this.GROUP_NAME}
Time: ${new Date().toLocaleString('en-PK')}

SCAN THIS QR CODE WITH WHATSAPP:
1. Open WhatsApp on phone
2. Menu → Linked Devices → Link a Device
3. Point camera at QR code

===========================================
            `;
            
            fs.writeFileSync('./whatsapp-qr-code.txt', qrInfo);
            console.log('\n📄 QR code saved to: whatsapp-qr-code.txt');
            console.log('✅ Scan the QR code above with your phone');
            console.log('='.repeat(50) + '\n');
        });
        
        // When ready
        this.client.on('ready', async () => {
            console.log('🎉 WhatsApp client is READY!');
            this.isReady = true;
            
            // Find existing group
            await this.findGroup();
            
            // Send welcome message
            await this.sendWelcomeMessage();
            
            // Process any queued messages
            await this.processQueue();
            
            console.log('\n📱 WhatsApp Integration Status:');
            console.log(`   • Connected: ✅`);
            console.log(`   • Group: ${this.groupInfo?.name || 'Not found'}`);
            console.log(`   • Email: bbdemandsupply@gmail.com`);
        });
        
        // Handle authentication
        this.client.on('authenticated', () => {
            console.log('🔐 WhatsApp authenticated successfully!');
        });
        
        // Handle errors
        this.client.on('auth_failure', (msg) => {
            console.error('❌ WhatsApp authentication failed:', msg);
        });
        
        this.client.on('disconnected', (reason) => {
            console.log('⚠️ WhatsApp disconnected:', reason);
            this.isReady = false;
        });
        
        // Initialize
        try {
            await this.client.initialize();
            console.log('✅ WhatsApp client initialized');
        } catch (err) {
            console.error('Failed to initialize WhatsApp:', err);
        }
    }
    
    async findGroup() {
        try {
            const chats = await this.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            console.log(`🔍 Searching for group: "${this.GROUP_NAME}"`);
            console.log(`📊 Found ${groups.length} groups total`);
            
            // Try exact match first
            let group = groups.find(chat => 
                chat.name.toLowerCase().includes(this.GROUP_NAME.toLowerCase())
            );
            
            // Try first group if none found
            if (!group && groups.length > 0) {
                group = groups[0];
                console.log(`⚠️ Using first available group: "${group.name}"`);
            }
            
            if (group) {
                this.groupInfo = {
                    id: group.id._serialized,
                    name: group.name,
                    participants: group.participants.length
                };
                console.log(`✅ Using group: "${group.name}" (${group.participants.length} participants)`);
                return true;
            } else {
                console.log('⚠️ No groups found. You can:');
                console.log('   1. Create a WhatsApp group named "Demand-Supply Alerts"');
                console.log('   2. Add this WhatsApp number to your existing group');
                return false;
            }
        } catch (error) {
            console.error('Error finding group:', error.message);
            return false;
        }
    }
    
    async sendAlert(message, options = {}) {
        const {
            type = 'info',
            data = {},
            priority = 'medium'
        } = options;
        
        // Format message
        const formattedMsg = this.formatMessage(message, type, data, priority);
        
        // Send to WhatsApp group
        if (process.env.ENABLE_WHATSAPP_ALERTS === 'true') {
            return await this.sendToWhatsApp(formattedMsg);
        }
        
        return { success: false, error: 'WhatsApp alerts disabled' };
    }
    
    async sendToWhatsApp(message) {
        if (!this.isReady) {
            console.log('⚠️ WhatsApp not ready, queueing message...');
            this.messageQueue.push(message);
            return { success: false, queued: true, message: 'WhatsApp not ready' };
        }
        
        if (!this.groupInfo) {
            console.log('⚠️ No group found, trying to find one...');
            const found = await this.findGroup();
            if (!found) {
                return { success: false, error: 'No WhatsApp group available' };
            }
        }
        
        try {
            const chat = await this.client.getChatById(this.groupInfo.id);
            const result = await chat.sendMessage(message);
            
            console.log(`📱 WhatsApp alert sent to "${this.groupInfo.name}"`);
            return {
                success: true,
                messageId: result.id.id,
                group: this.groupInfo.name,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ WhatsApp send failed:', error.message);
            return { success: false, error: error.message };
        }
    }
    
    formatMessage(message, type, data, priority) {
        const timestamp = new Date().toLocaleString('en-PK', { 
            timeZone: 'Asia/Karachi',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short'
        });
        
        // Emojis based on type and priority
        let headerEmoji = '📊';
        let priorityEmoji = '🟡';
        
        if (type === 'alert' || type === 'ALERT') {
            headerEmoji = priority === 'high' ? '🚨🚨' : priority === 'medium' ? '⚠️⚠️' : '🔔';
            priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟠' : '🟡';
        } else if (type === 'report' || type === 'REPORT') {
            headerEmoji = '📈';
        } else if (type === 'update' || type === 'UPDATE') {
            headerEmoji = '🔄';
        } else if (type === 'info' || type === 'INFO') {
            headerEmoji = 'ℹ️';
        }
        
        let formatted = `${headerEmoji} *${type.toUpperCase()}* ${headerEmoji}\n\n`;
        formatted += `*${message}*\n\n`;
        formatted += `📅 *Time:* ${timestamp}\n`;
        formatted += `${priorityEmoji} *Priority:* ${priority.toUpperCase()}\n`;
        
        if (data && Object.keys(data).length > 0) {
            formatted += `\n📊 *Details:*\n`;
            Object.entries(data).forEach(([key, value]) => {
                formatted += `• *${key}:* ${value}\n`;
            });
        }
        
        formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        formatted += `_Automated alert from Demand-Supply Dashboard_\n`;
        formatted += `_Email: bbdemandsupply@gmail.com_`;
        
        return formatted;
    }
    
    async sendWelcomeMessage() {
        if (!this.groupInfo) return;
        
        const welcomeMsg = `🎉 *Demand-Supply Dashboard Connected!*\n\n` +
            `✅ WhatsApp alerts are now active\n` +
            `✅ Email: bbdemandsupply@gmail.com\n` +
            `✅ Real-time monitoring enabled\n\n` +
            `This group will receive:\n` +
            `• Supply level alerts\n` +
            `• Demand threshold warnings\n` +
            `• Inventory updates\n` +
            `• Daily performance reports\n\n` +
            `_System started: ${new Date().toLocaleString('en-PK')}_`;
        
        await this.sendToWhatsApp(welcomeMsg);
    }
    
    async processQueue() {
        if (this.messageQueue.length === 0) return;
        
        console.log(`Processing ${this.messageQueue.length} queued messages...`);
        for (const msg of this.messageQueue) {
            await this.sendToWhatsApp(msg);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.messageQueue = [];
        console.log('✅ Queue cleared');
    }
    
    // Test function
    async testConnection() {
        console.log('\n🔍 Testing WhatsApp Integration...');
        
        if (!this.isReady) {
            return { success: false, status: 'not_ready', message: 'WhatsApp client not ready' };
        }
        
        const testResult = await this.sendAlert('System Test - Demand Supply Dashboard', {
            type: 'TEST',
            data: {
                service: 'WhatsApp Integration',
                email: 'bbdemandsupply@gmail.com',
                time: new Date().toLocaleTimeString('en-PK')
            },
            priority: 'low'
        });
        
        return {
            success: testResult.success || false,
            whatsapp: testResult,
            group: this.groupInfo,
            timestamp: new Date().toISOString()
        };
    }
    
    // Get QR code info
    getQRInfo() {
        try {
            const qrFile = './whatsapp-qr-code.txt';
            if (fs.existsSync(qrFile)) {
                return fs.readFileSync(qrFile, 'utf8');
            }
            return 'QR code not generated yet. Please wait...';
        } catch (error) {
            return 'Error reading QR code file';
        }
    }
}

// Export instance
const whatsappService = new WhatsAppService();

// Initialize after a short delay
setTimeout(() => {
    if (process.env.ENABLE_WHATSAPP_WEB === 'true') {
        whatsappService.init().catch(console.error);
    }
}, 2000);

module.exports = whatsappService;