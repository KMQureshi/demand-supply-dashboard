# Minimal working server
@'
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "API Working", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", isVercel: true });
});

module.exports = app;
'@ | Out-File server-new.js -Encoding UTF8