const mongoose = require("mongoose");
const { Schema } = mongoose;

const imagensSchema = new Schema({
    filename: String,
    data: Buffer,  
});

const Imagens = mongoose.model('Imagens', imagensSchema);

module.exports = Imagens;