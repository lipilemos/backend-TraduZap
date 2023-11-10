const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentsSchema = new Schema(
    {
        paymentId: String,
        planId: mongoose.ObjectId,
        userId: mongoose.ObjectId,
        price: String,
        payment_method_id: String,
        status: String,
        status_detail: String,
    },
    {
        timestamps: true
    }
)

const Payments = mongoose.model("Payments", paymentsSchema);

module.exports = Payments;