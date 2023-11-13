const Configuration = require("../models/Configuration")
const Plans = require("../models/Plans")
const TypesPlans = require("../models/TypesPlans")
const Payments = require("../models/Payments")
const User = require("../models/User")
const mongoose = require("mongoose")
const { MercadoPagoConfig, Payment, Preference, } = require('mercadopago');
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACESS_TOKEN, options: { timeout: 5000 } });

//create reference 
const createReference = async (req, res) => {
    const { planId } = req.body;

    try {
        const plan = await TypesPlans.findById(new mongoose.Types.ObjectId(planId))
        const preference = {
            'items': [
                {
                    'id': planId,
                    'title': "Plano TraduZap",
                    'unit_price': Number(plan.price),
                    'quantity': 1,
                }
            ],
            'payment_methods': {
                "installments": 1,
            },
            'back_urls': {
                'success': "http://www.traduzap.com.br/user/payment/status/:id",
                'failure': "http://www.traduzap.com.br/plans",
                'pending': "http://www.traduzap.com.br/user/payment/status/:id"
            },
            'statement_descriptor': "Plano TraduZap. Transcrição de áudio para o seu Whatsapp.",
            'external_reference': planId,
            'auto_return': "approved",
            //'notification_url': 'http://www.traduzap.com.br:5000/api/payments/update_payments',
        };
        const preferences = new Preference(client)
        preferences.create({
            body: preference
        }).then(async (result) => {
            res.status(200).json(result)
            return;
        }).catch(async (error) => {
            console.log(error);
            res.status(422).json({ errors: ["Erro ao criar preferencia", error] })
            return
        });
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Erro de preferencia"] })
        return
    }
}

