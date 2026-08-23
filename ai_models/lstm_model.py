#used to work with very fast array processing on a vectorize form of the models
import numpy as np 
#for processing JSON to dataframe and filtering the required data
import pandas as pd 
#the main libraray for ML methods and models 
import tensorflow as tf 
#https://www.tensorflow.org/api_docs/python/tf/keras/Sequential
#Sequential groups a linear stack of layers into a Model, each layer have input of tensor and ouput a tensor 
#for clarification tensor is the generalization for scaler, vector and matrix (can be 3d or more)
from tensorflow.keras.models import Sequential 
"""
https://www.tensorflow.org/api_docs/python/tf/keras/layers/LSTM
https://medium.com/analytics-vidhya/lstms-explained-a-complete-technically-accurate-conceptual-guide-with-keras-2a650327e8f2
LSTM: 
to explain LSTM an explanation about RNN (Recurrent Neural Network) is required (LSTM is a specific type of RNN)
RNN: 
https://medium.com/@poudelsushmita878/recurrent-neural-network-rnn-architecture-explained-1d69560541ef
The main problem with FNN (traditional feedforwad neural networks) is the lack of consideration about the order
of the samples given, FNN takes inputs and process each sample independently through hidden layers. 
From this reason FNN are not the best choice for task like time series analysis- follow stock market data. 
With RNN we overcome this problem by introducing a recurrent connection that allow information to flow from one time-step to the next. 
The architecture of RNN: 
https://miro.medium.com/v2/resize:fit:1100/format:webp/1*dznTsiaHCvRc70fxWWEcgw.png ,this pictures make it clear: 
the symbols are:  
xₜ - input at time t
aₜ - hidden layers computation at time t
W - the connection between the previous layer on time t-1 to t 
ŷₜ - output at time t 
U - connection between input layer to the first hidden layer (part of theta)
V - connection between last hidden layer to output (part of theta)
f - the activation function 
b - the bias to the hidden layers (part of theta)
the following relations hold: 
aₜ = f(aₜ₋₁, xₜ; θ) (a_t is depenedent on the previous layer and the input layer (with the weights θ)) 
aₜ = f(U * Xₜ + W* aₜ₋₁ + b) (an implicit way to write the above formula)
ŷₜ = f(V * aₜ + c) (the output at time t is the depened on the hidden layers with and V plus the bais on the last layer c)
The main problem with this normal RNN is vanishing gradient decsent.  
When we update the weights (θ) we need to find the influence of the t=1 layer and so on the the current t=n layer
like the normal Backpropagation algorithm we use the chain rule of derivatives d(h_n)/d(h_1) = d(h_h)/d(h_(n-1))*d(h_(n-1))/(d(h_(n-2)))... and so on
usually the derivatives of the of the activation functions is a number [0,1] , when the model is large we get exponential divergence, 
so on the arrivel for advance on time layers the update rule is almost zero, hence the name "vanishing gradient decsent".
The way LSTM solves this and the architecture of it: 
open this picture for good understanding https://miro.medium.com/v2/resize:fit:1100/format:webp/1*ahafyNt0Ph_J6Ed9_2hvdg.png
this is a cell of LSTM model.
hidden state:for shortage memory - the output for the current layer
cell state: the memory for long term time, information can flow on this easly without diffrent (solution for vanishing gradient decsent).
The chenges in the cell state are depend on 3 gates (each is a sigmoid that output 0 - block everything 1- pass everything)

Forget gate- the first gate decides which data from the previous output is relevant 
the equetion: https://miro.medium.com/v2/resize:fit:640/format:webp/1*t4Ikhm1C6x1usnPL-SaA7A.png
at the end the result [0,1] scalar is multiplied by the cell state from timestamp of t-1 (if the information is important save it all if not block this).

Input gate - decides which of the new information is for the longterm memory (cell state) the first part is which of the value will be update (by sigmoid)
the second part is make a vector of [-1,1] that can be added to the memory (tanh).

Output gate - make the output to the current cell, and form an output hidden state that can be used to either make a prediction or be fed back into the LSTM cell for the next time-step.
(TODO: put equetion for those steps) 
"regular densely-connected NN layer"
https://www.tensorflow.org/api_docs/python/tf/keras/layers/Dense
used for regularization randomly drops parts from the output of a layer
https://www.tensorflow.org/api_docs/python/tf/keras/layers/Dropout
"""
from tensorflow.keras.layers import LSTM, Dense, Dropout
#https://scikit-learn.org/stable/modules/generated/sklearn.preprocessing.MinMaxScaler.html
#used for preprocessing the data to fit within a specific range (Normalize the data)
from sklearn.preprocessing import MinMaxScaler

#for type hinting about methods 
from typing import List, Dict, Tuple, Union
# used to save and load the scaler rules to a file
import joblib

