const MarketAPIClient = require('../services/MarketAPIClient');
const db = require('../config/db');
const PythonModelClient = require('../services/PythonModelClient');
//bouble space+enter make a newline on the javadoc
/**
 * class to manage and schedule all the:   
 * getting data from the external API  
 * process the data on fixed time in the day  
 * save the result on database
 */
//not a singleton because it is logicly OK to create multiple objects
// for example when testing if we want: 
//const testController = new SystemController(mockDb, mockPython, mockApi); for mock data we can do this 
class SystemController
{
    
    constructor()
    {
        if (!db) {
            throw new Error('[SystemController] Critical Error: Database (db) is undefined in constructor');
        }
        if (!PythonModelClient) {
            throw new Error('[SystemController] Critical Error: PythonModelClient is undefined');
        }
        if (!MarketAPIClient) {
            throw new Error('[SystemController] Critical Error: MarketAPIClient is undefined');
        }
        this.processor = PythonModelClient;      // -processor: MLContext
        this.dataFetcher = MarketAPIClient;      // -dataFetcher: MarketAPIClient
        this.dataBase = db;                      // -dataBase: DatabaseManager
    }
    
    
    /**
     * this method is activated once per day  
     * checks the user's watchlist stock and get the result  
     * store the results on the database  
     * UML: +startDailyAnalysis():void 
     */
    async startDailyAnalysis()
    {

        console.log('[SystemController] Starting daily analysis batch...');

        let userWatchList = [];

        try {
            // fetch all unique stocks currently tracked in our database (the asset table).
            // Using 'select' ensures we only pull the 'ticker' column, saving memory and bandwidth.
            const assets = await this.dataBase.Asset.findMany({
                select: { ticker: true }
            });
            
            // Transform Prisma's array of objects into a simple flat array of strings (for example ['AAPL', 'NVDA'])
            userWatchList = assets.map(asset => asset.ticker);
            
            // if the database is empty abort analasis to not waist resources
            if (userWatchList.length === 0) {
                console.log('[SystemController] Database is empty. No stocks to analyze tonight.');
                return;
            }
            
            console.log(`[SystemController] Found ${userWatchList.length} stocks in DB to analyze.`);
            
        } catch (dbError) {
            console.error('[SystemController] Failed to fetch stocks from DB:', dbError.message);
            return;
        }

        const dailySummery = []; 

        // Helper function to create a delay. 
        // This prevents rate limiting (getting temporarily blocked) by the external Yahoo Finance API.
        const delay = (ms) => new Promise(resolve=> setTimeout(resolve,ms));

        for(const symbol of userWatchList){
            try
            {
                //get the result of the model about the symbol
                // Yahoo API -> Python ML Microservice -> DB Save
                const result = await this.triggerManualAnalysis(symbol);
                dailySummery.push(result);
                //not flood the yahoo server with requests (respect the API rate limits)
                await delay(2000); 

            }
            catch(error)
            {
                console.error(`[SystemController] Failed analysis for ${symbol}.`);
                //for the database indicate about error
                const errorObject = { symbol: symbol, error: true }
                dailySummery.push(errorObject);
            }
        }

        console.log(`[SystemController] Daily batch completed. Processed ${batchResults.length} stocks.`);
    }
    /**
     * initialize system when the server activates  
     * validate that all the components are proper(Sanity Checks)  
     * init timers(Cron Jobs)  
     * UML: +initializeSystem():void
     * @returns {Boolean} - all the components work properly
     */
    initializeSystem()
    {
        try{ 
        console.log('[SystemController] Initializing system...');
        //TODO: 
        //validate the components (python server, database)
        console.log('[SystemController] System initialized successfully.');
        return true;
        }
        catch(error)
        {
            console.log('[SystemController] Initialization failed:',error.message);
            return false; 
        }
    }
    
    
    /**
     * Triggers a manual stock analysis pipeline for a given symbol.
     * This method acts as an orchestrator: it fetches raw market data, delegates 
     * the computational inference to the ML microservice, and triggers database persistence.
     * 
     * UML: +triggerManualAnalysis(symbol: String): Promise<Object>
     * 
     * @param {string} symbol - The stock ticker symbol (e.g., 'AAPL').
     * @returns {Promise<Object>} - An object containing the success flag, analysis results, and raw data.
     * @throws {Error} If data fetching or the AI processing pipeline fails.
     */
    async triggerManualAnalysis(symbol)
    {
        try {
            console.log(`[SystemController] Triggering manual analysis pipeline for ${symbol}`);
            
            // 1. Data Acquisition Phase via Yahoo Finance API
            // Fetching 180 days of daily data to satisfy the LSTM's long-term sequence requirements
            const dailyData = await this.dataFetcher.fetchDailyData(symbol, 180);
            
            // Fetching 30 days of 5-minute interval data to capture short-term momentum for the FNN
            const intraDailyData = await this.dataFetcher.fetchIntradayData(symbol, '5m');

            // Construct the payload required by the Python inference engine
            const combinedStockData = {
                symbol: symbol, 
                daily_for_lstm: dailyData,
                intraday_for_nn: intraDailyData
            };

            console.log(`[SystemController] Delegating computational inference to Python Microservice...`);
            
            // 2. Machine Learning Inference Phase
            const aiAnalysis = await this.processor.analyzeData(combinedStockData);

            const result = {
                success: true,
                symbol: symbol,
                analysis: aiAnalysis,
                rawDailyData: dailyData // Passed back to the client/server layer for chart rendering
            };

            // 3. Persistence Phase
            // Asynchronously process and store the prediction results
            await this.processPrediction(result); 

            return result;
            
        } catch(error) {
            console.error(`[SystemController] Critical error in analysis pipeline for ${symbol}:`, error.message);
            // Propagate the error upwards so the HTTP router can respond with a 500 status code
            throw error;
        }
    }

