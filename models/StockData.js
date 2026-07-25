// https://mongoosejs.com/docs/index.html
const mongoose = require('mongoose');

// define the structure of the stock Data Schema
const stockDataSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true, // make the letter uppercase for the symbol 
        index: true // יוצר אינדקס כדי שהחיפושים של ה-NN וה-LSTM יהיו מהירים מאוד
    },
    interval: {
        type: String,
        required: true,
        enum: ['1d', '1m', '5m', '15m', '60m'], // just those values can be save on this field
    },
    date: {
        type: Date,
        required: true,
    },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true }
}, {
    timestamps: true //add automatic createdAt and updatedAt values to each feild
});

//the index function from the Mongoose library make legend for the database 
//this will help to organize them and enforce rules 
//the first index (The Object that contains the feilds) means to sort the data in 
// accesnding order from those fields (make them one key for exmaple apple on the 25.7 with 1d)
// AAPL_1d_2026-07-25,this is key.
// the unique(second parameter) enforce that there will be just unique keys
stockDataSchema.index({ symbol: 1, interval: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StockData', stockDataSchema);