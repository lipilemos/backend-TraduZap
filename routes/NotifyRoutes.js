const express = require("express")
const router = express.Router()

//controller
const { notifyPayment } = require("../controllers/NotifyController")


//routes configurations
router.post("/newpayment", notifyPayment)


module.exports = router
