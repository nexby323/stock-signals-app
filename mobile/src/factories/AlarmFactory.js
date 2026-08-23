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
        if (isFnnBullish && !isLstmBullish && fnnConfidence >= CONFIDENCE_THRESHOLD) {
            return this._createPayload(
                symbol,
                "Short-Term Spike Detected ⚡",
                `Our long term model is bearish, but our short term model caught strong imm riate momentum for ${symbol} and it's confident is (${fnnConfidence.toFixed(1)}%). Good for a quick day-trade.`,
                "warning",
                "medium"
            );
        }

        // Scenario 4: Volatility Alert - High expected change but low confidence (scattered MC Dropout)
        if (Math.abs(lstmResult.expected_change_pct) > 3 && lstmConfidence < 40.0) {
            return this._createPayload(
                symbol,
                "Extreme Volatility 🌪️",
                `${symbol} is showing massive fluctuations, but model confidence is low (${lstmConfidence.toFixed(1)}%). Trade with extreme caution.`,
                "info",
                "low"
            );
        }

        // Scenario 5: "Buy the Dip" Opportunity - Long-term is up, short-term is pulling back
        if (isLstmBullish && !isFnnBullish && lstmConfidence >= CONFIDENCE_THRESHOLD) {
            return this._createPayload(
                symbol,
                "Buy the Dip Opportunity 📉",
                `The short-term momentum for ${symbol} is pulling back, but our long-term model recognizes a strong upward trend. Great chance to enter at a discount.`,
                "info",
                "medium"
            );
        }

        // Scenario 6: Overwhelming LongTerm Trend (LSTM Solo Carry)
        if (isLstmBullish && lstmConfidence >= CONFIDENCE_THRESHOLD && fnnConfidence < 60.0) {
            return this._createPayload(
                symbol,
                "Massive Long-Term Breakout 📈",
                `Our long-term model is ${lstmConfidence.toFixed(1)}% confident in an upward trend for ${symbol}. Short-term momentum is quiet, but macro signals are highly bullish.`,
                "primary",
                "medium"
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