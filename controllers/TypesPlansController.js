const TypesPlans = require("../models/TypesPlans")
const mongoose = require("mongoose")

//get all types plans
const getAllTypesPlans = async (req, res) => {
    const typesPlans = await TypesPlans.find({}).sort([["createdAt", -1]]).exec()

    return res.status(200).json(typesPlans)
}
//get types plans by id
const getTypesPlansById = async (req, res) => {
    const { id } = req.params

    const typesPlans = await TypesPlans.findById(new mongoose.Types.ObjectId(id))

    if (!typesPlans)
        return res.status(404).json({ erros: ["Plano não encontrado"] })

    return res.status(200).json(typesPlans)
}

module.exports = {
    getAllTypesPlans, getTypesPlansById
}