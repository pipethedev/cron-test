const { model, Schema } = require("mongoose");
const projectSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  uuid: {
    type: Number,
    required: true,
    unique: true,
  },
  domains: [
    {
      ref: "Domain",
      type: Schema.Types.ObjectId,
    },
  ],
  pid: {
    type: Number,
  },
  port: {
    type: Number,
  },
});

module.exports = model("Project", projectSchema);
