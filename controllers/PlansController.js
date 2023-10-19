const Configuration = require("../models/Configuration")
const Plans = require("../models/Plans")
const TypesPlans = require("../models/TypesPlans")
const User = require("../models/User")
const mongoose = require("mongoose")

//insert new plans
const insertPlans = async (req, res) => {
    //get body da requisição
    const { planId, paymentId } = req.body
    const reqUser = req.user
    //find User on mongoose(findOne)
    try {
        const user = await User.findById(reqUser.id)
        const typePlan = await TypesPlans.findById(planId)
        const plans = await Plans.findOne({ userId: reqUser.id, active: true }).sort([["createdAt", -1]]).exec()
        //console.log(plans)    
        if (plans) {
            res.status(402).json({ errors: ["Já existe plano ativo"] })
            return
        }
        //create a Plans
        const newPlans = await Plans.create({
            name: typePlan.name,
            planId,
            userId: user._id,
            active: true,
            paymentId,
            usageChamadasAPI: 0,
            usageUse: 0,
        })
        if (!newPlans) {
            res.status(422).json({ errors: ["Erro ao criar plano"] })
            return
        }
        //if sucess
        else {
            const newConfiguration = await Configuration.create({
                name: "Minha Configuração",
                groupMessage: false,
                selfMessage: false,
                sharedMessage: false,
                translateMessage: false,
                numberPhoneWhatsapp: "",
                onlyContactList: false,
                active: true,
                saveMessage: false,
                sdkOpenIA: "",
                qrCode: "",
                userId: user._id,
                isAuthenticate: false,
                userName: user.name
            })
            if (!newConfiguration) {
                res.status(422).json({ errors: ["Erro ao criar configuração"] })
                return
            }
        }
        //if sucess
        res.status(201).json(newPlans)
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//delete a plans by ID
const deletePlans = async (req, res) => {
    const { id } = req.params
    const reqUser = req.user

    try {
        const plans = await Plans.findById(new mongoose.Types.ObjectId(id))

        //check is Plans exists
        if (!plans) {
            res.status(404).json({ errors: ["Plano não encontrada"] })
            return
        }
        //check if Plans is user 
        if (!plans.userId.equals(reqUser._id)) {
            res.status(422).json({ errors: ["Ocorreu um erro, tente novamente mais tarde."] })
            return
        }

        await Plans.findByIdAndDelete(plans._id)

        res.status(200).json({ id: plans._id, message: "Plano excluído com sucesso" })
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }

}
//get all plans
const getAllPlans = async (req, res) => {
    try {
        const plans = await Plans.find({}).sort([["createdAt", -1]]).exec()

        return res.status(200).json(plans)
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Planos não encontrados"] })
        return
    }
}
//get user plans by id
const getUserPlans = async (req, res) => {
    const { id } = req.params
    try {
        const plans = await Plans.findOne({ userId: id, active: true }).sort([["createdAt", -1]]).exec()
        return res.status(200).json(plans)
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//get plans by id
const getPlansById = async (req, res) => {
    const { id } = req.params
    try {
        const plans = await Plans.findById(new mongoose.Types.ObjectId(id))

        if (!plans)
            return res.status(404).json({ erros: ["Plano não encontrado"] })

        return res.status(200).json(plans)
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//update a plans
const updatePlans = async (req, res) => {
    const { id } = req.params
    const { planId, paymentId } = req.body
    const reqUser = req.user
    try {
        const plans = await Plans.findOne({ userId: reqUser._id })
        const newPlan = await TypesPlans.findById(planId)

        if (!plans) {
            res.status(404)
                .json({ erros: ["Plano não encontrado"] })
            return
        }
        //check if plan is user 
        if (!plans.userId.equals(reqUser._id.toString())) {
            res.status(422)
                .json({ errors: ["Ocorreu um erro de plano, tente novamente mais tarde."] })
            return
        }
        if (paymentId) {
            plans.paymentId = paymentId
        }

        plans.active = true
        plans.planId = newPlan._id
        plans.usageChamadasAPI = 0
        plans.usageUse = 0
        plans.name = newPlan.name

        await plans.save()

        if (plans.name !== 'custom') {
            const userConfiguration = await Configuration.findOne({ userId: reqUser._id })
            if (!userConfiguration) {
                res.status(404)
                    .json({ erros: ["Configuração não encontrada"] })
                return
            }
            //check if plan of user 
            if (!userConfiguration.userId.equals(reqUser._id.toString())) {
                res.status(422)
                    .json({ errors: ["Ocorreu um erro de configuração, tente novamente mais tarde."] })
                return
            }

            userConfiguration.onlyContactList = false
            userConfiguration.translateMessage = false
            await userConfiguration.save()
        }
        res.status(200).json({ plans, message: "Plano atualizado com sucesso!" })
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//update usage API
const updateUsageAPI = async (req, res) => {
    const { id } = req.params
    try {
        const userPlans = await Plans.findOne({ userId: id });
        const typesPlans = await TypesPlans.findById(userPlans.planId)

        if (!userPlans) {
            return res.status(404).json({ errors: ["Plano não encontrado"] });
        }
        if (!typesPlans) {
            return res.status(402).json({ errors: ["Tipo de plano não encontrado!"] });
        }
        if (userPlans.usageChamadasAPI < typesPlans.limiteChamadasAPI) {
            userPlans.usageChamadasAPI += 1
            userPlans.usageUse += 1
        }
        if (userPlans.usageChamadasAPI >= typesPlans.usageChamadasAPI)
            return res.status(402).json({ errors: ["Plano excedeu o limite de uso Diario!"] });

        await userPlans.save()

        res.status(200).json({ userPlans, message: "Plano atualizado com sucesso!" })
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//update usage API
const resetUsageAPI = async (req, res) => {
    try {
        const userPlans = await Plans.updateMany({ usageChamadasAPI: 0 })

        res.status(200).json({ userPlans, message: "Planos atualizados com sucesso!" })
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
//update usage Total
const updateUsageUse = async (req, res) => {
    const { id } = req.params
    try {
        const userPlans = await Plans.findOne({ userId: id });
        const typesPlans = await TypesPlans.findById(userPlans.planId)

        if (!userPlans) {
            return res.status(404).json({ errors: ["Plano não encontrado"] });
        }
        if (!typesPlans) {
            return res.status(402).json({ errors: ["Tipo de plano não encontrado!"] });
        }
        if (userPlans.usageUse < typesPlans.limiteUso)
            userPlans.usageUse += 1
        if (userPlans.usageUse >= typesPlans.limiteUso)
            return res.status(402).json({ errors: ["Plano excedeu o limite de uso!"] });


        await userPlans.save()

        res.status(200).json({ userPlans, message: "Plano atualizado com sucesso!" })
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Plano não encontrado"] })
        return
    }
}
module.exports = {
    insertPlans, deletePlans, getAllPlans, getUserPlans, getPlansById, updatePlans, updateUsageAPI, updateUsageUse, resetUsageAPI
}