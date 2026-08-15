"""
Feature Engineering for Intraday Neural Network (FNN).

We are using LSTM for long-term time-series analysis, and traditional Feedforward 
Neural Networks (FNN) for short-term intraday trading 

This file does two things:
1. calculates several key technical indicators to help the model identify patterns
2. Builds the Neural Network to process these hints and guess the next trend (Up or Down).


SMA (Simple Moving Average): 
analysis tool that calculates the average price of a stock (usually the closing price) over a specific number of time periods
used to identify direction

RSI (Relative Strength Index):
A momentum indicator that tracks the pace and shifts of price moves.
It moves up and down on a scale from 0 to 100.
A stock is usually seen as overbought when the number climbs above 70, and oversold when it drops below 30.

MACD (Moving Average Convergence Divergence):
It compares a fast average (usually 12 period EMA) to a slow average (usually 26 period EMA). If the fast average suddenly 
crosses the slow one, it tells the model that a new trend is starting right now.
*EMA (exponantial moving average) gives more weight to the most recent prices*

Bollinger Bands:
A technical indicator defined by a set of trendlines plotted two standard deviations 
(positively and negatively) away from a simple moving average (SMA) of a security"s price
When the price hits the top band, it"s unusually high. When it hits the 
bottom band, it"s unusually low. It helps the model see how volatile 
the market is today.
"""

# used for fast math operations and handling missing data
import numpy as np 
# the main library for playing with data tables
import pandas as pd 
# for letting Python know what type of variables we are passing
from typing import List, Dict, Union, Tuple

# the main tool to build the neural network 
import tensorflow as tf 
# Sequential is a simple line of layers, one after another
from tensorflow.keras.models import Sequential 
# Dense is a standard connected layer, Dropout helps prevent memorization
from tensorflow.keras.layers import Dense, Dropout
# used to shrink our numbers so the model can digest them easily
from sklearn.preprocessing import MinMaxScaler
# used to save and load the scaler rules to a file
import joblib 

