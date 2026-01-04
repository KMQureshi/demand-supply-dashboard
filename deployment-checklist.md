# DEPLOYMENT CHECKLIST - Demand-Supply Dashboard

## ✅ COMPLETED:
1. GitHub Repository: https://github.com/KMQureshi/demand-supply-dashboard
2. Render Service: demand-supply-dashboard
3. Email: bbdemandsupply@gmail.com
4. App Password: [SET IN RENDER DASHBOARD]

## 🔧 SETUP STEPS:

### 1. SET ENVIRONMENT VARIABLES IN RENDER:
Go to: https://dashboard.render.com/web/demand-supply-dashboard/environment

Add these variables:

#### A. REQUIRED VARIABLES:
NODE_ENV=production
PORT=3001
EMAIL_USER=bbdemandsupply@gmail.com
EMAIL_PASSWORD=plsk buqf yyby rpfw  # Your Google App Password
WHATSAPP_GROUP_NAME=BB-Demand & Supply

#### B. RECOMMENDED VARIABLES:
APP_NAME=Demand-Supply Dashboard
APP_URL=https://demand-supply-dashboard.onrender.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_FROM=bbdemandsupply@gmail.com
EMAIL_TO=bbdemandsupply@gmail.com
DB_FILE=db.json

### 2. VERIFY DEPLOYMENT:
1. Wait for Render to redeploy (2-5 minutes)
2. Check logs for errors
3. Test: https://demand-supply-dashboard.onrender.com/api/health
4. Login with:
   - Admin: admin / admin123
   - Construction: construction / construction123
   - Procurement: procurement / procurement123

### 3. TEST EMAIL FUNCTIONALITY:
1. Create a new demand in dashboard
2. Check if email alert is sent
3. Verify in Gmail Sent folder

### 4. CONFIGURE WHATSAPP (Optional):
If WhatsApp doesn't work initially:
1. Check Render logs
2. May need separate WhatsApp worker service

## 📞 SUPPORT:
If deployment fails:
1. Check Render build logs
2. Verify environment variables
3. Test API endpoints