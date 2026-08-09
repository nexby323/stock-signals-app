const express = require('express');//for creating the server
const cron = require('node-cron');//for schedule jobs 
const SystemController = require('./controllers/SystemController'); //get the manager class
const cors = require('cors'); // for accessing from other devices to this server  
//creating the site and define enviroment variables 
const app = express(); 
const PORT = process.env.PORT || 3000;

// 
app.use(express.json()); //make the server able to read JSON 
app.use(cors()); // make the server able to get requests from other devices
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
systemController.initializeSystem();
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

/**
 * Route: POST /api/register
 * Description: Create a new user in the system
 */
app.post('/api/register', async (req, res) => {
    // Extract data sent from the mobile application
    //of course need to add more feilds to the request from the app (this is the registration)
    const { email, password } = req.body;
 
    try {
        console.log(`[Register Route] Received request for email: ${email}`);

        // TODO: Insert the database INSERT query here
        // ----------------------------------------------------
        // for example... (idk)
        // const result = await db.query(
        //   'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id', 
        //   [email, password]
        // );
        // ----------------------------------------------------

        // For now, returning a mock success response so the app can proceed
        res.status(201).json({ message: 'User registered successfully' });

    } catch (error) {
        console.error('[Register Route] Error:', error);
        res.status(500).json({ error: 'Failed to register user. Internal server error.' });
    }
});

/**
 * Route: POST /api/login
 * Description: Authenticate an existing user
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log(`[Login Route] Attempt for email: ${email}`);

        // TODO: Insert the database SELECT query here
        // ----------------------------------------------------
        // for example...
        // const user = await db.query(
        //   'SELECT * FROM users WHERE email = $1 AND password = $2', 
        //   [email, password]
        // );
        // if (user.rows.length === 0) {
        //     return res.status(401).json({ error: 'Invalid email or password' });
        // }
        // ----------------------------------------------------

        // For now, returning a mock success response
        res.status(200).json({ message: 'Login successful' });

    } catch (error) {
        console.error('[Login Route] Error:', error);
        res.status(500).json({ error: 'Failed to authenticate user.' });
    }
});

/**
 * Route: GET /api/stocks
 * Description: Fetches analyzed market data using the SystemController and returns it to the client.
 */
app.get('/api/stocks', async (req, res) => {
    try {
        console.log(`[Stocks Route] Requesting analysis via SystemController...`);
        
        const symbol = 'AAPL'; //TODO: take this from the symbol the user choose

        // this call activate the analysis on synbol
        const controllerResult = await systemController.triggerManualAnalysis(symbol);
        
        const rawDailyData = controllerResult.rawDailyData;
        const aiAnalysis = controllerResult.analysis;

        // make the data with the format of the application
        
        // take the data of the day and the one before for the application 
        const latestRecord = rawDailyData[rawDailyData.length - 1];
        const previousRecord = rawDailyData[rawDailyData.length - 2];
        
        const currentPrice = latestRecord ? latestRecord.close : 0;
        const prevClose = previousRecord ? previousRecord.close : currentPrice;
        
        const priceDiff = currentPrice - prevClose;
        const trendPct = ((priceDiff / prevClose) * 100).toFixed(2);
        const isUp = priceDiff >= 0;
        const trendString = `${isUp ? '+' : ''}${trendPct}%`;

        const stocksPayload = [{
            id: '1',
            symbol: symbol,
            name: 'Apple Inc.',
            price: currentPrice,
            trend: trendString,
            isUp: isUp,
            //maybe add this (confidence of the model)
            aiConfidence: aiAnalysis.confidence_score 
        }];

        // make the data for the graph 
        const recentSlice = rawDailyData.slice(-6);
        const chartPayload = {
            labels: recentSlice.map(item => {
                const d = new Date(item.date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }),
            datasets: [{ data: recentSlice.map(item => item.close) }]
        };

        // response to the client 
        res.status(200).json({
            stocks: stocksPayload,
            chart: chartPayload
        });

    } catch (error) {
        console.error('[Stocks Route] Error:', error.message);
        res.status(500).json({ error: 'Failed to process stock analysis.' });
    }
});

// ===============
// activate server
// ===============

app.listen(PORT, () => {
    console.log(`[Server] Node.js backend is running on http://localhost:${PORT}`);
    console.log(`[Server] Ready to accept a connection from the mobile app `);
});