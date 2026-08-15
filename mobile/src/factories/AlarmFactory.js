/**
 * AlarmFactory.js
 * 
 * This factory class consumes the inference results from both the LSTM and FNN models.
 * It applies business logic to combine short-term and long-term signals into actionable,
 * categorized alarms for the mobile user.
 */

class AlarmFactory {
    /**
     * Define the threshold for what we consider a "High Confidence" signal.
     */
    static CONFIDENCE_THRESHOLD = 75.0;

    /**
     * Generates a smart alarm based on the convergence or divergence of the models.
     * 
     * @param {string} symbol - The stock symbol (e.g., 'AAPL')
     * @param {Object} lstmResult - The parsed JSON result from the LSTM model
     * @param {Object} fnnResult - The parsed JSON result from the FNN model
     * @returns {Object|null} - An alarm object formatted for the mobile app, or null if no action is needed.
     */
    static generateAlarm(symbol, lstmResult, fnnResult) {
        const isLstmBullish = lstmResult.trend_direction === "BULLISH";
        const isFnnBullish = fnnResult.trend_direction === "BULLISH";
        
        const lstmConfidence = lstmResult.confidence_level;
        const fnnConfidence = fnnResult.confidence_level;

        // Scenario 1: The "Golden Cross" - Both models strongly agree on an UPWARD trend
        if (isLstmBullish && isFnnBullish && lstmConfidence >= this.CONFIDENCE_THRESHOLD && fnnConfidence >= this.CONFIDENCE_THRESHOLD) {
            return this._createPayload(
                symbol,
                "Strong Buy Signal 🚀",
                `Both Intraday and Long-term models predict an upward trend for ${symbol}. LSTM expects a ${lstmResult.expected_change_pct.toFixed(2)}% jump.`,
                "success",
                "high"
            );
        }

        // Scenario 2: The "Market Crash" Warning - Both models strongly agree on a DOWNWARD trend
        if (!isLstmBullish && !isFnnBullish && lstmConfidence >= this.CONFIDENCE_THRESHOLD && fnnConfidence >= this.CONFIDENCE_THRESHOLD) {
            return this._createPayload(
                symbol,
                "Critical Drop Warning ⚠️",
                `Massive bearish convergence on ${symbol}. Expected long-term drop: ${lstmResult.expected_change_pct.toFixed(2)}%. Consider protecting assets.`,
                "danger",
                "critical"
            );
        }

        // Scenario 3: Intraday Scalping Opportunity - Long-term is flat/down, but short-term momentum is spiking
        if (isFnnBullish && !isLstmBullish && fnnConfidence > 85.0) {
            return this._createPayload(
                symbol,
                "Short-Term Spike Detected ⚡",
                `LSTM is bearish, but our FNN caught strong immediate momentum for ${symbol}. Good for a quick day-trade.`,
                "warning",
                "medium"
            );
        }

        // Scenario 4: Volatility Alert - High expected change but low confidence (scattered MC Dropout)
        if (Math.abs(lstmResult.expected_change_pct) > 5.0 && lstmConfidence < 40.0) {
            return this._createPayload(
                symbol,
                "Extreme Volatility 🌪️",
                `${symbol} is showing massive fluctuations, but model confidence is low (${lstmConfidence.toFixed(1)}%). Trade with extreme caution.`,
                "info",
                "low"
            );
        }

        // If no strict conditions are met, we don't spam the user.
        return null; 
    }

    /**
     * Helper method to standardize the alarm object format.
     */
    static _createPayload(symbol, title, body, themeColor, priority) {
        return {
            symbol,
            title,
            body,
            themeColor, // Can be used by the app's ThemeManager for high-contrast UI rendering
            priority,
            timestamp: new Date().toISOString()
        };
    }
}

export default AlarmFactory;