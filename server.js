@'
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "API is working!", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", environment: process.env.NODE_ENV || "development" });
});

module.exports = app;
'@ | Out-File server.js -Encoding UTF8