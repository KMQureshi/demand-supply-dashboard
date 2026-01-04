const WhatsAppService = require('./whatsapp-group-service');

// Wait a bit for initialization
setTimeout(async () => {
    console.log('\n🚀 Testing WhatsApp Integration...\n');
    
    // Test after 10 seconds (time for QR scan)
    setTimeout(async () => {
        const result = await WhatsAppService.testConnection();
        
        if (result.success) {
            console.log('✅ WhatsApp test successful!');
            console.log('📱 Check your WhatsApp group for the test message.');
            
            // Send a sample alert
            console.log('\n📤 Sending sample alert...');
            await WhatsAppService.sendAlert('supply_low', {
                item: 'Widget Pro',
                current: 15,
                threshold: 50,
                priority: 'high'
            });
            
            console.log('\n✅ All tests completed!');
            console.log('\n💡 Next steps:');
            console.log('1. Check your WhatsApp group for messages');
            console.log('2. Try commands: !status, !report, !help');
            console.log('3. Integrate with your dashboard alerts');
            
        } else {
            console.log('❌ WhatsApp test failed:', result.message);
            console.log('\n🔧 Troubleshooting:');
            console.log('1. Make sure you scanned the QR code');
            console.log('2. Check if group name matches exactly');
            console.log('3. Restart the service if needed');
        }
    }, 10000); // 10 seconds delay
    
}, 2000); // Initial delay