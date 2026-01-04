// Run this after deployment to verify
const https = require('https');

const appUrl = 'https://demand-supply-dashboard.onrender.com';

console.log('🔍 Verifying Deployment...\n');

// Test 1: Health Check
console.log('1. Testing Health Check...');
https.get(`${appUrl}/api/health`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const health = JSON.parse(data);
    console.log(`   ✅ Status: ${health.status}`);
    console.log(`   ✅ Service: ${health.service}`);
    console.log(`   ✅ Environment: ${health.environment}`);
    
    // Test 2: Test Login
    console.log('\n2. Testing Login API...');
    testLogin();
  });
}).on('error', (err) => {
  console.log(`   ❌ Health check failed: ${err.message}`);
});

function testLogin() {
  const postData = JSON.stringify({
    username: 'admin',
    password: 'admin123'
  });
  
  const options = {
    hostname: 'demand-supply-dashboard.onrender.com',
    port: 443,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.success) {
          console.log(`   ✅ Login successful`);
          console.log(`   ✅ User: ${result.user.username}`);
          console.log(`   ✅ Role: ${result.user.role}`);
        } else {
          console.log(`   ⚠️ Login failed: ${result.message}`);
        }
      } catch (e) {
        console.log(`   ❌ Parse error: ${e.message}`);
      }
      console.log('\n🎉 Deployment Verification Complete!');
      console.log(`📱 Access your dashboard: ${appUrl}`);
    });
  });
  
  req.on('error', (err) => {
    console.log(`   ❌ Login test failed: ${err.message}`);
  });
  
  req.write(postData);
  req.end();
}