const mongoose = require('mongoose')

const weatherSchema = new mongoose.Schema({
    location: { type: String, required: true },
    temperature: { type: Number, required: true },
    humidity: { type: Number, required: true },
    description: { type: String, required: true }
},
    { collection: 'weather' }
)

const model = mongoose.model('weatherSchema', weatherSchema)
module.exports = model
