const mongoose = require("mongoose");

const loanApplicationSchema = new mongoose.Schema({

    fullName: {
        type: String,
        required: true,
        trim: true
    },

    phone: {
        type: String,
        required: true,
        trim: true
    },

    purpose: {
        type: String,
        required: true,
        enum: [
            "Personnel",
            "Business",
            "Studies",
            "Health",
            "Housing"
        ]
    },

    monthlyIncome: {
        type: Number,
        required: true,
        min: 0
    },

    employmentStatus: {
        type: String,
        required: true
    },

    loanAmount: {
        type: Number,
        required: true,
        min: 100,
        max: 1200
    },

    loanTerm: {
        type: Number,
        required: true,
        enum: [6, 12, 24, 36, 48, 60]
    },

    hasExistingLoans: {
        type: Boolean,
        required: true
    },

    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending"
    }

}, {
    timestamps: true
});

module.exports = mongoose.model(
    "LoanApplication",
    loanApplicationSchema
);
