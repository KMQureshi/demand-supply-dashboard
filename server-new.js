const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    message: "Demand-Supply Dashboard API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    isVercel: !!process.env.VERCEL,
    version: "8.8.0"
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    app: "Demand-Supply Dashboard",
    version: "8.8.0",
    status: "running",
    deployed: true,
    platform: process.env.VERCEL ? "Vercel Serverless" : "Local",
    baseUrl: process.env.VERCEL_URL || "http://localhost:3001",
    endpoints: [
      "GET /",
      "GET /api/health",
      "GET /api/system/info",
      "POST /api/login",
      "GET /api/demand",
      "POST /api/demand",
      "GET /api/alerts"
    ]
  });
});

// System info endpoint
app.get("/api/system/info", (req, res) => {
  res.json({
    success: true,
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      isVercel: !!process.env.VERCEL
    }
  });
});

// WhatsApp status endpoint
app.get("/api/whatsapp/status", (req, res) => {
  res.json({
    success: true,
    whatsapp: {
      ready: false,
      status: process.env.VERCEL ? "disabled-on-vercel" : "available-locally",
      groupName: process.env.WHATSAPP_GROUP_NAME || "BB-Demand & Supply",
      isVercel: !!process.env.VERCEL
    }
  });
});

// Test WhatsApp endpoint
app.post("/api/test/whatsapp", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp would be simulated on Vercel",
    simulated: true,
    note: "Use local deployment for real WhatsApp"
  });
});

// Login endpoint
app.post("/api/login", (req, res) => {
  res.json({
    success: true,
    user: {
      id: 1,
      username: "admin",
      role: "admin",
      name: "Administrator"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    requestedUrl: req.originalUrl,
    availableEndpoints: ["/", "/api/health", "/api/system/info", "/api/whatsapp/status"]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

// Export for Vercel
module.exports = app;

// Start server only if not on Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
} else {
  console.log("✅ Vercel serverless function ready");
}