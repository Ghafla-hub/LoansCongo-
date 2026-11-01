const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    demoPin: {
        type: String,
        required: true,
        select: false
    },

    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },

    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("User", userSchema);