class IntradayFeatureStructure:
    def __init__(self) -> None:
        """
        Initializes the IntradayFeatureStructure with default periods for technical indicators.
        
        Args:
            None
            
        Returns:
            None
        """
        #the period for calculating the Relative Strength Index (default 14)
        self.rsi_period = 14
        #the window size for the short-term Simple Moving Average (default 9)
        self.sma_short = 9
        #the window size for the long-term Simple Moving Average (default 21)
        self.sma_long = 21
        #the period for calculating Bollinger Bands moving average and standard deviation (default 20)
        self.bb_period = 20

    def add_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates and appends technical indicators (SMA, RSI, MACD, Bollinger Bands) 
        to the raw market data DataFrame.

        Args:
            df (pd.DataFrame): A pandas DataFrame containing raw intraday market data. 
                               Must contain at least a "close" column. 

        Returns:
            pd.DataFrame: A cleaned pandas DataFrame containing the original data along 
                          with the new calculated technical indicator columns. 
                          Rows with NaN values (due to rolling windows) are dropped.
        """
        # Simple Moving Averages (SMA)
        # calculate the short term average
        df["sma_short"] = df["close"].rolling(window=self.sma_short).mean()
        # calculate the long term average
        df["sma_long"] = df["close"].rolling(window=self.sma_long).mean()

        # Relative Strength Index (RSI)
        # calculate the difference in price from the previous step
        delta = df["close"].diff()
        # separate the gains (positive differences) and calculate their rolling mean
        gain = (delta.where(delta > 0, 0)).rolling(window=self.rsi_period).mean()
        # separate the losses (negative differences) and calculate their rolling mean
        loss = (-delta.where(delta < 0, 0)).rolling(window=self.rsi_period).mean()
        
        # calculate the relative strength (RS), avoiding division by zero
        rs = gain / loss.replace(0, np.nan) 
        # apply the RSI formula to normalize the value between 0 and 100
        df["rsi"] = 100 - (100 / (1 + rs))
        # fill any edge case NaN values with a neutral/high value 
        df["rsi"] = df["rsi"].fillna(100) 

        # MACD (Moving Average Convergence Divergence)
        # calculate the 12-period Exponential Moving Average
        ema_12 = df["close"].ewm(span=12, adjust=False).mean()  # we use ewm because we want to give more weights to the current prices
        # calculate the 26-period Exponential Moving Average
        ema_26 = df["close"].ewm(span=26, adjust=False).mean()
        # the MACD line is the difference between the two EMAs
        df["macd"] = ema_12 - ema_26
        # the signal line is a 9-period EMA of the MACD line
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

        # Bollinger Bands (BB)
        # calculate the 20-period simple moving average for the middle band
        sma_20 = df["close"].rolling(window=self.bb_period).mean()
        # calculate the rolling standard deviation
        std_20 = df["close"].rolling(window=self.bb_period).std()
        # upper band is SMA + (2 * standard deviation)
        df["bb_upper"] = sma_20 + (std_20 * 2)
        # lower band is SMA - (2 * standard deviation)
        df["bb_lower"] = sma_20 - (std_20 * 2)

        # drop any rows that contain NaN values created by the rolling windows
        df_clean = df.dropna().reset_index(drop=True)
        
        # return the fully processed and cleaned dataframe
        return df_clean


class IntradayNN:
    def __init__(self) -> None:
        """
        Sets up the Neural Network for fast, short-term trend prediction (Up/Down).
        """
        # we shrink the input features (like price and RSI) to be between 0 and 1
        self.feature_scaler = MinMaxScaler(feature_range=(0, 1))
        # Note: We no longer need a target_scaler because our output is just a probability (0 to 1)
        
        # We have 12 pieces of info for each moment:
        # open, high, low, close, volume + SMA_short, SMA_long, RSI, MACD, MACD_Signal, BB_upper, BB_lower
        self.num_features = 12 
        
        # build the actual brain structure
        self.model = self._build_model()
        
    def _build_model(self) -> Sequential:
        """
        Creates the layers of the Neural Network for Classification (Up/Down).
        """
        model = Sequential()
        
        # First Layer
        # "relu" means a cell only fires a signal if its result is a positive number.
        model.add(Dense(units=64, activation="relu", input_shape=(self.num_features,)))
        
        # Regularization: Randomly turn off 20% of the cells during training.
        # This forces the model to actually learn the rules, not just memorize the data.
        model.add(Dropout(0.2))
        
        # Second Layer
        model.add(Dense(units=32, activation="relu"))
        model.add(Dropout(0.2))
        
        # Output Layer (The Final Answer):
        # "sigmoid" squashes the answer into a probability between 0 (Down) and 1 (Up).
        model.add(Dense(units=1, activation="sigmoid"))
        
        # Compile the brain: "adam" is the smart algorithm that updates the math weights,
        # "binary_crossentropy" is the specific math used to punish wrong Yes/No guesses.
        model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
        
        return model

    def preprocess_data(self, df: pd.DataFrame) -> Tuple[np.ndarray, float]:
        """
        Takes the table with all the indicators, shrinks the numbers, 
        and prepares the very last row for a live prediction.
        """
        # separate the columns we want to use as hints
        features = df[["open", "high", "low", "close", "volume", 
                       "SMA_short", "SMA_long", "RSI", "MACD", "MACD_Signal", 
                       "BB_upper", "BB_lower"]].values
        
        # shrink all the hints to a 0-1 scale
        # We use .transform() here, NOT .fit_transform().
        # We want to shrink the new data using the exact same min/max rules the model learned during training.
        # If we use fit_transform() here the model may get a brand new scale (if the high and low here are different from the one we got in training) 
        # which will lead to confusion.
        scaled_features = self.feature_scaler.transform(features)
        
        # grab the very last row (the current moment in the market) for prediction
        current_moment = scaled_features[-1]
        
        # the model expects a 2D shape (a matrics), so we wrap it in another array
        # shape changes from (12) to (1, 12)
        X_predict = np.array([current_moment])
        
        # save the actual current price to return it for reference
        close_prices = df[["close"]].values
        last_actual_price = float(close_prices[-1][0])
        
        return X_predict, last_actual_price

    def predict(self, processed_data: np.ndarray, last_actual_price: float, n_iterations: int = 50) -> Dict[str, Union[float, str]]:
        """
        Guesses the trend (Up/Down) and calculates how confident it is 
        by running the guess multiple times with different cells turned off (MC Dropout).
        
        How the Confidence Score works:
        1. Base Score: A 50% probability means the model is completely guessing. 
           If it predicts 90% UP (0.9), it is 0.4 away from the middle (0.5). 
           We multiply this distance by 2 to get a base confidence of 80%.
        2. Confusion Penalty (Standard Deviation): We look at all the 50 different guesses. 
           If the guesses are scattered all over the place, the model is "confused". 
           We calculate how scattered they are and subtract it from the base score.
        """
    
        # run the prediction many times to see if the model is sure or just guessing 
        stochastic_predictions = []
        for _ in range(n_iterations):
            # training=True keeps Dropout active to get a variety of guesses
            raw_pred = self.model(processed_data, training=True)
            stochastic_predictions.append(raw_pred.numpy()[0][0])
            
        stochastic_predictions = np.array(stochastic_predictions)
        
        # mean_prob_up is the average probability (0.0 to 1.0) of the stock going UP
        mean_prob_up = np.mean(stochastic_predictions)
        
        # If the probability is greater than 50% (0.5), the trend is UP
        is_up = mean_prob_up > 0.5
        trend = "BULLISH" if is_up else "BEARISH"

        # Calculate base confidence level (0% to 100%) based on how far the probability is from 0.5
        # for example, if prob is 0.9 (very likely UP), distance is 0.4 -> 80% confident.
        raw_confidence = abs(mean_prob_up - 0.5) * 2 * 100
        
        # Penalize the confidence if the model"s guesses were scattered (high standard deviation)
        std_pred = np.std(stochastic_predictions)
        adjusted_confidence = raw_confidence - (std_pred * 100)
        
        # Ensure the final confidence score stays within 0 and 100
        confidence_level = max(0.0, min(100.0, adjusted_confidence))

        return {
            "last_actual_price": float(last_actual_price),
            "trend_direction": trend,
            "probability_up": float(mean_prob_up),
            "confidence_level": float(confidence_level)
        }

    def save_scaler(self, file_path: str) -> None:
        """
        Saves the fitted scaler rules to a file so we can reuse the exact same scale later.
        """
        joblib.dump(self.feature_scaler, file_path)

    def load_scaler(self, file_path: str) -> None:
        """
        Loads the saved scaler rules from a file into our machine.
        """
        self.feature_scaler = joblib.load(file_path)

    