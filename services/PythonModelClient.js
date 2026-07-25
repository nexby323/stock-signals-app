/**
 * Class to get data then "translate" them to "inter-language" langauge
 * send to the ML written on python and wait for response, done on seprate thread
 * from the main 
 */
class PythonModelClient
{
    /**
     * send the data to the python model and return the result
     * @param {Array} stockData - array of stock data
     * @returns {Promise<Object>} - response from the model
     */
    static async analyzeData(stockData)
    {
        try {
            // send to the flask python server-this is the pipeline
            const pythonServerUrl = 'http://127.0.0.1:5000/analyze';

            // HTTP POST request 
            const response = await fetch(pythonServerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(stockData)
            });

            // check if the response successed 
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // make the response an object again (this returns a Promise because it done in an async way)
            const result = await response.json();
            return result;

        } catch (error) {
            console.error('[PythonModelClient] Failed to communicate with Python server:', error.message);
            throw error; 
        }       
    }
}
module.exports = PythonModelClient;