// ===================================================
// DEMAND-SUPPLY DASHBOARD SERVER
// WORKING WHATSAPP ALERT SYSTEM
// ===================================================

const jsonServer = require("json-server");
const express = require('express');
const cors = require('cors');
const path = require("path");
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ===================================================
// CONFIGURATION
// ===================================================

// Your WhatsApp number
const YOUR_NUMBER = "923216323092";

console.log('WhatsApp Alert System Ready');
console.log('   Your number: ' + YOUR_NUMBER);

// ===================================================
// WHATSAPP FUNCTION
// ===================================================

async function sendWhatsAppAlert(message, alertType = "info") {
  console.log('\nSENDING WHATSAPP ALERT...');
  console.log('   To: ' + YOUR_NUMBER);
  console.log('   Message: ' + message.substring(0, 50) + '...');
  
  // Log to database
  const dbAlert = logAlertToDatabase({
    type: alertType,
    message: message,
    whatsapp_sent: true,
    timestamp: new Date().toISOString()
  });
  
  // Show in console
  console.log('\nSIMULATED WHATSAPP ALERT:');
  console.log('   To: ' + YOUR_NUMBER);
  console.log('   Message: ' + message);
  console.log('   Time: ' + new Date().toLocaleTimeString());
  console.log('   Status: Logged to database (ID: ' + dbAlert.id + ')');
  
  // Generate WhatsApp link
  const whatsappLink = 'https://wa.me/' + YOUR_NUMBER + '?text=' + encodeURIComponent(message.substring(0, 100));
  
  return {
    success: true,
    simulated: true,
    message: "Alert processed and logged",
    alert_id: dbAlert.id,
    whatsapp_link: whatsappLink,
    instructions: "Click the link above to send manually, or check /api/alerts to view all alerts"
  };
}

// ===================================================
// ALERT FORMATTING
// ===================================================

function formatAlert(alertData) {
  const type = alertData.type;
  const data = alertData.data || {};
  const priority = alertData.priority || "medium";
  
  let message = "";
  let emoji = "📢";
  
  if (type === "NEW_DEMAND") {
    emoji = "📋";
    message = emoji + " *NEW DEMAND*\n\n";
    message += "Item: " + (data.item || "N/A") + "\n";
    message += "Quantity: " + (data.quantity || 0) + "\n";
    message += "Project: " + (data.project || "N/A") + "\n";
    message += "Demand No: " + (data.demandNo || "N/A") + "\n";
    message += "Priority: " + (data.priority || "Medium") + "\n";
  } else if (type === "URGENT_DEMAND") {
    emoji = "🔴";
    message = emoji + " *URGENT! DEMAND PENDING*\n\n";
    message += "Item: " + (data.item || "N/A") + "\n";
    message += "Pending Qty: " + (data.pendingQty || 0) + "\n";
    message += "Due Date: " + (data.dueDate || "ASAP") + "\n";
    message += "Project: " + (data.project || "N/A") + "\n";
    message += "Demand No: " + (data.demandNo || "N/A") + "\n";
    message += "❗ IMMEDIATE ACTION REQUIRED\n";
  } else if (type === "SUPPLY_RECEIVED") {
    emoji = "✅";
    message = emoji + " *SUPPLY UPDATE*\n\n";
    message += "Item: " + (data.item || "N/A") + "\n";
    message += "Received: " + (data.quantityReceived || 0) + "\n";
    message += "Total Supplied: " + (data.totalSupplied || 0) + "\n";
    message += "Pending Now: " + (data.pending || 0) + "\n";
    message += "Status: " + (data.status || "N/A") + "\n";
  } else if (type === "DEMAND_FULFILLED") {
    emoji = "🎉";
    message = emoji + " *DEMAND COMPLETED*\n\n";
    message += "Item: " + (data.item || "N/A") + "\n";
    message += "Quantity: " + (data.suppliedQty || 0) + "\n";
    message += "Demand No: " + (data.demandNo || "N/A") + "\n";
    message += "Project: " + (data.project || "N/A") + "\n";
    message += "Status: Fully Supplied ✅\n";
  } else {
    message = emoji + " *ALERT*\n\n" + (data.message || "System alert") + "\n";
  }
  
  // Add footer
  message += "\n🕒 " + new Date().toLocaleTimeString() + "\n";
  message += "📊 Demand-Supply Dashboard\n";
  message += "🔗 http://localhost:" + PORT;
  
  return message;
}

// ===================================================
// DATABASE LOGGING
// ===================================================

