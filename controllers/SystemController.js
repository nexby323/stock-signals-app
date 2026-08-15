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
//not a singleton because it logicly OK to create multiple object 
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
        //TODO:
        //load the data from the database
        //for now just mock data
        const userWatchList = ['AAPL','MSTF','TSLA'];

        //maybe store this on the database
        const dailySummery = []; 
        //create a function to do a delay of ms miliseconds
        /*
        await keyword does not waiting on the normal way, actually they pass immediately, but await wait when 
        the object is a promise, we pass to the setTimeout the resolve function- when ms miliseconds are passed call resolve
        the await waits for the promise to finish, after the time pass the promise is fulfilled (call to resolve)

        */
        const delay = (ms) => new Promise(resolve=> setTimeout(resolve,ms));
        for(const symbol of userWatchList){
            try
            {
                //get the result of the model about the symbol
                result = await this.triggerManualAnalysis(symbol);
                //maybe store this on the user table or something 
                dailySummery.push(result);
                //not flood the yahoo server with requests
                await delay(2000); 

            }
            catch(error)
            {
                console.error(`[SystemController] Failed analysis for ${symbol}.`);
                //for the database indicate about error
                errorObject = [] 
                dailySummery.push(errorObject);
            }
            console.log(`[SystemController] Daily batch completed. Processed ${batchResults.length} stocks.`);


        }
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
     * Ensures referential integrity and dynamically generates system alerts 
     * based on the model's confidence thresholds using Prisma's nested writes.
     * 
     * UML: +processPrediction(result: Object): Promise<void>
     * 
     * @param {Object} result - The structured output generated by triggerManualAnalysis.
     */
    async processPrediction(result) {
        const { symbol, analysis, rawDailyData } = result;
        
        console.log(`[SystemController] Persisting prediction data for ${symbol}...`);

        // Extract the most recent market snapshot to update the Asset record
        const latestData = rawDailyData[rawDailyData.length - 1];

        try {
            // 1. Referential Integrity Enforcement (Asset Upsert)
            // The PredictionResult table requires a valid foreign key referencing the Asset table.
            // Using 'upsert' guarantees the Asset exists before inserting the prediction,
            // while simultaneously keeping the Asset's current market price up to date.
            await this.dataBase.Asset.upsert({
                where: { ticker: symbol },
                update: {
                    currentPrice: latestData.close,
                    volume: latestData.volume
                },
                create: {
                    ticker: symbol,
                    companyName: symbol, // Can be enhanced later to fetch full company names
                    currentPrice: latestData.close,
                    volume: latestData.volume
                }
            });

            // 2. Anomaly Detection Logic
            // Evaluate the model's confidence score to determine if a system alert should be triggered.
            // A threshold of 80.0% is currently defined as the benchmark for a high-probability event.
            const isAnomaly = analysis.confidence_level > 80.0;
            
            // 3. Transactional Database Insertion
            // Utilizing Prisma's 'Nested Writes' feature to atomically create the PredictionResult 
            // and its associated Alert (if applicable) in a single, atomic database transaction.
            const savedRecord = await this.dataBase.PredictionResult.create({
                data: {
                    ticker: symbol,
                    confidenceLevel: analysis.confidence_level || 0.0,
                    predictedDirection: analysis.trend_direction || "UNKNOWN",
                    riskFactor: 1, // Placeholder for future risk-assessment algorithmic output
                    
                    // Conditionally append the Alert creation query if an anomaly was flagged
                    ...(isAnomaly && {
                        alert: {
                            create: {
                                type: "TREND", // Maps to the defined Prisma AlertType Enum
                                message: `High confidence ${analysis.trend_direction} trend detected for ${symbol}!`
                            }
                        }
                    })
                }
            });

            console.log(`[SystemController] Successfully committed prediction to DB (Record ID: ${savedRecord.id})`);
            
            if (isAnomaly) {
                console.log(`[ALERT] High-confidence anomaly registered in the database for ${symbol}`);
            }

        } catch (dbError) {
            // Catching the error here prevents a database failure from crashing the entire Node process 
            // or disrupting the HTTP response payload back to the mobile client.
            console.error(`[SystemController] Database transaction failed for ${symbol}:`, dbError.message);
        }
    }
}


module.exports = SystemController;