//process a new payment
const processPayments = async (req, res) => {
    //get body da requisição
    const { plan, formData } = req.body
    const reqUser = req.user
    try {
        if (formData.paymentId === 'null')
            return;
        
        const existPayment = await Payments.findOne({ userId: reqUser._id }).sort([["createdAt", -1]]).exec()

        if (existPayment)
            if (existPayment?.paymentId === formData.paymentId) {
                res.status(200).json(existPayment)
                return;
            }

        //const plan = await TypesPlans.findOne({ _id: formData.planId }).sort([["createdAt", -1]]).exec();
        const plan = await TypesPlans.findById(formData.planId)

        const newPayment = {
            paymentId: formData.paymentId,
            planId: formData.planId,
            userId: reqUser._id,
            price: plan.price,
            payment_method_id: formData.payment_type,
            status: formData.status,
            //status_detail: resp.status_detail
        }
        const paymentResponse = await Payments.create({
            paymentId: newPayment.paymentId,
            planId: newPayment.planId,
            userId: newPayment.userId,
            price: newPayment.price,
            payment_method_id: newPayment.payment_method_id,
            status: newPayment.status,
            status_detail: newPayment.status_detail
        })

        if (!paymentResponse) {
            res.status(422).json({ errors: ["Erro ao criar pagamento"] })
            return
        }
        if (newPayment.status === 'approved')
        //if sucess
        try {
            const user = await User.findById(reqUser.id)
            const plans = await Plans.findOne({ userId: reqUser.id, active: true }).sort([["createdAt", -1]]).exec()
            //update a plan    
            if (plans) {
                //to do:
                //fazer update
                try {
                    const plans = await Plans.findOne({ userId: reqUser._id })
                    const newPlan = await TypesPlans.findById(newPayment.planId)

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
                    if (newPayment.paymentId) {
                        plans.paymentId = newPayment.paymentId
                    }
                    //torna o plano ativo e zera o uso para a contagem do limite do plano novo
                    plans.active = true
                    plans.planId = newPlan._id
                    plans.usageChamadasAPI = 0
                    plans.usageUse = 0
                    plans.name = newPlan.name

                    await plans.save()

                    //se nao for um plano custom ou downgrade do plano custom
                    //torna as mensagens traduzidas e somente de contatos da lista como falsa
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
                    //res.status(200).json({ plans, message: "Plano atualizado com sucesso!" })
                } catch (error) {
                    console.log(error)
                    res.status(404).json({ errors: ["Plano não encontrado"] })
                    return
                }
                //res.status(402).json({ errors: ["Já existe plano ativo"] })
                //return
            }
            //create a Plans
            const newPlans = await Plans.create({
                name: plan.name,
                planId: plan._id,
                userId: user._id,
                active: true,
                paymentId: newPayment.paymentId,
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
                    //sdkOpenIA: "",
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
            //res.status(201).json(newPlans)
        } catch (error) {
            console.log(error)
            res.status(404).json({ errors: ["Plano não encontrado"] })
            return
        }
        res.status(201).json(paymentResponse)
        return;

    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Erro de Pagamento"] })
        return
    }
}
const constroiData = async (data) => {
    let ret;
    switch (data.payment_method_id) {
        case 'pix':
            // Obtém a data atual
            var dataAtual = new Date();
            // Adiciona 30 minutos à data atual
            dataAtual.setMinutes(dataAtual.getMinutes() + 30);
            // Formata a data no formato "2022-11-17T09:37:52.000-04:00"
            var dataFormatada = dataAtual.toISOString();
            ret = {
                date_of_expiration: dataFormatada,
                description: 'Plano TraduZap',
                transaction_amount: Number(data.transaction_amount),
                payment_method_id: data.payment_method_id,
                payer: {
                    email: data.payer.email
                },
            }
            return ret;
        case 'master':
            ret = {
                description: 'Plano TraduZap',
                token: data.token,
                issuer_id: data.issuer_id,
                payment_method_id: data.payment_method_id,
                transaction_amount: Number(data.transaction_amount),
                installments: Number(data.installments),
                payer: {
                    email: data.payer.email,
                    identification: {
                        type: data.payer.identification.type,
                        number: data.payer.identification.number
                    }
                }
            }
            return ret;
        case 'visa':
            ret = {
                description: 'Plano TraduZap',
                token: data.token,
                issuer_id: data.issuer_id,
                payment_method_id: data.payment_method_id,
                transaction_amount: Number(data.transaction_amount),
                installments: Number(data.installments),
                payer: {
                    email: data.payer.email,
                    identification: {
                        type: data.payer.identification.type,
                        number: data.payer.identification.number
                    }
                }
            }
            return ret;
        default:
    }
}
const updatePayments = async (req, res) => {
    console.log(req)
    const { action, data } = req.body
    const { id } = data

    try {
        if (action === "payment.updated") {
            const payment = await Payments.findOne({ paymentId: id })

            if (!payment) {
                res.status(200)
                    .json({ erros: ["Pagamento não encontrado"] })
                return
            }

            const updatedPayment = new Payment(client)
            updatedPayment.get({
                id
            }).then(async (result) => {
                console.log(result)
                const { status, id: paymentId, external_reference: planId, transaction_amount: price, payment_type_id: payment_method_id, status_detail } = result

                if (status)
                    payment.status = status
                if (status_detail)
                    payment.status_detail = status_detail
                if (planId)
                    payment.planId = planId
                if (price)
                    payment.price = price
                if (payment_method_id)
                    payment.payment_method_id = payment_method_id                

                await payment.save()

                //if sucess
                res.status(201).json(result)
                return;

            }).catch(async (error) => {
                console.log(error);
                res.status(422).json({ errors: ["Erro ao criar preferencia", error] })
                return
            });
        }
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Erro de Pagamento"] })
        return
    }
    return res.status(200)
}
//get user payments by userId
const getUserPayments = async (req, res) => {
    const reqUser = req.user
    try {
        const payment = await Payments.findOne({ userId: reqUser._id }).sort([["createdAt", -1]]).exec()
        return res.status(200).json(payment)
    } catch (error) {
        console.log(error)
        res.status(404).json({ errors: ["Pagamento não encontrado"] })
        return
    }
}
//#region TESTE  
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
//update/downgrade de plano
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
        //torna o plano ativo e zera o uso para a contagem do limite do plano novo
        plans.active = true
        plans.planId = newPlan._id
        plans.usageChamadasAPI = 0
        plans.usageUse = 0
        plans.name = newPlan.name

        await plans.save()

        //se nao for um plano custom ou downgrade do plano custom
        //torna as mensagens traduzidas e somente de contatos da lista como falsa
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
//update uso limite por usuario baseado no limite do plano
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
//update uso da API diario 0:00
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
//update uso limite diario por usuario baseado no limite diario do plano
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
//#endregion

module.exports = {
    processPayments, createReference, updatePayments, getUserPayments
}