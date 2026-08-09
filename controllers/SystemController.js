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
     * trigger the stock analysis manualy 
     * UML: +triggerManualAnalysis(symbol: String): void
     * @param {string} symbol - stock symbol  
     * @returns {Promise<Object>} - the model result with flags  
     */
    async triggerManualAnalysis(symbol)
    {
        try{
        console.log(`[SystemController] Triggering manual analysis for ${symbol}`);
        //get the data for LSTM - half a year resolution , daily data
        const dailyData = await this.dataFetcher.fetchDailyData(symbol, 180);
        //get the data for NN - month ago on 5 minutes intervals
        const intraDailyData = await this.dataFetcher.fetchIntradayData(symbol,'5m');
        //send this object to the python server
        const combinedStockData = {
            symbol:symbol, 
            daily_for_lstm:dailyData,
            intraday_for_nn: intraDailyData
        };

        console.log(`[SystemController] Sending data to Python AI...`);
        const aiAnalysis= await this.processor.analyzeData(combinedStockData);

        const result = {
                success: true,
                symbol: symbol,
                analysis: aiAnalysis,
                rawDailyData: dailyData
        };

        //store the result in the data base
        await this.processPrediction(result); 

        //return the object 
        return result;
    }
    catch(error)
    {
        console.error(`[SystemController] Error in manual analysis for ${symbol}:`, error.message);
        //the caller need to handle the error
        throw error;
    }
    }
    /**
     * 
     * UML: +processPrediction(result: PredictionResult): void
     * @param {Object} result 
     */
    async processPrediction(result) {
        const { symbol, analysis } = result;
        
        console.log(`[SystemController] Processing prediction for ${symbol}...`);

        // the notification logic
        let isAnomaly = false;
        //just for now 
        //TODO: 
        //make all the AlertFactroy
        if (analysis && analysis.anomaly_detected && analysis.confidence_score > 0.8) {
            console.log(`[ALERT] High confidence anomaly for ${symbol}! Score: ${analysis.confidence_score}`);
            isAnomaly = true;
            //push to the users (or obeservers)
        } else {
            console.log(`[SystemController] Routine prediction for ${symbol}. No alerts.`);
        }

        // 2. temporary
        try {
            
            // temp
            const savedRecord = await this.dataBase.prediction.create({
                data: {
                    symbol: symbol,
                    confidenceScore: analysis.confidence_score || 0,
                    isAnomaly: isAnomaly,
                    rawAnalysis: JSON.stringify(analysis) 
                }
            });
            console.log(`[SystemController] Successfully saved prediction to DB with ID: ${savedRecord.id}`);
        } catch (dbError) {
            console.error(`[SystemController]  Failed to save prediction to DB for ${symbol}:`, dbError.message);
            //not throw an error inorder to not stop the other stocks process 
        }
    }
}


module.exports = SystemController;
