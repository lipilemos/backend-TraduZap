const mongoose = require("mongoose");
const { Schema } = mongoose;

const notifySchema = new Schema(
    {
        body: String
    },
    {
        timestamps: true
    }
)

const Notify = mongoose.model("Notify", notifySchema);

module.exports = Notify;