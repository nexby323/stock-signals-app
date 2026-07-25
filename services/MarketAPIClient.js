// https://www.npmjs.com/package/yahoo-finance2
const yahooFinance = require('yahoo-finance2').default;
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
    async fetchDailyData(symbol,daysAgo) {
        try {
            //for-now
            console.log(`[MarketAPIClient] Fetching market data for ${symbol}...`);
            
            const queryOptions = {
                period1: this._getPastDate(daysAgo), // from how many days ago to pull the data
                interval: '1d' // daily data 
            };

            const results = await yahooFinance.historical(symbol, queryOptions);
            //for-now
            

            //for-now
            console.log(`[MarketAPIClient] Successfully fetched data for ${symbol}`);
            //make the data on the "correct format"(pass every quote get the relevant data and put it in this order)
            return results.map(quote => ({
                date: quote.date,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            }));

        } 
        
        catch (error) {  
        console.error(`[MarketAPIClient] Failed to fetch daily data for ${symbol}:`, error.message);
            throw error; //throw again to give the "main" - SystemController to handle this
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
            
            // get chart 
            const queryOptions = {
                interval: interval,
                range: '1mo' // 1 month ago - pretty sure its enough 
            };

            const result = await yahooFinance.chart(symbol, queryOptions);
            console.log(`[MarketAPIClient] Successfully fetched intraday data for ${symbol}`);
            
            // pass on every quote from the quotes Objects array and put just this data and order them like this
            return result.quotes.map(quote => ({
                date: quote.date,
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            })).filter(quote => quote.open !== null); // filter empty rows 

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

