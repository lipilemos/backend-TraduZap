const express = require("express")
const router = express();


//userRoutes
router.use("/api/users", require("./UserRoutes"))
router.use("/api/plans", require("./PlansRoutes"))
router.use("/api/configuration", require("./ConfigurationRoutes"))
router.use("/api/payments", require("./PaymentsRoutes"))
router.use("/api/notify", require("./NotifyRoutes"))

//test router
router.get("/", (req, res) => {
    res.send("API Working");
})
module.exports = router