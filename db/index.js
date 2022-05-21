const { Project } = require("./models");
const mongoose = require("mongoose");
const { syncDomain } = require("../worker/sync");

// Connection to Mongo
const connectToMongo = (mongoUrl) => {
  const options = { useNewUrlParser: true, useUnifiedTopology: true };

  mongoose.connect(mongoUrl, options);
  mongoose.connection.on("connected", async () => {
    console.log("Connected to MongoDB");
    const projects = await Project.find({});

    projects.forEach(({ domain, port }) => {
      syncDomain.add({ domain, port });
    });
  });
  mongoose.connection.on("error", () => {
    console.error(`Error connecting to DB`, error);
  });
};

module.exports = {
  connectToMongo,
  Project,
};
