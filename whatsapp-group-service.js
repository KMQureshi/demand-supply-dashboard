const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsAppGroupService {
    constructor() {
        this.client = null;
        this.groupInfo = null;
        this.isReady = false;
        this.messageQueue = [];
        
        // Your WhatsApp group details
        this.GROUP_NAME = "Demand-Supply Alerts"; // Name of your WhatsApp group
        this.ADMIN_NUMBERS = [
            "923001234567", // Your number - replace with actual number
            "923008765432"  // Other admin numbers
        ];
        
        this.init();
    }
    
    init() {
        console.log('📱 Initializing WhatsApp Group Service...');
        
        // Use LocalAuth to persist session
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: "demand-supply-dashboard"
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        // QR Code for authentication
        this.client.on('qr', (qr) => {
            console.log('\n📱 WhatsApp QR Code:');
            qrcode.generate(qr, { small: true });
            
            // Save QR code to file for easy scanning
            const qrText = `
            ========================================
            WhatsApp Login QR Code for Dashboard
            ========================================
            1. Open WhatsApp on your phone
            2. Tap Menu → WhatsApp Web
            3. Scan this QR code:
            
            ${qr}
            
            ========================================
            Group Name: ${this.GROUP_NAME}
            Admin Numbers: ${this.ADMIN_NUMBERS.join(', ')}
            ========================================
            `;
            
            fs.writeFileSync('./whatsapp-qr.txt', qrText);
            console.log('✅ QR code saved to: whatsapp-qr.txt');
            console.log('📱 Scan the QR code with WhatsApp on your phone');
        });
        
        // When ready
        this.client.on('ready', async () => {
            console.log('✅ WhatsApp client is ready!');
            this.isReady = true;
            
            // Find your group
            await this.findGroup();
            
            // Send welcome message
            await this.sendWelcomeMessage();
            
            // Process any queued messages
            await this.processQueue();
        });
        
        // Handle incoming messages
        this.client.on('message', async (message) => {
            await this.handleIncomingMessage(message);
        });
        
        // Handle authentication
        this.client.on('authenticated', () => {
            console.log('✅ WhatsApp authenticated successfully!');
        });
        
        // Handle errors
        this.client.on('auth_failure', (msg) => {
            console.error('❌ WhatsApp authentication failed:', msg);
        });
        
        // Initialize client
        this.client.initialize();
    }
    
    async findGroup() {
        try {
            // Get all chats
            const chats = await this.client.getChats();
            
            // Find group by name
            const group = chats.find(chat => 
                chat.isGroup && chat.name.toLowerCase() === this.GROUP_NAME.toLowerCase()
            );
            
            if (group) {
                this.groupInfo = {
                    id: group.id._serialized,
                    name: group.name,
                    participants: group.participants.length
                };
                console.log(`✅ Found group: ${group.name} (${group.participants.length} participants)`);
                return true;
            } else {
                console.log(`⚠️ Group "${this.GROUP_NAME}" not found. Available groups:`);
                const groups = chats.filter(chat => chat.isGroup);
                groups.forEach(g => console.log(`   - ${g.name}`));
                return false;
            }
        } catch (error) {
            console.error('Error finding group:', error);
            return false;
        }
    }
    
    async createGroup() {
        try {
            console.log(`Creating new group: ${this.GROUP_NAME}`);
            
            // Create group with admin numbers
            const group = await this.client.createGroup(
                this.GROUP_NAME,
                this.ADMIN_NUMBERS.map(num => `${num}@c.us`)
            );
            
            this.groupInfo = {
                id: group.gid._serialized,
                name: group.name,
                participants: group.participants.length
            };
            
            console.log(`✅ Group created: ${group.name}`);
            
            // Set group description
            await group.setDescription(
                `🚀 Demand-Supply Dashboard Alerts\n` +
                `Real-time notifications for inventory, demand, and supply updates\n` +
                `Created: ${new Date().toLocaleDateString()}`
            );
            
            return true;
        } catch (error) {
            console.error('Error creating group:', error);
            return false;
        }
    }
    
    async sendToGroup(message, options = {}) {
        const { type = 'info', data = null, priority = 'normal' } = options;
        
        if (!this.isReady || !this.groupInfo) {
            console.log('⚠️ WhatsApp not ready, queueing message...');
            this.messageQueue.push({ message, options });
            return { success: false, queued: true };
        }
        
        try {
            // Format message based on type
            const formattedMessage = this.formatMessage(message, type, data, priority);
            
            // Send to group
            const chat = await this.client.getChatById(this.groupInfo.id);
            const result = await chat.sendMessage(formattedMessage);
            
            console.log(`✅ Message sent to ${this.groupInfo.name}`);
            return { success: true, messageId: result.id.id };
        } catch (error) {
            console.error('Error sending to group:', error);
            return { success: false, error: error.message };
        }
    }
    
    formatMessage(message, type, data, priority) {
        const timestamp = new Date().toLocaleString('en-PK', { 
            timeZone: 'Asia/Karachi',
            hour12: true 
        });
        
        let header = '';
        let emoji = '📊';
        
        switch (type) {
            case 'alert':
                header = priority === 'high' ? '🚨🚨 **URGENT ALERT** 🚨🚨\n\n' : '🚨 **ALERT**\n\n';
                emoji = priority === 'high' ? '🚨' : '⚠️';
                break;
            case 'report':
                header = '📊 **DAILY REPORT**\n\n';
                emoji = '📊';
                break;
            case 'update':
                header = '🔄 **DATA UPDATED**\n\n';
                emoji = '🔄';
                break;
            case 'info':
                header = 'ℹ️ **INFORMATION**\n\n';
                emoji = 'ℹ️';
                break;
        }
        
        let formatted = `${header}`;
        formatted += `${emoji} *${message}*\n\n`;
        formatted += `🕒 *Time:* ${timestamp}\n`;
        formatted += `📈 *Priority:* ${priority.toUpperCase()}\n`;
        
        if (data) {
            formatted += `\n📊 *Details:*\n`;
            if (typeof data === 'object') {
                Object.entries(data).forEach(([key, value]) => {
                    formatted += `• *${key}:* ${value}\n`;
                });
            } else {
                formatted += `${data}\n`;
            }
        }
        
        formatted += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        formatted += `_This is an automated message from Demand-Supply Dashboard_`;
        
        return formatted;
    }
    
    async sendAlert(alertType, details) {
        const alertMessages = {
            'supply_low': {
                message: 'Supply Below Threshold',
                template: (data) => `Supply for ${data.item} is ${data.current}/${data.threshold} units`
            },
            'demand_high': {
                message: 'High Demand Detected',
                template: (data) => `Demand for ${data.item} exceeded: ${data.current} units`
            },
            'inventory_critical': {
                message: 'Critical Inventory Level',
                template: (data) => `Only ${data.stock} units left for ${data.item}`
            },
            'data_updated': {
                message: 'Dashboard Data Updated',
                template: (data) => `${data.user} updated ${data.section}`
            }
        };
        
        const alert = alertMessages[alertType];
        if (!alert) return { success: false, error: 'Unknown alert type' };
        
        return await this.sendToGroup(alert.template(details), {
            type: 'alert',
            data: details,
            priority: details.priority || 'medium'
        });
    }
    
    async sendDailyReport(reportData) {
        const message = `Daily Report - ${new Date().toLocaleDateString('en-PK')}`;
        
        const data = {
            'Total Supply': `${reportData.totalSupply} units`,
            'Total Demand': `${reportData.totalDemand} units`,
            'Balance': `${reportData.balance > 0 ? '+' : ''}${reportData.balance} units`,
            'Alerts Today': reportData.alertsCount,
            'Critical Items': reportData.criticalItems
        };
        
        return await this.sendToGroup(message, {
            type: 'report',
            data: data,
            priority: 'low'
        });
    }
    
    async sendWelcomeMessage() {
        const welcomeMsg = `🚀 *Demand-Supply Dashboard Connected!*\n\n` +
            `This group will receive automated alerts for:\n` +
            `✅ Supply level updates\n` +
            `✅ Demand threshold alerts\n` +
            `✅ Inventory warnings\n` +
            `✅ Daily performance reports\n\n` +
            `_System started at ${new Date().toLocaleString('en-PK')}_`;
        
        return await this.sendToGroup(welcomeMsg, { type: 'info' });
    }
    
    async handleIncomingMessage(message) {
        // Only respond to group messages
        if (!message.fromMe && message.body) {
            const chat = await message.getChat();
            
            if (chat.isGroup && chat.id._serialized === this.groupInfo?.id) {
                console.log(`📱 Group message from ${message.author || message.from}: ${message.body}`);
                
                // Handle commands
                const command = message.body.toLowerCase().trim();
                
                switch (command) {
                    case '!status':
                        await this.sendStatus(message);
                        break;
                    case '!report':
                        await this.sendQuickReport(message);
                        break;
                    case '!alerts':
                        await this.sendAlertsSummary(message);
                        break;
                    case '!help':
                        await this.sendHelp(message);
                        break;
                }
            }
        }
    }
    
    async sendStatus(triggerMessage) {
        const statusMsg = `📊 *System Status*\n\n` +
            `✅ WhatsApp: Connected\n` +
            `✅ Group: ${this.groupInfo?.name || 'Not found'}\n` +
            `✅ Members: ${this.groupInfo?.participants || 0}\n` +
            `✅ Queue: ${this.messageQueue.length} messages\n` +
            `🕒 Uptime: ${process.uptime().toFixed(0)} seconds\n` +
            `📅 Last Updated: ${new Date().toLocaleString('en-PK')}`;
        
        await triggerMessage.reply(statusMsg);
    }
    
    async sendQuickReport(triggerMessage) {
        // This would fetch actual data from your dashboard
        const reportMsg = `📈 *Quick Report*\n\n` +
            `Supply: 1,250 units\n` +
            `Demand: 1,100 units\n` +
            `Balance: +150 units\n` +
            `Alerts Today: 3\n` +
            `Critical Items: 2`;
        
        await triggerMessage.reply(reportMsg);
    }
    
    async sendAlertsSummary(triggerMessage) {
        const alertsMsg = `🚨 *Recent Alerts*\n\n` +
            `1. Supply Low - Widget Pro (15/50)\n` +
            `2. Demand High - Gadget Plus (120/100)\n` +
            `3. Inventory Critical - Tool Basic (10/40)\n\n` +
            `_Last 24 hours_`;
        
        await triggerMessage.reply(alertsMsg);
    }
    
    async sendHelp(triggerMessage) {
        const helpMsg = `📋 *Available Commands*\n\n` +
            `*!status* - Check system status\n` +
            `*!report* - Get quick dashboard summary\n` +
            `*!alerts* - View recent alerts\n` +
            `*!help* - Show this help message\n\n` +
            `_Commands work only in this group_`;
        
        await triggerMessage.reply(helpMsg);
    }
    
    async processQueue() {
        if (this.messageQueue.length > 0) {
            console.log(`Processing ${this.messageQueue.length} queued messages...`);
            
            for (const item of this.messageQueue) {
                await this.sendToGroup(item.message, item.options);
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            this.messageQueue = [];
            console.log('✅ Queue processed');
        }
    }
    
    // Test function
    async testConnection() {
        console.log('\n🔍 Testing WhatsApp Connection...');
        
        if (!this.isReady) {
            return { success: false, message: 'WhatsApp not ready yet' };
        }
        
        if (!this.groupInfo) {
            return { success: false, message: 'Group not found' };
        }
        
        const testMsg = `🔧 *Test Message*\n\n` +
            `This is a test message from the Demand-Supply Dashboard.\n` +
            `If you receive this, WhatsApp integration is working! ✅\n\n` +
            `Timestamp: ${new Date().toLocaleString('en-PK')}`;
        
        return await this.sendToGroup(testMsg, { type: 'info' });
    }
}

// Export singleton instance
module.exports = new WhatsAppGroupService();