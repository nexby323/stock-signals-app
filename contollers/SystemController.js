const MarketAPIClient = require('../service/MarketAPIClient');
const { pool } = require('../config/db');

class SystemController
{
    constructor()
    {
        this.dataFetcher = new MarketAPIClient();

    }
    /**
     * 
     */
    startDailyAnalysis()
    {

    }
    /**
     * 
     */
    initializeSystem()
    {

    }
    /**
     * 
     * @param {string} symbol 
     */
    triggerManualAnalysis(symbol)
    {

    }
    /**
     * 
     * @param {PredictionResult} result 
     */
    processPrediction(result) 
    {

    }
}
