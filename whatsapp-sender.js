// whatsapp-sender.js
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

class WhatsAppSender {
  constructor() {
    this.client = null;
    this.isReady = false;
    this.queue = [];
  }

  initialize() {
    console.log('📱 Initializing WhatsApp Web...');
    
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    this.client.on('qr', qr => {
      console.log('📱 Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
      console.log('QR code generated. Scan with WhatsApp Web on your phone.');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      this.isReady = true;
      this.processQueue();
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated!');
    });

    this.client.on('auth_failure', msg => {
      console.error('❌ WhatsApp authentication failed:', msg);
    });

    this.client.on('disconnected', (reason) => {
      console.log('❌ WhatsApp client disconnected:', reason);
      this.isReady = false;
    });

    this.client.initialize();
  }

  async sendMessage(phone, message) {
    // Format phone number
    const formattedPhone = this.formatPhoneNumber(phone);
    
    console.log(`📱 Attempting to send WhatsApp to: ${formattedPhone}`);
    console.log(`Message: ${message.substring(0, 50)}...`);
    
    if (!this.isReady) {
      console.log('⚠️ WhatsApp not ready, adding to queue...');
      this.queue.push({ phone: formattedPhone, message });
      return { success: false, queued: true, message: 'Added to queue' };
    }

    try {
      const chatId = `${formattedPhone}@c.us`;
      const response = await this.client.sendMessage(chatId, message);
      
      console.log('✅ WhatsApp message sent successfully!');
      console.log(`Message ID: ${response.id._serialized}`);
      
      return {
        success: true,
        messageId: response.id._serialized,
        timestamp: new Date().toISOString(),
        phone: formattedPhone
      };
    } catch (error) {
      console.error('❌ WhatsApp send error:', error.message);
      return {
        success: false,
        error: error.message,
        phone: formattedPhone
      };
    }
  }

  formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (Pakistan: 92)
    if (!cleaned.startsWith('92') && cleaned.length === 10) {
      cleaned = '92' + cleaned;
    }
    
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  }

  processQueue() {
    if (this.queue.length > 0 && this.isReady) {
      console.log(`📱 Processing ${this.queue.length} queued messages...`);
      this.queue.forEach(async (item, index) => {
        setTimeout(async () => {
          await this.sendMessage(item.phone, item.message);
        }, index * 2000); // 2 second delay between messages
      });
      this.queue = [];
    }
  }
}

module.exports = WhatsAppSender;