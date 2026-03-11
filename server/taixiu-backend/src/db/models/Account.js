"use strict";

const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema(
  {
    userId: { type: Number, index: true },
    balance: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
    token: { type: String, default: "", index: true }
  },
  {
    collection: "accounts",
    strict: false
  }
);

module.exports = mongoose.models.Account || mongoose.model("Account", AccountSchema);
