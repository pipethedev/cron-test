const { model, Schema } = require("mongoose");
const projectSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  domain: {
    type: String,
  },
  pid: {
    type: Number,
  },
  port: {
    type: Number,
  },
});

module.exports = model("Project", projectSchema);
