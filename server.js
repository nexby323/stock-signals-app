const express = require('express');//for creating the server
const cron = require('node-cron');//for schedule jobs 
const SystemController = require('./controllers/SystemController'); //get the manager class

//creating the site and define enviroment variables 
const app = express(); 
const PORT = process.env.PORT || 3000;

// 
app.use(express.json()); //make the server able to read JSON 
const systemController = new SystemController(); // create new object of the manager class 
// =================
// set schedule jobs
// =================

//  '0 2 * * *'  cron expression to run everyday on 02:00 
cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Triggering daily analysis automatically...');
    try {
        await systemController.startDailyAnalysis();
        console.log('[Cron] Daily analysis finished successfully.');
    } catch (error) {
        console.error('[Cron] Daily analysis encountered an error:', error.message);
    }
}, {
    timezone: "Asia/Jerusalem" // make Israel time 
});
// ===========
// make routes
// ===========

// validate that the server is on 
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'active', message: 'Server is running' });
});


app.get('/api/analyze/:symbol', async (req, res) => {
    try {
        //TODO:
        //make the stock symbol pulling process, more robust 
        const symbol = req.params.symbol.toUpperCase();
        
        console.log(`[Server] Received analysis request for: ${symbol}`);

        // make call to the stock analysis function 
        const result = await systemController.triggerManualAnalysis(symbol);
        
        // return to the client the result (with sucess flag)
        res.status(200).json(result);
        
    } catch (error) {
        console.error('[Server] Error handling /api/analyze:', error.message);
        
        // return to the client about the error (on the server side)
        res.status(500).json({ 
            success: false, 
            error: 'Failed to process analysis request' 
        });
    }
});

// ===============
// activate server
// ===============

app.listen(PORT, () => {
    console.log(`[Server] Node.js backend is running on http://localhost:${PORT}`);
    console.log(`[Server] Prisma will auto-connect on the first DB query.`);
});