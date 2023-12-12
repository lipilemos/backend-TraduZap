const User = require("../models/User")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")
const nodemailer = require("nodemailer");
const { google } = require("googleapis")

const jwtSecret = process.env.JWT_SECRET

const generateToken = (id) => {
    return jwt.sign({ id }, jwtSecret, { expiresIn: "7d" })
}
const oAuth2Client = new google.auth.OAuth2(process.env.ID_CLIENT, process.env.SECRET_KEY, process.env.REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

//register new user
const register = async (req, res) => {
    //get body da requisição
    const { name, email, password } = req.body
    //find User on mongoose(findOne)
    const user = await User.findOne({ email })

    //if User exists
    if (user) {
        res.status(422).json({ errors: ["E-mail já cadastrado"] })
        return
    }

    //generate hash + salt =(349u82h5r237rh223yt32h8t726245h2340gf572g2h938ghTg)
    const salt = await bcrypt.genSalt()
    const passwordHash = await bcrypt.hash(password, salt)

    //create user on mongoose(create)
    const newUser = await User.create({
        name,
        email,
        password: passwordHash,
        active: true
    })

    //if user created
    if (!newUser) {
        res.status(422).json({ errors: ["Erro ao criar Usuário"] })
        return
    }

    res.status(201).json({
        _id: newUser._id,
        token: generateToken(newUser._id)
    })
}
//login user
const login = async (req, res) => {

    //get body da requisição
    const { email, password } = req.body
    //find user by email on mongoose
    const user = await User.findOne({ email })

    //if User not exists
    if (!user) {
        res.status(404).json({ errors: ["Usuário não encontrado"] })
        return
    }
    //compare password decrypted
    if (!(await bcrypt.compare(password, user.password))) {
        res.status(422).json({ errors: ["Senha inválida"] })
        return
    }

    res.status(201).json({
        _id: user._id,
        profileImage: user.profileImage,
        token: generateToken(user._id),
        //getconfiguration
    })
}
//get current user 
const getCurrentUser = async (req, res) => {
    const user = req.user;

    res.status(200).json(user)
}
//update image 
const update = async (req, res) => {
    const { name, password, comment, cpf, active } = req.body
    let profileImage = null

    if (req.file)
        profileImage = req.file.filename
    console.log(req.body)
    const reqUser = req.user
    const user = await User.findById(new mongoose.Types.ObjectId(reqUser._id)).select("-password")

    if (name)
        user.name = name

    if (password) {
        const salt = await bcrypt.genSalt()
        const passwordHash = await bcrypt.hash(password, salt)
        user.password = passwordHash
    }
    if (cpf)
        user.cpf = cpf

    if (active)
        user.active = active

    if (profileImage)
        user.profileImage = profileImage

    if (comment)
        user.comment = comment

    await user.save()

    res.status(200).json(user)
}
//get user by ID
const getUserById = async (req, res) => {
    const { id } = req.params

    try {
        const user = await User.findById(new mongoose.Types.ObjectId(id)).select("-password")

        //if user exists
        if (!user) {
            res.status(404).json({ errors: ["Usuário não encontrado"] })
            return
        }
        res.status(200).json(user)
    } catch (error) {
        res.status(404).json({ errors: ["Usuário não encontrado"] })
    }
}
// Redefinir senha
const newPassword = async (req, res) => {
    const { token, password, confirmPassword } = req.body;

    try {
        if (password !== confirmPassword) {
            res.status(402).json({ errors: ["As senhas não são iguais"] });
            return;
        }
        // Verificar se o token é válido
        const decodedToken = jwt.verify(token, jwtSecret);

        // Encontrar o usuário com base no token
        const user = await User.findOne({ email: decodedToken.email });

        if (!user) {
            res.status(404).json({ errors: ["Usuário não encontrado"] });
            return;
        }

        // Atualizar a senha do usuário
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(password, salt);
        user.password = passwordHash;

        // Limpar o token de redefinição de senha
        //user.resetToken = null;

        // Salvar o usuário atualizado
        await user.save();

        res.status(200).json({ message: "Senha redefinida com sucesso" });
    } catch (error) {
        res.status(400).json({ errors: ["Token inválido ou expirado"] });
    }
};
const sendPasswordResetEmail = async (req, res) => {
    const { email } = req.body;
   
    try {
        
        // Encontrar o usuário com base no token
        const user = await User.findOne({ email});

        if (!user) {
            res.status(404).json({ errors: ["Usuário não encontrado"] });
            return;
        }
        // Gere um token para redefinição de senha
        const resetToken = jwt.sign({ email }, jwtSecret, { expiresIn: "1h" });

        const acessToken = await oAuth2Client.getAccessToken();
        // Configurar o transporte de e-mail (substitua com suas próprias configurações)
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: "traduzapapp@gmail.com",
                clientId: process.env.ID_CLIENT,
                clientSecret: process.env.SECRET_KEY,
                refreshToken: process.env.REFRESH_TOKEN,
                acessToken: acessToken
            },
        });

        // Opções do e-mail
        const mailOptions = {
            from: "traduzapapp@gmail.com",
            to: email,
            subject: "Redefinição de Senha",
            //text: `Você solicitou a redefinição de senha. Clique no seguinte link para redefinir sua senha: http://localhost:3000/reset/${resetToken}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redefinição de Senha</title>
    <style>
        .header {
            background-color: #00a884;
            color: #fff;
            padding: 10px;
            text-align: center;
            height: 70px;
            display: flex;
            justify-content: space-between;
        }

        .title {
            margin: 0;
            margin-bottom: 20px;
            padding-left: 15px;
            width: auto;
            text-align: left;
        }

        img {
            width: 36px;
            margin-right: 5px;
        }

        body {
            margin: 0;
            font-family: Arial, sans-serif;
        }

        #background {
            background-image: url('https://site.traduzapp.com.br/static/media/Fundo-WhatsApp-1.bded4f44087fb4e89252.png');
            height: 500px;
            text-align: center;
        }

        #content {
            padding: 1.5em 0.5em;
            max-width: 600px;
            margin: 0 auto 2em auto;
        }
    </style>
</head>
<body>
    <div class='header'>
        <h1 class='title'>
            <img src="https://site.traduzapp.com.br/static/media/logo192.ef7c0a9756382c1202a8.png" alt="Logo">TraduzApp
        </h1>
    </div>

    <div id="background">
        <div id="content">
            <h1>R<span style="font-weight: 100; font-size: x-large;">edefinição de Senha</span></h1>
            <p class="subtitle">Você solicitou a redefinição de senha. Clique no seguinte link para redefinir sua senha: </br> <a href='https://site.traduzapp.com.br/reset/${resetToken}'>Clique aqui</a></p>
        </div>
    </div>
</body>
</html>`
            };

        // Enviar e-mail
        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Senha enviada com sucesso" });
    } catch (error) {
        res.status(400).json({ errors: ["Erro ao enviar senha"] });
    }

};

module.exports = {
    register, login, getCurrentUser, update, getUserById, newPassword, sendPasswordResetEmail
}