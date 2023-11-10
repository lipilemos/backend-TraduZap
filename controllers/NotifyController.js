const mongoose = require("mongoose")
const Notify = require("../models/Notify")


//process a new payment
const notifyPayment = async (req, res) => {
    //get body da requisição
    const body = req.body
    const reqUser = req.user

    try {       
        const notifyResponse = await Notify.create({body})
                
        if (!notifyResponse) {
            res.status(422).json({ errors: ["Erro ao criar pagamento"] })
            return
        }
        //if sucess
        res.status(201).json(notifyResponse)
        return

    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Erro de Notificação"] })
        return
    }
}

//#endregion

module.exports = {
    notifyPayment
}