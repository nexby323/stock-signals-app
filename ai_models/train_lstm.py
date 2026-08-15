"""
Training Script for the Long Short-Term Memory (LSTM) Model.

This script is meant to be run ONCE (or whenever we want to retrain the model).
It downloads historical market data, calculates our indicators, 
teaches the Neural Network how to spot patterns, and saves the weights
and the scaling rules to files.
"""

import yfinance as yf
import numpy as np
import pandas as pd
from lstm_model import TrendLSTM

def train_and_save_lstm():
    print("1. Downloading historical data for training...\n")
    # We download 5 years of history for SPY (S&P 500 ETF).
    # We use a 1 day interval so the model learns long-term movements.
    df = yf.download("SPY", period="5y", interval="1d")
    
    # Make sure all column names are lowercase (open, high, close, etc.) 
    # to match how we accsesed them in the TrendLSTM class
    df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]

    print("2. Preparing data and scaling...")
    lstm = TrendLSTM()

    # the lstm model uses 5 features: open, high, low, close, volume
    features = df[['open', 'high', 'low', 'close', 'volume']].values
    close_prices = df[['close']].values

    # Fit both scalers on the historical training data
    scaled_features = lstm.feature_scaler.fit_transform(features)
    lstm.target_scaler.fit(close_prices)

    X = []
    y = []
    sequence_length = 60

    for i in range(sequence_length, len(scaled_features)):
        # X gets a chunk of 60 days (all 5 columns)
        X.append(scaled_features[i-sequence_length:i])
        
        # y gets the single target 'close' price of the current day.
        # In our features array, 'close' is at index 3 (open=0, high=1, low=2, close=3)
        y.append(scaled_features[i, 3])

    X = np.array(X)
    y = np.array(y)

    print(f"3. Training LSTM model on {len(X)} sequences...")
    # epochs=20 to give the complex LSTM network time to find the deep trends
    lstm.model.fit(X, y, batch_size=32, epochs=20, validation_split=0.2)

    print("4. Saving LSTM model weights and scalers...")
    # Save the learned weights
    lstm.model.save_weights("ai_models/lstm_weights.weights.h5")
    
    # Save the scaling rule
    lstm.save_scaler("ai_models/lstm_scaler.save")
    
    print("Done! Weights and Scaler saved successfully.")
    
if __name__ == "__main__":
    train_and_save_lstm()