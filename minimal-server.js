// minimal-server.js
const express = require("express");
const app = express();

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "Minimal server works" });
});

app.get("/", (req, res) => {
    res.json({ message: "BB-Demand & Supply WhatsApp Server" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
