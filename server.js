const express = require('express'); //for creating the server
const cron = require('node-cron'); //for schedule jobs 
const cors = require('cors'); // for accessing from other devices to this server  
const bcrypt = require('bcrypt'); // Added for secure password hashing
const jwt = require('jsonwebtoken') // added this to use for user authentication
const marketApiClient = require('./services/MarketAPIClient'); // for the /api/stocks route so we can acsess daily data fast (without going through the ai models)
const SystemController = require('./controllers/SystemController'); //get the manager class
const prisma = require('./config/db'); // get the Prisma Singleton instance for DB access

// The secret key used to for our tokens. 
// It looks in the .env file first, and uses a temporary one if not found.
const JWT_SECRET = process.env.JWT_SECRET || 'maayan_oshri_likes_boys_123';

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

 // Middleware function to verify the JWT token.
 // Added to any route that we want to protect from unauthorized access.
 
 function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // The token format is usually "Bearer eyJhbGciOi...". we do authHeader && here so if authHeader is undefined we won't get an error
    const token = authHeader && authHeader.split(' ')[1];

    // no token
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // verify the token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        // Save the decoded user info (like userId) so the next route can use it
        req.user = decoded; 
        next(); // Let the user pass to the requested route
    });
}

// ===========
// make routes
// ===========
// systemController.initializeSystem(); // Uncomment if you have an initialization method

// validate that the server is on 
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'active', message: 'Server is running' });
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

        // generate the jwt
        const token = jwt.sign(
            { userId: user.id }, // Payload
            JWT_SECRET,          // The Server's Stamp
            { expiresIn: '7d' }  // Token lifespan
        );

        res.status(200).json({ 
            message: 'Login successful', 
            userId: user.id,
            token: token // Sending the token to the mobile app
        });
        
    } catch (error) {
        console.error('[Login Route] Error:', error);
        res.status(500).json({ error: 'Failed to register user. Internal server error.' });
    }
});


// ===========
// PROTECTED ROUTES (Requires Token)
// ===========

/**
 * Route: GET /api/stocks
 * Description: Fetches market data using the MarketAPIClient and returns it to the client.
 * Accepts a 'symbol' query parameter to dynamically fetch data for a specific stock.
 */
app.get('/api/stocks', async (req, res) => {
    try {
        // Extract the symbol from the request query (e.g., ?symbol=NVDA), default to 'AAPL' (if lets say someone acsess this route from the browser. we dont want to crush so we'll use APPL as default)
        const symbol = (req.query.symbol || 'AAPL').toUpperCase();
        console.log(`[Stocks Route] Requesting lightweight chart data via MarketAPIClient for: ${symbol}`);
        
        // Direct call for raw daily data of the symbol (the asset)
        const rawDailyData = await marketApiClient.fetchDailyData(symbol, 15);

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
            aiConfidence: 0 // Set to 0 by default. The real AI confidence is fetched only when triggering the /api/analyze route.
        }];

        // Prepare the chart dataset (last 7 data points)
        const recentSlice = rawDailyData.slice(-7);
        const chartPayload = {
            labels: recentSlice.map(item => {
                const d = new Date(item.date);
                return `${d.getMonth() + 1}/${d.getDate()}`;
            }),
            datasets: [{ data: recentSlice.map(item => item.close) }]
        };

        // Respond to the client with the tailored lightweight data
        res.status(200).json({
            stocks: stocksPayload,
            chart: chartPayload
        });

    } catch (error) {
        console.error('[Stocks Route] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch lightweight stock data.' });
    }
});

/**
 * Route: GET //api/analyze/:symbol
 * Description: triggers a manual stock analysis for the specified symbol.
 */
