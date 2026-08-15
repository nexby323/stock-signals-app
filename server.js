const express = require('express'); //for creating the server
const cron = require('node-cron'); //for schedule jobs 
const cors = require('cors'); // for accessing from other devices to this server  
const bcrypt = require('bcrypt'); // Added for secure password hashing

const SystemController = require('./controllers/SystemController'); //get the manager class
const prisma = require('./config/db'); // get the Prisma Singleton instance for DB access

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
// systemController.initializeSystem(); // Uncomment if you have an initialization method

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
 * Description: Create a new user in the system using Prisma and secure password hashing
 */
app.post('/api/register', async (req, res) => {
    // Extract data sent from the mobile application
    // of course need to add more feilds to the request from the app (this is the registration)
    const { email, password } = req.body;
 
    try {
        console.log(`[Register Route] Received request for email: ${email}`);

        // 1. Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email.' });
        }

        // 2. Hash the password for security (never store plain text in DB)
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 3. Insert the database query here via Prisma
        const newUser = await prisma.user.create({
            data: {
                email: email,
                passwordHash: hashedPassword
            }
        });

        // Returning success response so the app can proceed
        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });

    } catch (error) {
        console.error('[Register Route] Error:', error);
        res.status(500).json({ error: 'Failed to register user. Internal server error.' });
    }
});

/**
 * Route: POST /api/login
 * Description: Authenticate an existing user by comparing hashed passwords
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log(`[Login Route] Attempt for email: ${email}`);

        //Find the user in the database
        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        // If user not found
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        //Compare provided password with the hashed password stored in DB
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Returning success response
        res.status(200).json({ message: 'Login successful', userId: user.id });

    } catch (error) {
        console.error('[Login Route] Error:', error);
        res.status(500).json({ error: 'Failed to authenticate user.' });
    }
});

/**
 * Route: GET /api/stocks
 * Description: Fetches analyzed market data using the SystemController and returns it to the client.
 * Accepts a 'symbol' query parameter to dynamically fetch data for a specific stock.
 */
app.get('/api/stocks', async (req, res) => {
    try {
        // Extract the symbol from the request query (e.g., ?symbol=NVDA), default to 'AAPL'
        const symbol = (req.query.symbol || 'AAPL').toUpperCase();
        console.log(`[Stocks Route] Requesting analysis via SystemController for: ${symbol}`);
        
        // This call activates the analysis on the specific symbol
        const controllerResult = await systemController.triggerManualAnalysis(symbol);
        
        const rawDailyData = controllerResult.rawDailyData;
        const aiAnalysis = controllerResult.analysis;

        // Format the data for the mobile application dashboard
        const latestRecord = rawDailyData[rawDailyData.length - 1];
        const previousRecord = rawDailyData[rawDailyData.length - 2];
        
        const currentPrice = latestRecord ? latestRecord.close : 0;
        const prevClose = previousRecord ? previousRecord.close : currentPrice;
        
        const priceDiff = currentPrice - prevClose;
        const trendPct = prevClose > 0 ? ((priceDiff / prevClose) * 100).toFixed(2) : "0.00";
        const isUp = priceDiff >= 0;
        const trendString = `${isUp ? '+' : ''}${trendPct}%`;

        const stocksPayload = [{
            id: '1',
            symbol: symbol,
            name: `${symbol} Corp`, // Fallback name, can be enhanced with real company names later
            price: currentPrice,
            trend: trendString,
            isUp: isUp,
            aiConfidence: aiAnalysis.confidence_score || 0 
        }];

        // Prepare the chart dataset (last 6 data points)
        const recentSlice = rawDailyData.slice(-6);
        const chartPayload = {
            labels: recentSlice.map(item => {
                const d = new Date(item.date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }),
            datasets: [{ data: recentSlice.map(item => item.close) }]
        };

        // Respond to the client with the tailored data
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