"use strict";

const mongoose = require("mongoose");

async function connectMongo(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 15000
  });
  return mongoose.connection;
}

module.exports = {
  connectMongo
};

