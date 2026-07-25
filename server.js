require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db'); 

const app = express();
const PORT = process.env.PORT || 3000;

//connect to DB before server start listening
connectDB();

// useful for json data
app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});