    /**
     * Persists the AI prediction results into the PostgreSQL database.
     * Evaluates model confidence to determine if a system anomaly alert should be dispatched.
     * If an anomaly is detected, it links the generated alert to all users tracking the specific asset.
     * 
     * @param {Object} result - The structured output generated by triggerManualAnalysis.
     * @returns {Promise<void>}
     */
    async processPrediction(result) {
        const { symbol, analysis, rawDailyData } = result;
        
        console.log(`[SystemController] Persisting prediction data for ${symbol}...`);

        // Extract the most recent market snapshot to update the Asset record
        const latestData = rawDailyData[rawDailyData.length - 1];

        try {
            // 1. Referential Integrity Enforcement (Asset Upsert)
            await this.dataBase.Asset.upsert({
                where: { ticker: symbol },
                update: {
                    currentPrice: latestData.close,
                    volume: latestData.volume
                },
                create: {
                    ticker: symbol,
                    companyName: symbol, 
                    currentPrice: latestData.close,
                    volume: latestData.volume
                }
            });

            // 2. Anomaly Detection Logic
            // A threshold of 80.0% is currently defined as the benchmark for a high-probability event.
            const isAnomaly = analysis.confidence_level > 80.0;
            
            // 3. User Resolution for Alerts
            // Query the database to identify all users who have this specific asset in their watchlist.
            const usersWatching = await this.dataBase.user.findMany({
                where: { watchlist: { some: { ticker: symbol } } },
                select: { id: true }
            });
            
            // Map the retrieved user IDs into the expected Prisma format for nested insertions
            const userAlertsData = usersWatching.map(user => ({ userId: user.id }));

            // 4. Transactional Database Insertion
            // Utilizing Prisma's 'Nested Writes' feature to atomically create the PredictionResult 
            // and simultaneously cascade the creation of associated Alerts and UserAlerts.
            const savedRecord = await this.dataBase.PredictionResult.create({
                data: {
                    ticker: symbol,
                    confidenceLevel: analysis.confidence_level || 0.0,
                    predictedDirection: analysis.trend_direction || "UNKNOWN",
                    riskFactor: 1, // Algorithmic placeholder for future risk-assessment expansion
                    
                    // Conditionally execute the nested write only if the anomaly threshold was breached
                    ...(isAnomaly && {
                        alert: {
                            create: {
                                type: "TREND",
                                message: `High confidence ${analysis.trend_direction} trend detected for ${symbol}!`,
                                recipients: {
                                    create: userAlertsData // Populates the UserAlert junction table
                                }
                            }
                        }
                    })
                }
            });

            console.log(`[SystemController] Successfully committed prediction to DB (Record ID: ${savedRecord.id})`);
            
            if (isAnomaly) {
                console.log(`[ALERT] High-confidence anomaly broadcasted to ${usersWatching.length} subscribed users.`);
            }

        } catch (dbError) {
            console.error(`[SystemController] Database transaction failed for ${symbol}:`, dbError.message);
        }
    }
}


module.exports = SystemController;
