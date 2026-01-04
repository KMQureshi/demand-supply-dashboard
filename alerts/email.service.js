const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    init() {
        console.log('📧 Initializing REAL Email Service for bbdemandsupply@gmail.com');
        
        const config = {
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'bbdemandsupply@gmail.com',
                pass: process.env.EMAIL_PASSWORD || 'bbconstruction@1234'
            }
        };

        this.transporter = nodemailer.createTransport(config);
        
        // Verify connection
        this.transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email connection failed:', error.message);
                console.log('💡 Make sure "Less secure app access" is enabled for bbdemandsupply@gmail.com');
            } else {
                console.log('✅ REAL Email service ready!');
                console.log('📧 From: bbdemandsupply@gmail.com');
            }
        });
    }

    async sendTestEmail(to = 'bbdemandsupply@gmail.com') {
        try {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: #007bff; color: white; padding: 20px; }
                    .content { padding: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>✅ Test Email - Demand Supply Dashboard</h2>
                        <p>Email: bbdemandsupply@gmail.com</p>
                    </div>
                    <div class="content">
                        <p>This is a REAL test email from your Demand-Supply Dashboard.</p>
                        <p><strong>Status:</strong> ✅ Email system is working!</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
            `;

            const mailOptions = {
                from: 'Demand-Supply Dashboard <bbdemandsupply@gmail.com>',
                to: to,
                subject: '✅ REAL Test Email - Demand Supply Dashboard',
                html: html,
                text: 'This is a REAL test email from your Demand-Supply Dashboard. If you receive this, email alerts are working!'
            };

            console.log(`📧 Sending REAL email to: ${to}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ REAL Email sent! Message ID: ${info.messageId}`);
            
            return {
                success: true,
                real: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('❌ REAL Email send failed:', error.message);
            throw error;
        }
    }

    async sendAlert(type, message, data = {}) {
        try {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: #dc3545; color: white; padding: 20px; }
                    .alert-box { background: #fff3cd; padding: 15px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🚨 ${type} Alert</h2>
                        <p>Demand-Supply Dashboard</p>
                    </div>
                    <div class="content">
                        <div class="alert-box">
                            <h3>${type}</h3>
                            <p><strong>Message:</strong> ${message}</p>
                            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        ${Object.keys(data).length > 0 ? `
                        <h3>Details:</h3>
                        <ul>
                            ${Object.entries(data).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                        </ul>
                        ` : ''}
                    </div>
                </div>
            </body>
            </html>
            `;

            const mailOptions = {
                from: 'Demand-Supply Dashboard <bbdemandsupply@gmail.com>',
                to: 'bbdemandsupply@gmail.com',
                subject: `🚨 ${type} - Dashboard Alert`,
                html: html,
                text: `${type} Alert: ${message}\n\nData: ${JSON.stringify(data, null, 2)}`
            };

            console.log(`📧 Sending REAL alert: ${type}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ REAL Alert email sent! Message ID: ${info.messageId}`);
            
            return {
                success: true,
                real: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error('❌ REAL Alert email failed:', error.message);
            throw error;
        }
    }
}

module.exports = new EmailService();