const { Project, Domain } = require("./models");
const mongoose = require("mongoose");
const { keepInSync } = require("../worker");

// Connection to Mongo
const connectToMongo = (mongoUrl) => {
  const options = { useNewUrlParser: true, useUnifiedTopology: true };

  mongoose.connect(mongoUrl, options);
  mongoose.connection.on("connected", async () => {
    const projects = await Project.find({}).populate("domains");

    projects.forEach(({ domains, port, dir, outputDirectory }) => {
      domains.forEach((domain) => {
        keepInSync({ domain: domain.name, port, dir, outputDirectory });
      });
    });
  });
  mongoose.connection.on("error", () => {
    console.error(`Error connecting to DB`, error);
  });
};

module.exports = {
  connectToMongo,
  Project,
  Domain,
};
