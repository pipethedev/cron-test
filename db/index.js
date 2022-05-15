const { Project } = require("./models");
const mongoose = require("mongoose");
const { syncDomain } = require("../worker/sync");

// Connection to Mongo
const connectToMongo = async (mongoUrl) => {
  const options = { useNewUrlParser: true, useUnifiedTopology: true };

  try {
    mongoose.connect(mongoUrl, options);
    console.log("Connected to MongoDB");
    const projects = await Project.find({});

    projects.forEach(({ domain, port }) => {
      syncDomain.add({ domain, port });
    });
  } catch (error) {
    console.error(`Error connecting to DB`, error);
  }
};

module.exports = {
  connectToMongo,
  Project,
};
