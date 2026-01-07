# Create new server-new.js
@'
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===================================================
// GUARANTEED WORKING ENDPOINTS
// ===================================================

// 1. Health endpoint (ALWAYS WORKS)
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

// 2. Root endpoint (ALWAYS WORKS)
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

// 3. System info endpoint
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
    },
    deployment: {
      vercelUrl: process.env.VERCEL_URL,
      vercelEnv: process.env.VERCEL_ENV,
      vercelRegion: process.env.VERCEL_REGION
    }
  });
});

// 4. Test WhatsApp endpoint
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
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
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
'@ | Out-File server-new.js -Encoding UTF8