class TrendLSTM:
    def __init__(self, sequence_length=60) -> None:
        """
        Initializes the TrendLSTM model with sequence length, feature scalers, and model architecture.

        Args:
            sequence_length (int, optional): The number of historical trading days in each input window. 
                                             Defaults to 60.

        Returns:
            None
        """
        #the window size that the network get everytime (default 60)
        self.sequence_length = sequence_length
        #make the input within the [0,1] range
        self.feature_scaler = MinMaxScaler(feature_range=(0, 1))
        #same thing as above just for the output 
        self.target_scaler = MinMaxScaler(feature_range=(0,1))
        #the number of features on each sample-day : Open, High, Low, Close, Volume (OHLCV essentail data points to summerize trading activity over a period)
        self.num_features = 5
        #the model itself
        self.model = self._build_model()
        
    def _build_model(self) -> Sequential: 
        """
        Builds and compiles the LSTM neural network architecture.

        Returns:
            Sequential: A compiled Keras Sequential model ready for training or inference.
        """
        #the model itself 
        model = Sequential()
        
        #first layer - create 50 units that each one read the data day after day
        # return_sequences=True make this for each day output the results 
        #this means the next layer will get "file" with #days documents each documents with #units conclusion
        #the shape is of the input layer (#days, #feature_for_each_day =5) for each one of the #units for this layer
        model.add(LSTM(units = 50, return_sequences=True,input_shape=(self.sequence_length,self.num_features)))   
        #regularization - drops out 20% (randomly) of the connection from the above layer - help to prevent overfitting
        model.add(Dropout(0.2))
        
        #second layer - now this layer output a vector with #units for all the days (not each day) 
        model.add(LSTM(units=50,return_sequences=False))
        #the same thing as done above 
        model.add(Dropout(0.2))
        
        #third layer - we want to pass down strong signal so ReLU is chosen, make from 50 numbers a 25, classical NN and not LSTM
        model.add(Dense(units=25, activation='relu'))
        
        #output layer - from the #units of the previous get one output to the model and return the prediction   
        model.add(Dense(units=1, activation='linear'))
        
        #the loss function for this model is MSE and the learning algorithm is 'adam' (advance extension for the standard gradient descent)
        model.compile(optimizer='adam',loss='mean_squared_error')
        return model
    
    def preprocess_data(self,daily_data:List[Dict[str, Union[float,int]]])-> Tuple[np.ndarray,float]:
        """
        Converts raw market data from the API (a list of dictionaries) into a pandas DataFrame.
        
        The function scales all features to a range of (0, 1) and isolates the target feature (close price) 
        for inverse transformation. It extracts the most recent time window matching the required sequence length.

        Args:
            daily_data (List[Dict[str, Union[float, int]]]): List of dictionaries containing daily market data.
                                                             Each dictionary must contain the keys: 'open', 'high', 
                                                             'low', 'close', and 'volume'.

        Returns:
            Tuple[np.ndarray, float]: A tuple containing:
                - np.ndarray: A 3D array of normalized features with shape (1, sequence_length, 5) 
                              ready for direct model input.
                - float: The actual close price of the most recent day in the sequence.

        Raises:
            ValueError: If the number of items in `daily_data` is less than `sequence_length`.
        """
            
        #convert from JSON to dataframe 
        df = pd.DataFrame(daily_data)
        #choose the relevant data only 
        features = df[['open','high','low','close','volume']].values
        
        #validate that we have enough data
        if len(features) < self.sequence_length:
            raise ValueError(f"[lstm_model] Not enough data. Expected at least {self.sequence_length} days, got {len(features)}.")
        
        # fit the target scaler specifically on the 'close' prices (need this)
        close_prices = df[['close']].values
        #apply the normalization 
        # We use .transform() here, NOT .fit_transform().
        # We want to shrink the new data using the exact same min/max rules the model learned during training.
        # If we use fit_transform() here the model may get a brand new scale (if the high and low here are different from the one we got in training) 
        # which will lead to confusion.
        scaled_data = self.feature_scaler.transform(features)
        
        #take just the windows of the recent sequence_length days 
        recent_window = scaled_data[-self.sequence_length:]
        #save the most recent actual close price to calculate the percentage change later
        last_actual_price = float(close_prices[-1][0])
        #TODO: need 3d array (batch_size,time_steps,features) currently we get one training sample so batch_size = 1
        #make this a ndarray
        X_prefict = np.array([recent_window])
        
        return X_prefict, last_actual_price
        
        
     
    def predict(self, processed_data: np.ndarray, last_actual_price: float, n_iterations: int = 50) -> Dict[str, Union[float, str]]:
        """
        Executes model inference on preprocessed window data and converts the output to financial metrics.

        The function feeds the 3D tensor to the LSTM network, receives a normalized prediction value, 
        and performs an inverse transformation to retrieve the predicted price in USD. It calculates 
        the expected percentage change and determines the market trend direction.

        Integrated Monte Carlo (MC) Dropout to calculate a confidence percentage. 
        https://medium.com/@ciaranbench/monte-carlo-dropout-a-practical-guide-4b4dc18014b5
        MC dropout explanetion (by Yarin Gal Israel on the map!): 
        During the inferece time of the model ignores from the Dropout layers and do not throw any data (as explaind above, this is during the training time).
        With this techniqe we pass the same input n_iterations but the dropout layer are turned on, so we recive as a result n_iterations similar predictions.
        So we get ditribution of the prediction, on this distribution we can calculate the mean and std, and then infering: if the model has
        low std, this means that this is not really make a diffrence which neuron we deactivate and the model predicts high confidence on the conncetions. 
        And the opposite is also true (high std means low confidence). 
        This directly supports the 'confidenceLevel' field required by the Prisma 'PredictionResult' model.

        Args:
            processed_data (np.ndarray): A 3D NumPy array of scaled feature data with shape 
                                         (1, sequence_length, 5).
            last_actual_price (float): The actual closing price (in USD) of the most recent trading day.
            n_iterations (int, optional): Number of stochastic forward passes for MC Dropout. Defaults to 50.

        Returns:
            Dict[str, Union[float, str]]: A structured dictionary containing:
                - 'last_actual_price' (float): The current base price.
                - 'predicted_price' (float): The forecasted price for the next trading session.
                - 'expected_change_pct' (float): The projected percentage change.
                - 'trend_direction' (str): The overall trend direction ("BULLISH" or "BEARISH"). 
                                           Maps to 'predictedDirection' in the DB.
                - 'confidence_level' (float): The model's certainty percentage (0.0 to 100.0). 
                                              Maps to 'confidenceLevel' in the DB.
        """
        
        # --- MC Dropout for Confidence Calculation ---
        # Instead of getting one raw prediction (self.model.predict), we run the model N times 
        # with training=True. This keeps the Dropout layers active during inference, creating 
        # a distribution of slightly different predictions.
        stochastic_predictions = []
        for _ in range(n_iterations):
            # get raw normalized prediction (with dropout enabled)
            raw_pred = self.model(processed_data, training=True)
            stochastic_predictions.append(raw_pred.numpy()[0][0])
            
        stochastic_predictions = np.array(stochastic_predictions)
        
        # Calculate the mean (average prediction) and standard deviation (variance/uncertainty)
        mean_scaled_pred = np.mean(stochastic_predictions)
        std_scaled_pred = np.std(stochastic_predictions)

        # convert back to money (USD$) the prediction (using the mean of our stochastic runs)
        mean_pred_2d = np.array([[mean_scaled_pred]])
        predicted_price = self.target_scaler.inverse_transform(mean_pred_2d)[0][0]
        
        price_diff = predicted_price - last_actual_price
        expected_change_pct = (price_diff / last_actual_price) * 100
        
        trend = "BULLISH" if expected_change_pct > 0 else "BEARISH"

        # --- Calculate the Confidence Level (%) ---
        # Instead of utilizing the Coefficient of Variation (CV) which penalizes 
        # predictions whose means are close to zero, we rely directly on the 
        # standard deviation (variance) of the scaled stochastic predictions.
        # Given normalized data [0, 1], a standard deviation of 0.25 represents maximum uncertainty.
        
        if mean_scaled_pred == 0:
            confidence_level = 0.0
        else:
            # Calculate the uncertainty penalty based on raw standard deviation.
            # Scaling factor: 0.12 represents near-total uncertainty in a bounded [0,1] space.
            max_expected_variance = 0.12
            penalty = (std_scaled_pred / max_expected_variance) * 100.0 
            
            raw_confidence = 100.0 - penalty
            
            # Ensure the final confidence score remains strictly bounded between 0% and 100%
            confidence_level = max(0.0, min(100.0, raw_confidence))

        # Construct and return the strictly formatted response payload for Node.js
        return {
            "last_actual_price": float(last_actual_price),
            "predicted_price": float(predicted_price),
            "expected_change_pct": float(expected_change_pct),
            "trend_direction": trend,
            "confidence_level": float(confidence_level)
        }

    def save_scaler(self, file_path: str) -> None:
        """
        Saves both the feature and target scaler rules for the LSTM model.
        """
        joblib.dump({
            'feature_scaler': self.feature_scaler,
            'target_scaler': self.target_scaler
        }, file_path)

    def load_scaler(self, file_path: str) -> None:
        """
        Loads both saved scaler rules.
        """
        scalers = joblib.load(file_path)
        self.feature_scaler = scalers['feature_scaler']
        self.target_scaler = scalers['target_scaler']