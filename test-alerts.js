const EmailService = require('./alerts/email.service');
const WhatsAppService = require('./whatsapp-service');

async function testAll() {
    console.log('🚀 Testing Demand-Supply Alert System');
    console.log('📧 Email: bbdemandsupply@gmail.com\n');
    
    console.log('='.repeat(50));
    console.log('1. Testing Email Service...');
    console.log('='.repeat(50));
    
    try {
        const emailResult = await EmailService.sendTestEmail('bbdemandsupply@gmail.com');
        console.log('✅ Email test sent');
        console.log('   Message ID:', emailResult.messageId);
    } catch (emailError) {
        console.log('❌ Email test failed:', emailError.message);
        console.log('\n💡 Troubleshooting email:');
        console.log('   • Check password: bbconstruction@1234');
        console.log('   • Enable "Less secure app access" at:');
        console.log('     https://myaccount.google.com/security');
        console.log('   • Or use App Password with 2-Step Verification');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('2. Testing WhatsApp Service...');
    console.log('='.repeat(50));
    
    console.log('   WhatsApp status:', WhatsAppService.isReady ? '✅ Ready' : '⏳ Not ready');
    console.log('   Group:', WhatsAppService.groupInfo?.name || 'Not found');
    
    if (WhatsAppService.isReady) {
        try {
            const whatsappResult = await WhatsAppService.testConnection();
            console.log('   Test result:', whatsappResult.success ? '✅ Sent' : '❌ Failed');
        } catch (whatsappError) {
            console.log('   Error:', whatsappError.message);
        }
    } else {
        console.log('\n💡 To setup WhatsApp:');
        console.log('   • Check terminal for QR code');
        console.log('   • Or check file: whatsapp-qr-code.txt');
        console.log('   • Scan QR with WhatsApp → Linked Devices');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('3. Testing Complete');
    console.log('='.repeat(50));
    
    console.log('\n📋 Next steps:');
    console.log('   • Check email bbdemandsupply@gmail.com for test message');
    console.log('   • Check WhatsApp group for test alert');
    console.log('   • Test API endpoints:');
    console.log('     curl http://localhost:3001/');
    console.log('     curl -X POST http://localhost:3001/api/test/email');
    console.log('\n🎉 Setup complete!');
}

// Run tests after 3 seconds (give services time to initialize)
setTimeout(() => {
    testAll().catch(console.error);
}, 3000);