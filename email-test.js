// Test email configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('📧 Testing Email Configuration...\n');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || 'bbdemandsupply@gmail.com',
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Email connection failed:');
    console.log('   Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check EMAIL_PASSWORD is correct');
    console.log('   2. Enable 2-Step Verification on Google');
    console.log('   3. Generate App Password at: https://myaccount.google.com/apppasswords');
    console.log('   4. Use 16-character App Password (not regular password)');
  } else {
    console.log('✅ Email server is ready to send');
    console.log('   Host:', process.env.EMAIL_HOST);
    console.log('   Port:', process.env.EMAIL_PORT);
    console.log('   User:', process.env.EMAIL_USER);
    
    // Send test email
    sendTestEmail();
  }
});

function sendTestEmail() {
  const mailOptions = {
    from: `"Demand-Supply Dashboard" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO || process.env.EMAIL_USER,
    subject: '✅ Dashboard Email Test Successful',
    text: `This is a test email from your Demand-Supply Dashboard.\n\nServer: ${process.env.APP_URL || 'Render'}\nTime: ${new Date().toLocaleString()}\n\nIf you received this, email alerts are working!`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
        <div style="background: linear-gradient(135deg, #3498db, #2980b9); padding: 20px; border-radius: 8px 8px 0 0; color: white; text-align: center;">
          <h1 style="margin: 0;">✅ Email Test Successful</h1>
          <p>Demand-Supply Dashboard</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <p>This is a test email from your Demand-Supply Dashboard deployment.</p>
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            <strong>Deployment Details:</strong><br>
            Server: ${process.env.APP_URL || 'Render'}<br>
            Time: ${new Date().toLocaleString()}<br>
            Email: ${process.env.EMAIL_USER}
          </div>
          <p>If you received this email, your dashboard's email alert system is working correctly!</p>
          <p>You will receive alerts for:</p>
          <ul>
            <li>New material demands</li>
            <li>Supply updates</li>
            <li>Daily reports</li>
            <li>System notifications</li>
          </ul>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          BB Construction &bull; Automated Demand-Supply System
        </div>
      </div>
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('❌ Test email failed:', error.message);
    } else {
      console.log('✅ Test email sent successfully!');
      console.log('   Message ID:', info.messageId);
      console.log('   Check your inbox at:', process.env.EMAIL_TO);
    }
  });
}