app.get('/api/analyze/:symbol', authenticateToken, async (req, res) => {
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
 * Route: GET /api/users/:id/watchlist
 * Description: Fetches the personalized watchlist for a specific user.
 */
app.get('/api/users/:id/watchlist', authenticateToken, async (req, res) => {
    // Extract the user ID from the URL parameters and parse it as an integer
    const requestedUserId = parseInt(req.params.id);

    // We use the decoded token payload (req.user) provided by the authenticateToken middleware.
    // If the token's userId does not match the requested URL userId, the user is trying 
    // to access someone else's data. In that case, we block the request.
    if (req.user.userId !== requestedUserId) {
        return res.status(403).json({ error: 'Cannot view another user\'s watchlist.' });
    }

    try {
        // Ask Prisma to find the user by their ID
        const user = await prisma.user.findUnique({
            where: { id: requestedUserId },
            // The include command tells Prisma to fetch not just the user, 
            // but also all associated assets from the implicit watchlist junction table.
            include: { watchlist: true } 
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        // At this point, user.watchlist contains full Asset objects (price, volume, and so on).
        // The mobile app only expects an array of ticker strings (like 'AAPL').
        // The map function iterates over the objects and extracts just the 'ticker' field.
        const symbols = user.watchlist.map(asset => asset.ticker);
        res.status(200).json({ watchlist: symbols });

    } catch (error) {
        console.error('[Watchlist GET] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

/**
 * Route: POST /api/users/:id/watchlist
 * Description: Adds a new stock symbol to the user's watchlist.
 */
app.post('/api/users/:id/watchlist', authenticateToken, async (req, res) => {
    // Extract the user ID from the URL parameters
    const requestedUserId = parseInt(req.params.id);
    const { symbol } = req.body;
    
    //ensure the user can only add stocks to their own watchlist
    if (req.user.userId !== requestedUserId) {
        return res.status(403).json({ error: 'Cannot modify another user\'s watchlist.' });
    }

    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    try {
        // handle the asset table
        // Before connecting an asset to a user, it must exist in the database.
        // 'upsert' attempts to update the record. If it doesn't exist, it creates it.
        await prisma.asset.upsert({
            where: { ticker: symbol },
            update: {}, // If it already exists, do nothing (leave the current price as is)
            create: {
                // If it doesn't exist, create it with default zero values.
                // The automated Cron Job or the next manual analysis will update it with real data.
                ticker: symbol,
                companyName: symbol,
                currentPrice: 0.0,
                volume: 0
            }
        });

        // Create the many to many relationship
        // Now that the asset definitely exists, we can link it to the user.
        await prisma.user.update({
            where: { id: requestedUserId },
            data: {
                // Access the user's watchlist relation field
                watchlist: {
                    // Prisma's 'connect' command links the user and the asset.
                    // It creates a new row in the junction table without deleting existing items.
                    connect: { ticker: symbol }
                }
            }
        });

        res.status(200).json({ message: 'Stock added to watchlist successfully', symbol });

    } catch (error) {
        console.error('[Watchlist POST] Error:', error.message);
        res.status(500).json({ error: 'Failed to add stock to watchlist' });
    }
});

/**
 * Route: GET /api/users/:id/notifications
 * Description: Retrieves the chronological history of system alerts assigned to a specific user.
 *              Secured via JWT to ensure users can only access their own notification history.
 * 
 * @param {Request} req - Express request object containing the user ID in params.
 * @param {Response} res - Express response object.
 */
app.get('/api/users/:id/notifications', authenticateToken, async (req, res) => {
    const requestedUserId = parseInt(req.params.id);

    // Security Check: Ensure the authenticated user is requesting their own data
    if (req.user.userId !== requestedUserId) {
        return res.status(403).json({ error: 'Unauthorized: Cannot view another user\'s notifications.' });
    }

    try {
        // Query the database for the user's alerts.
        // Prisma's 'include' ensures we retrieve the actual alert message mapped to the UserAlert junction table.
        // 'orderBy' ensures the most recent alerts are rendered at the top of the mobile UI.
        const userAlerts = await prisma.userAlert.findMany({
            where: { userId: requestedUserId },
            include: { alert: true },
            orderBy: { sentAt: 'desc' }
        });

        res.status(200).json(userAlerts);
        
    } catch (error) {
        console.error('[Notifications GET] Database query failed:', error.message);
        res.status(500).json({ error: 'Failed to retrieve notification history.' });
    }
});

// ===============
// activate server
// ===============

app.listen(PORT, () => {
    console.log(`[Server] Node.js backend is running on http://localhost:${PORT}`);
    console.log(`[Server] Ready to accept a connection from the mobile app `);
});