function logAlertToDatabase(alert) {
  try {
    const db = router.db;
    
    // Initialize alerts collection
    if (!db.get('alerts').value()) {
      db.set('alerts', []).write();
      console.log("Created alerts collection in database");
    }
    
    const alerts = db.get('alerts').value();
    
    // Create alert object
    const alertObj = {
      id: alerts.length + 1,
      ...alert,
      timestamp: alert.timestamp || new Date().toISOString()
    };
    
    // Save to database
    db.get('alerts').push(alertObj).write();
    
    console.log("Alert logged to database: " + alert.type + " (ID: " + alertObj.id + ")");
    
    return alertObj;
    
  } catch (error) {
    console.error("Database logging error:", error.message);
    return { id: "temp", ...alert };
  }
}

// ===================================================
// EXPRESS SETUP
// ===================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JSON Server
const router = jsonServer.router(path.join(__dirname, "db.json"));
app.use(jsonServer.defaults());
app.use(jsonServer.bodyParser);

// ===================================================
// API ENDPOINTS
// ===================================================

// 1. TEST WHATSAPP
app.post('/api/test/whatsapp', async (req, res) => {
  console.log("\nTest WhatsApp endpoint called");
  
  const message = req.body.message || "✅ Test from Demand-Supply Dashboard\nTime: " + new Date().toLocaleString() + "\nStatus: System is working!";
  
  const result = await sendWhatsAppAlert(message, "TEST");
  
  res.json({
    success: true,
    message: "WhatsApp test completed successfully",
    details: {
      your_number: YOUR_NUMBER,
      test_message: message,
      database_logged: true,
      check_alerts: "http://localhost:" + PORT + "/api/alerts"
    },
    result: result
  });
});

// 2. SEND ALERT
app.post('/api/alert', async (req, res) => {
  console.log("\nSend Alert endpoint called");
  
  const type = req.body.type;
  const message = req.body.message;
  const data = req.body.data || {};
  const priority = req.body.priority || "medium";
  
  if (!type) {
    return res.status(400).json({
      success: false,
      error: "Alert type is required"
    });
  }
  
  // Format the alert message
  const alertData = {
    type: type,
    data: { message: message, ...data },
    priority: priority
  };
  
  const formattedMessage = formatAlert(alertData);
  
  // Send WhatsApp alert
  const whatsappResult = await sendWhatsAppAlert(formattedMessage, type);
  
  // Also log to database
  const dbAlert = logAlertToDatabase({
    type: type,
    message: message,
    data: data,
    priority: priority,
    whatsapp_sent: true,
    formatted_message: formattedMessage,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: "Alert processed successfully",
    alert: {
      id: dbAlert.id,
      type: type,
      message: message,
      priority: priority,
      timestamp: dbAlert.timestamp
    },
    whatsapp: whatsappResult,
    view_alert: "http://localhost:" + PORT + "/api/alerts"
  });
});

