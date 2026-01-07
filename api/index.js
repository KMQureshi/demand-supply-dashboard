# Create api folder
New-Item -ItemType Directory -Path "api" -Force

# Create index.js in api folder
@'
// Vercel Serverless Function
const express = require("express");
const app = express();

app.use(require("cors")());
app.use(express.json());

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    message: "Vercel API is working!" 
  });
});

// All other routes
app.all("*", (req, res) => {
  res.json({
    method: req.method,
    path: req.path,
    query: req.query,
    timestamp: new Date().toISOString(),
    message: "Demand-Supply Dashboard API"
  });
});

module.exports = app;
'@ | Out-File api/index.js -Encoding UTF8