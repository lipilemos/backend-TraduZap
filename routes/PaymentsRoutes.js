const express = require("express")
const router = express.Router()

//controller
const { processPayments, createReference, updatePayments, getUserPayments } = require("../controllers/PaymentsController")

//middlewares
const authGuard = require("../middleware/authGuard")

//create
router.post("/process_payments", authGuard, processPayments)
router.post("/create_preference", authGuard, createReference)
router.post("/update_payments", updatePayments)
router.get("/get_userpayments", authGuard, getUserPayments)
//router.post("/update_payments", authGuard, updatePayments)


module.exports = router

