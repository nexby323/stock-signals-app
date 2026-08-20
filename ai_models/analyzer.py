"""
Python AI Inference Server (Flask)

This server acts as the "Brain" microservice. It loads our trained models into memory 
once, and stays awake listening for incoming data from the main Node.js server and sends it 
to our models and returns the results back to Node.js.
this server returns pure mathematical predictions, leaving all business logic (like alerts) to Node.js.
"""

# Flask: takes our python script and turn it into a server that is able to get HTTP requests
# request: holds all the incoming information that just arrived at our server from the Node.js.
# jsonify: func that turns python dict to json format (so the Node.js will undarstand the answer\result)
from flask import Flask, request, jsonify
import pandas as pd
# helps us print detailed errors to the terminal if there is a crush
import traceback

from fnn_model import IntradayFeatureStructure, IntradayNN
from lstm_model import TrendLSTM

# init the Flask web server
app = Flask(__name__)

print("Starting Python AI Server...")

# Load the short-term FNN model into RAM
print("Loading Intraday FNN Model...")
features = IntradayFeatureStructure()
fnn_model = IntradayNN()

try:
    # try loading the weights and scalers for the fnn model
    fnn_model.model.load_weights("ai_models/fnn_weights.weights.h5")
    fnn_model.load_scaler("ai_models/fnn_scaler.save")
    print("[OK] FNN weights and scaler loaded successfully.")
except Exception as e:
    print(f"[ERROR] Could not load FNN files: {e}")

# Load the long-term LSTM model into RAM
print("Loading long-term LSTM Model...")
lstm_model = TrendLSTM()

try:
    # try loading the weights and scalers for the lstm model
    lstm_model.model.load_weights("ai_models/lstm_weights.weights.h5")
    lstm_model.load_scaler("ai_models/lstm_scaler.save")
    print("[OK] LSTM weights and scalers loaded successfully.")
except Exception as e:
    print(f"[ERROR] Could not load LSTM files: {e}")

print("Server is READY and listening on port 5000")


@app.route('/analyze', methods=['POST'])
def analyze_stock_data():
    """
    This is the main endpoint. Node.js sends a POST request to here with the raw stock data.
    We process it, run it through our AI models, and send back a JSON response.
    """
    try:
        # Get the JSON data sent by Node.js to a python dict
        stock_data = request.get_json()
        
        # Make sure Node.js actually sent something
        if not stock_data:
            return jsonify({"status": "error", "message": "No data provided"}), 400 # error 400 means the server (we) didnt undarstand the request from the Node.js because the syntax was wrong.

        # Extract the data arrays from the JSON
        # the second argument in the get method is the default outpot if in case the left argument wasnt provided
        symbol = stock_data.get('symbol', 'UNKNOWN')
        intraday_data = stock_data.get('intraday_for_nn', [])
        daily_data = stock_data.get('daily_for_lstm', [])
        
        # Prepare the empty template for the response we will send back.
        response = {
            "status": "success",
            "symbol": symbol,
            "fnn_result": None,
            "lstm_result": None
        }

        # Run the fnn model
        if len(intraday_data) > 0:
            # Convert JSON to a Pandas Table and ensure lowercase columns
            df_intraday = pd.DataFrame(intraday_data)
            df_intraday.columns = [col.lower() for col in df_intraday.columns]
            
            # Add technical indicators and scale the data
            df_clean = features.add_indicators(df_intraday)
            X_fnn, last_price_fnn = fnn_model.preprocess_data(df_clean)
            
            # Make the prediction and attach it to the response we send back to Node.js.
            fnn_pred = fnn_model.predict(X_fnn, last_price_fnn)
            response["fnn_result"] = fnn_pred

        # Run the lstm model
        if len(daily_data) > 0:
            #we do no need to converty json to pandas and columns to lower case because we do it inside the lstm model
            # Prepare the 60-day window and scale it
            #
            X_lstm, last_price_lstm = lstm_model.preprocess_data(daily_data)
            
            # Make the prediction and attach it to the payload
            lstm_pred = lstm_model.predict(X_lstm, last_price_lstm)
            response["lstm_result"] = lstm_pred

        # If both models received empty data, return an error
        if not response["fnn_result"] and not response["lstm_result"]:
             return jsonify({"status": "error", "message": "No valid data array provided"}), 400

        # Send the finalized mathematical predictions back to Node.js
        return jsonify(response), 200   # 200 means OK. the Node.js request was seccsesfuly recived, undarstood, and processed
        
    except Exception as e:
        # If anything crashes, print the error in the Python terminal and send a 500 error to Node.js which means internal server fault
        traceback.print_exc() 
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    # Start the server on localhost (127.0.0.1) port 5000
    # debug=True allows us to change the code while ther server is up and it whill refresh
    app.run(host='0.0.0.0', port=5000,debug= True)