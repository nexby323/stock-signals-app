"""
Training Script for the Intraday Neural Network (FNN).

This script is meant to be run ONCE (or whenever we want to retrain the model).
It downloads historical market data, calculates our indicators, 
teaches the Neural Network how to spot patterns, and saves the weights
and the scaling rules to files.
"""

import yfinance as yf
import numpy as np
import pandas as pd
from fnn_model import IntradayFeatureStructure, IntradayNN

def train_and_save_model():
    print("1. Downloading historical data for training...\n")
    # We download 60 days of history for SPY (S&P 500 ETF).
    # We use a 5-minute interval so the model learns short-term intraday movements.
    df = yf.download("SPY", period="60d", interval="5m")
    
    # Make sure all column names are lowercase (open, high, close, etc.) 
    # becuase thats how we acsess them in IntradayFeatureStructure .
    df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]

    print("2. Adding features (adding RSI, MACD, etc.)...\n")
    features = IntradayFeatureStructure()
    # Add the 7 new columns with our technical indicators
    df_clean = features.add_indicators(df)

    print("3. Preparing data for Neural Network...\n")
    # Create the empty Neural Network brain
    fnn = IntradayNN()

    # Extract only the 12 columns the model expects to see
    features = df_clean[['open', 'high', 'low', 'close', 'volume',
                         'sma_short', 'sma_long', 'rsi', 'macd', 'macd_signal',
                         'bb_upper', 'bb_lower']].values

    # We use fit_transform() here and only here. 
    # The scaler looks at 60 days of data, finds the highest and lowest numbers, 
    # and figures out the rules to shrink everything to a 0-to-1 scale.
    scaled_features = fnn.feature_scaler.fit_transform(features)

    # X will hold our datas (the 12 features at a specific minute)
    X = []
    # y will hold our classification (did the price go up or down in the next 5 minutes?)
    y = []
    
    # We grab the original close prices to check the real future price
    close_prices = df_clean['close'].values
    
    # We loop through all the rows except the very last one 
    # (because the last row doesn't have a "next" price to check against)
    for i in range(len(scaled_features) - 1):
        X.append(scaled_features[i])
        
        # If the price in the next step (i+1) is higher than the current step (i),
        # the answer is 1 (BULLISH/UP). Otherwise, the answer is 0 (BEARISH/DOWN).
        is_up = 1 if close_prices[i+1] > close_prices[i] else 0
        y.append(is_up)

    # Convert our lists to numpy arrays so the Neural Network can read them
    X = np.array(X)
    y = np.array(y)

    print(f"4. Training model on {len(X)} samples...")
    # epochs=15: Read the entire 60 days of data 15 times to get better at guessing.
    # validation_split=0.2: Hide 20% of the data during training, and use it as a 
    # "surprise test" at the end of each round to make sure it's not just memorizing.
    fnn.model.fit(X, y, epochs=15, batch_size=32, validation_split=0.2)

    print("5. Saving model weights and the scaler rules...")
    # Save the learned weights
    fnn.model.save_weights("ai_models/nn_weights.weights.h5")
    
    # Save the scaling rule
    fnn.save_scaler("ai_models/nn_scaler.save")
    
    print("Done! Weights and Scaler saved successfully.")

if __name__ == "__main__":
    train_and_save_model()