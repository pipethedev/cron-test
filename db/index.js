const mongoose = require("mongoose");
const { Project } = require("./models");
const { keepInSync } = require("../worker");
const { proxy } = require("../config");

// Connection to Mongo
const connectToMongo = (mongoUrl) => {
  const options = { useNewUrlParser: true, useUnifiedTopology: true };

  mongoose.connect(mongoUrl, options);
  mongoose.connection.on("connected", async () => {
    console.log("Connected to MongoDB");
    const projects = await Project.find({}).populate("domains");

    projects.forEach(({ domains, port }) => {
      domains.forEach(({ name }) => {
        proxy.register(name, `http://127.0.0.1:${port}`, {});
      });
    });
    keepInSync({ project: { interval: "*/1 * * * *" } });
  });
  mongoose.connection.on("error", () => {
    console.error(`Error connecting to DB`, error);
  });
};

module.exports = { connectToMongo };
