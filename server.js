require('dotenv').config();
const express = require('express');
const cors = require('cors');

// TODO:
// const SystemController = require('./controllers/SystemController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json()); 


app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is up and running!' });
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    

    // SystemController.initializeSystem();
});