const mongoose = require("mongoose");
const { keepInSync } = require("../worker");

// Connection to Mongo
const connectToMongo = (mongoUrl) => {
  const options = { useNewUrlParser: true, useUnifiedTopology: true };

  mongoose.connect(mongoUrl, options);
  mongoose.connection.on("connected", async () => {
    console.log("Connected to MongoDB");
    keepInSync({ project: { interval: "*/5 * * * *" } });
  });
  mongoose.connection.on("error", () => {
    console.error(`Error connecting to DB`, error);
  });
};

module.exports = { connectToMongo };
