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
    res.json({
        message: "LoansCongo backend is running."
    });
});

// Customer registration
app.post("/api/register", async (req, res) => {
    try {
        const { phone, pin } = req.body;

        if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
            return res.status(400).json({
                message: "Enter a valid phone number."
            });
        }

        if (!/^[0-9]{4}$/.test(pin || "")) {
            return res.status(400).json({
                message: "PIN must contain exactly 4 digits."
            });
        }

        const existingUser = await User.findOne({ phone });

        if (existingUser) {
            return res.status(409).json({
                message: "Phone number already registered."
            });
        }

        // Saved as plain text (no hashing)
        const user = await User.create({
            phone,
            demoPin: pin
        });

        res.status(201).json({
            message: "Registration successful.",
            user: {
                id: user._id,
                phone: user.phone
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Registration failed."
        });
    }
});

// Customer login
app.post("/api/login", async (req, res) => {
    try {
        const { phone, pin } = req.body;

        if (!phone || !/^[0-9]{4}$/.test(pin || "")) {
            return res.status(400).json({
                message: "Invalid phone number or PIN."
            });
        }

        const user = await User.findOne({ phone })
            .select("+demoPin");

        if (!user || !user.isActive) {
            return res.status(401).json({
                message: "Invalid login details."
            });
        }

        // Direct comparison instead of bcrypt.compare
        if (user.demoPin !== pin) {
            return res.status(401).json({
                message: "Invalid login details."
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
            message: "Login successful.",
            token
        });

    } catch (error) {
        res.status(500).json({
            message: "Login failed."
        });
    }
});


// Submit a loan application
app.post("/api/loans", async (req, res) => {
    try {
        const {
            fullName, phone, purpose, monthlyIncome,
            employmentStatus, hasExistingLoans,
            loanAmount, loanTerm
        } = req.body;

        const cleanPhone = String(phone || "").replace(/\\s/g, "");

        const purposes = {
            "Personnel": "Personnel",
            "Entreprise": "Business",
            "Études": "Studies",
            "Santé": "Health",
            "Logement": "Housing"
        };

        if (!fullName || fullName.trim().length < 2 ||
            !/^\\+243[0-9]{9}$/.test(cleanPhone) ||
            !purposes[purpose] ||
            !Number.isFinite(Number(monthlyIncome)) ||
            Number(monthlyIncome) <= 0 ||
            !employmentStatus ||
            typeof hasExistingLoans !== "boolean" ||
            !Number.isFinite(Number(loanAmount)) ||
            Number(loanAmount) < 100 || Number(loanAmount) > 1200 ||
            ![6, 12, 24, 36, 48, 60].includes(Number(loanTerm))) {
            return res.status(400).json({
                message: "Veuillez vérifier les informations de votre demande."
            });
        }

        const application = await LoanApplication.create({
            fullName: fullName.trim(),
            phone: cleanPhone,
            purpose: purposes[purpose],
            monthlyIncome: Number(monthlyIncome),
            employmentStatus,
            hasExistingLoans,
            loanAmount: Number(loanAmount),
            loanTerm: Number(loanTerm),
            status: "Pending"
        });

        return res.status(201).json({
            message: "Votre demande a été enregistrée.",
            applicationId: application._id
        });

    } catch (error) {
        console.error("Loan application error:", error.message);
        return res.status(500).json({
            message: "Impossible d'enregistrer votre demande."
        });
    }
});

// Start server after MongoDB connects
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully.");

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `LoansCongo backend running on port ${PORT}`
            );
        });
    })
    .catch(error => {
        console.error(
            "MongoDB connection failed:",
            error.message
        );
    });