// 3. CREATE DEMAND (WITH AUTO-ALERTS)
app.post('/demand', async (req, res) => {
  console.log("\nCreate Demand endpoint called");
  
  try {
    const db = router.db;
    const demands = db.get("demand").value() || [];
    
    // Create new demand
    const newId = demands.length > 0 ? Math.max(...demands.map(d => d.id)) + 1 : 1;
    const newDemand = {
      id: newId,
      ...req.body,
      pending_qty: (req.body.demanded_qty || 0) - (req.body.supplied_qty || 0),
      status: "Pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Save to database
    db.get("demand").push(newDemand).write();
    
    console.log("Demand created: " + newDemand.demand_no + " - " + newDemand.item);
    
    // AUTO-SEND ALERT FOR HIGH PRIORITY DEMANDS
    let alertSent = false;
    
    if (newDemand.priority === "High") {
      const alertMessage = formatAlert({
        type: "URGENT_DEMAND",
        data: {
          item: newDemand.item,
          quantity: newDemand.demanded_qty,
          pendingQty: newDemand.pending_qty,
          project: newDemand.project,
          demandNo: newDemand.demand_no,
          dueDate: newDemand.due_date
        },
        priority: "high"
      });
      
      await sendWhatsAppAlert(alertMessage, "URGENT_DEMAND");
      alertSent = true;
      
      console.log("Auto-alert sent for urgent demand: " + newDemand.item);
    }
    
    res.status(201).json({
      success: true,
      message: "Demand created successfully",
      demand: newDemand,
      auto_alert_sent: alertSent,
      alert_type: alertSent ? "URGENT_DEMAND" : "None",
      view_demand: "http://localhost:" + PORT + "/demand/" + newId
    });
    
  } catch (error) {
    console.error("Error creating demand:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 4. UPDATE DEMAND (WITH AUTO-ALERTS)
app.patch('/demand/:id', async (req, res) => {
  try {
    const db = router.db;
    const demandId = parseInt(req.params.id);
    
    const demand = db.get("demand").find({ id: demandId }).value();
    if (!demand) {
      return res.status(404).json({
        success: false,
        error: "Demand not found"
      });
    }
    
    const oldSuppliedQty = demand.supplied_qty || 0;
    const newSuppliedQty = req.body.supplied_qty || oldSuppliedQty;
    
    // Update demand
    const updated = { ...demand, ...req.body };
    updated.pending_qty = (updated.demanded_qty || 0) - (updated.supplied_qty || 0);
    updated.updated_at = new Date().toISOString();
    
    // Update status
    if (updated.supplied_qty >= updated.demanded_qty) {
      updated.status = "Supplied";
    } else if (updated.supplied_qty > 0) {
      updated.status = "Partially Supplied";
    } else {
      updated.status = "Pending";
    }
    
    db.get("demand").find({ id: demandId }).assign(updated).write();
    
    console.log("Demand updated: " + updated.demand_no + " - " + updated.item);
    
    // AUTO-ALERT FOR SUPPLY UPDATES
    let alertSent = false;
    let alertType = "";
    
    if (newSuppliedQty > oldSuppliedQty) {
      const increase = newSuppliedQty - oldSuppliedQty;
      
      alertType = "SUPPLY_RECEIVED";
      const alertMessage = formatAlert({
        type: alertType,
        data: {
          item: updated.item,
          quantityReceived: increase,
          totalSupplied: updated.supplied_qty,
          pending: updated.pending_qty,
          status: updated.status,
          demandNo: updated.demand_no,
          project: updated.project
        },
        priority: updated.priority === "High" ? "high" : "medium"
      });
      
      await sendWhatsAppAlert(alertMessage, alertType);
      alertSent = true;
      
      console.log("Auto-alert sent for supply update: " + increase + " units of " + updated.item);
    }
    
    res.json({
      success: true,
      message: "Demand updated successfully",
      demand: updated,
      auto_alert_sent: alertSent,
      alert_type: alertType,
      supply_increase: alertSent ? (newSuppliedQty - oldSuppliedQty) : 0
    });
    
  } catch (error) {
    console.error("Error updating demand:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 5. GET ALL ALERTS
app.get('/api/alerts', (req, res) => {
  const db = router.db;
  
  // Initialize if not exists
  if (!db.get('alerts').value()) {
    db.set('alerts', []).write();
  }
  
  const alerts = db.get('alerts').value() || [];
  const limit = req.query.limit || 50;
  const type = req.query.type;
  
  let filteredAlerts = [...alerts].reverse(); // Newest first
  
  if (type) {
    filteredAlerts = filteredAlerts.filter(a => a.type === type);
  }
  
  const limitedAlerts = filteredAlerts.slice(0, parseInt(limit));
  
  // Count by type
  const byType = {};
  alerts.forEach(alert => {
    byType[alert.type] = (byType[alert.type] || 0) + 1;
  });
  
  // Count today's alerts
  const today = new Date();
  const todayAlerts = alerts.filter(a => {
    const alertDate = new Date(a.timestamp);
    return alertDate.toDateString() === today.toDateString();
  }).length;
  
  res.json({
    success: true,
    total_alerts: alerts.length,
    showing: limitedAlerts.length,
    alerts: limitedAlerts,
    summary: {
      by_type: byType,
      today: todayAlerts
    }
  });
});

// 6. TRIGGER DEMAND ALERT
app.post('/api/trigger-demand-alert/:id', async (req, res) => {
  const db = router.db;
  const demandId = parseInt(req.params.id);
  
  const demand = db.get("demand").find({ id: demandId }).value();
  if (!demand) {
    return res.status(404).json({
      success: false,
      error: "Demand not found"
    });
  }
  
  // Determine alert type based on demand status
  let alertType = "DEMAND_UPDATE";
  if (demand.status === "Pending" && demand.priority === "High") {
    alertType = "URGENT_DEMAND";
  } else if (demand.status === "Supplied") {
    alertType = "DEMAND_FULFILLED";
  } else if (demand.status === "Partially Supplied") {
    alertType = "SUPPLY_RECEIVED";
  }
  
  const alertMessage = formatAlert({
    type: alertType,
    data: {
      item: demand.item,
      quantity: demand.demanded_qty,
      suppliedQty: demand.supplied_qty,
      pendingQty: demand.pending_qty,
      status: demand.status,
      project: demand.project,
      demandNo: demand.demand_no,
      dueDate: demand.due_date
    },
    priority: demand.priority === "High" ? "high" : "medium"
  });
  
  const whatsappResult = await sendWhatsAppAlert(alertMessage, alertType);
  
  res.json({
    success: true,
    message: "Demand alert triggered",
    demand: {
      id: demand.id,
      demand_no: demand.demand_no,
      item: demand.item,
      status: demand.status
    },
    alert: {
      type: alertType,
      message: alertMessage.substring(0, 100) + "..."
    },
    whatsapp: whatsappResult,
    view_alerts: "http://localhost:" + PORT + "/api/alerts"
  });
});

// 7. SERVER INFO
app.get('/', (req, res) => {
  const db = router.db;
  const demands = db.get("demand").value() || [];
  const alerts = db.get('alerts').value() || [];
  
  // Count pending demands
  const pendingDemands = demands.filter(d => d.status === "Pending").length;
  
  // Count today's alerts
  const today = new Date();
  const todayAlerts = alerts.filter(a => {
    const d = new Date(a.timestamp);
    return d.toDateString() === today.toDateString();
  }).length;
  
  res.json({
    app: "Demand-Supply Dashboard",
    version: "2.0",
    status: "running",
    server_time: new Date().toISOString(),
    statistics: {
      total_demands: demands.length,
      pending_demands: pendingDemands,
      total_alerts: alerts.length,
      alerts_today: todayAlerts
    },
    whatsapp: {
      your_number: YOUR_NUMBER,
      status: "simulation_mode",
      real_whatsapp_link: "https://wa.me/" + YOUR_NUMBER,
      test_message: "https://wa.me/" + YOUR_NUMBER + "?text=Test+from+Dashboard"
    },
    endpoints: {
      test_whatsapp: "POST /api/test/whatsapp",
      send_alert: "POST /api/alert",
      view_alerts: "GET /api/alerts",
      create_demand: "POST /demand",
      update_demand: "PATCH /demand/:id",
      trigger_alert: "POST /api/trigger-demand-alert/:id",
      all_demands: "GET /demand"
    },
    quick_test: {
      step1: "POST http://localhost:" + PORT + "/api/test/whatsapp",
      step2: "POST http://localhost:" + PORT + "/demand (with priority: 'High')",
      step3: "GET http://localhost:" + PORT + "/api/alerts"
    }
  });
});

// 8. CLEAR ALERTS
app.delete('/api/alerts', (req, res) => {
  const db = router.db;
  db.set('alerts', []).write();
  
  res.json({
    success: true,
    message: "All alerts cleared",
    remaining: 0
  });
});

// ===================================================
// JSON SERVER ROUTES
// ===================================================

app.use(router);

// ===================================================
// START SERVER
// ===================================================

app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('DEMAND-SUPPLY DASHBOARD SERVER v2.0');
  console.log('WHATSAPP ALERT SYSTEM (SIMULATION MODE)');
  console.log('='.repeat(70));
  console.log('Server: http://localhost:' + PORT);
  console.log('Your WhatsApp: ' + YOUR_NUMBER);
  console.log('Mode: Simulation (Alerts logged to database)');
  console.log('='.repeat(70));
  
  console.log('\nIMMEDIATE TEST (Use Thunder Client):');
  console.log('1. POST http://localhost:' + PORT + '/api/test/whatsapp');
  console.log('   Body: {"message": "Test alert from my app"}');
  console.log('');
  console.log('2. POST http://localhost:' + PORT + '/demand');
  console.log('   Body: {');
  console.log('     "demand_no": "DEM-001",');
  console.log('     "item": "Cement (OPC)",');
  console.log('     "demanded_qty": 100,');
  console.log('     "project": "Site A",');
  console.log('     "priority": "High"');
  console.log('   }');
  console.log('');
  console.log('3. GET http://localhost:' + PORT + '/api/alerts');
  console.log('   (View all sent alerts)');
  
  console.log('\nFOR REAL WHATSAPP:');
  console.log('1. Manually send: https://wa.me/' + YOUR_NUMBER);
  console.log('2. Or use: https://wa.me/' + YOUR_NUMBER + '?text=Your+message');
  
  console.log('\nYOUR DATA WILL BE SAVED IN:');
  console.log('   - db.json (demands and alerts)');
  console.log('   - Check alerts at: /api/alerts');
  
  console.log('='.repeat(70));
  
  // Initialize alerts collection
  const db = router.db;
  if (!db.get('alerts').value()) {
    db.set('alerts', []).write();
    console.log('Created alerts collection in database');
  }
});