const { model, Schema } = require("mongoose");
const domainSchema = new Schema({
  project: {
    ref: "Project",
    type: Schema.Types.ObjectId,
  },
  name: {
    type: String,
    required: true,
    unique: true,
  },
});

module.exports = model("Domain", domainSchema);
