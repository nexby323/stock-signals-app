// https://www.npmjs.com/package/yahoo-finance2
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
class MarketAPIClient
{
    //create a constructor - currently not need a field
    constructor(){
        
    }
    /**
     * get daily data on the stock specific symbol(for the long range for LSTM)
     * @param {string} symbol - stock's symbol
     * @param {int} daysAgo - information of the [currentDay-dayAgo,currentDay] days
     * @returns {Promise<{date: Date, open: number, high: number, low: number, close: number, volume: number}[]>} - data object from the API
     */
    async fetchDailyData(symbol, daysAgo) {
        try {
            console.log(`[MarketAPIClient] Fetching daily market data for ${symbol}...`);
            
            const queryOptions = {
                period1: this._getPastDate(daysAgo), // start date
                period2: new Date().toISOString().split('T')[0], //the final data (current date)
                interval: '1d' // daily info 
            };

            
            const result = await yahooFinance.chart(symbol, queryOptions);
            
            console.log(`[MarketAPIClient] Successfully fetched daily data for ${symbol}`);
            
            
            return result.quotes.map(quote => ({
                date: quote.date,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            })).filter(quote => quote.open !== null); // filter empty raw from the result 

        } catch (error) {  
            console.error(`[MarketAPIClient] Failed to fetch daily data for ${symbol}:`, error.message);
            throw error; 
        }
    }
    /**
     * get intraday information (for NN)
     * @param {string} symbol - stock's symbol
     * @param {string} interval - time between samples of the stock
     * @returns {Promise<{date: Date, open: number, high: number, low: number, close: number, volume: number}[]>}
     */
    async fetchIntradayData(symbol, interval = '5m') {
        try {
            console.log(`[MarketAPIClient] Fetching intraday data (${interval}) for ${symbol}...`);
            
            
            const queryOptions = {
                period1: this._getPastDate(30), //30 days ago 
                period2: new Date().toISOString().split('T')[0], //today 
                interval: interval
            };

            const result = await yahooFinance.chart(symbol, queryOptions);
            console.log(`[MarketAPIClient] Successfully fetched intraday data for ${symbol}`);
            
            return result.quotes.map(quote => ({
                date: quote.date,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            })).filter(quote => quote.open !== null); //filter empty rows 

        } catch (error) {
            console.error(`[MarketAPIClient] Failed to fetch intraday data for ${symbol}:`, error.message);
            throw error;
        }
    }
    /*https://moodle.telhai.ac.il/pluginfile.php/1929170/mod_resource/content/1/recitation_05.pdf
        can about promise and async
        in shortly promise is pending,fulfilled or rejected, pending means waiting for results
        fulfulled means sucess and rejected means failure  
        of course the program continues along side the async fucntion
    */ 
    
    /**
     * calculate history data 
     * @param {number} daysAgo - how many days ago from the current data
     * @returns {string} - data on YYYY-MM-DD format
     */
    _getPastDate(daysAgo) {
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        return date.toISOString().split('T')[0];
    }
}

//this is the Singleton pattern all the class users, with the same object
module.exports = new MarketAPIClient(); 
/*
singleton pattern from those reasons: 
The API have limitations about the number of calls per amount of time
without singleton it is more difficult to trace about the number of calls. 

Not really need to define the same compies with the same fields of this class 
for each object of this class 

Connection Pooling - this pattern create for us a "gate" and orginized requests queue 
*/

