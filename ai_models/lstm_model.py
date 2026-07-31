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
        self.target_scaler.fit(close_prices)
        #apply the normalization 
        scaled_data = self.scaler.fit_transform(features)
        
        #take just the windows of the recent sequence_length days 
        recent_window = scaled_data[-self.sequence_length:]
        #save the most recent actual close price to calculate the percentage change later
        last_actual_price = float(close_prices[-1][0])
        #TODO: need 3d array (batch_size,time_steps,features) currently we get one training sample so batch_size = 1
        #make this a ndarray
        X_prefict = np.array([recent_window])
        
        return X_prefict, last_actual_price
        
        
     
    def predict(self,processed_data: np.ndarray,last_actual_price:float) -> Dict[str,Union[float,int]]:
        """
        Executes model inference on preprocessed window data and converts the output to financial metrics.

        The function feeds the 3D tensor to the LSTM network, receives a normalized prediction value, 
        and performs an inverse transformation to retrieve the predicted price in USD. It calculates 
        the expected percentage change and determines the market trend direction.

        Args:
            processed_data (np.ndarray): A 3D NumPy array of scaled feature data with shape 
                                         (1, sequence_length, 5).
            last_actual_price (float): The actual closing price (in USD) of the most recent trading day.

        Returns:
            Dict[str, Union[float, str]]: A structured dictionary containing:
                - 'last_actual_price' (float): The current base price.
                - 'predicted_price' (float): The forecasted price for the next trading session.
                - 'expected_change_pct' (float): The projected percentage change.
                - 'trend_direction' (str): The overall trend direction ("BULLISH" or "BEARISH").
        """
        # get raw normalized prediction
        raw_prediction = self.model.predict(processed_data, verbose=0)
        #convert back to money (USD$) the prediction
        predicted_price = self.target_scaler.inverse_transform(raw_prediction)[0][0]
        
        price_diff = predicted_price - last_actual_price
        expected_change_pct = (price_diff / last_actual_price) * 100
        
        trend = "BULLISH" if expected_change_pct > 0 else "BEARISH"

        #the object that the node-js will get
        return {
            "last_actual_price": float(last_actual_price),
            "predicted_price": float(predicted_price),
            "expected_change_pct": float(expected_change_pct),
            "trend_direction": trend
        }