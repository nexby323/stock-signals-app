
from flask import Flask, request, jsonify  


app = Flask(__name__)

#loads just one time to the RAM and then the "pipeline"-server is open
print("Python AI Server starting... Models loaded into memory.")

@app.route('/analyze', methods=['POST'])
def analyze_stock_data():
    try:
        #get the json from the request- nodejs send there the data
        stock_data = request.get_json()
        
        if not stock_data:
            return jsonify({"status": "error", "message": "No data provided"}), 400

        #TODO: really write an answer from the model
        # here is the "inference" models are need to be
        record_count = len(stock_data)
        
        response = {
            "status": "success",
            "message": "Data analyzed successfully via HTTP",
            "records_processed": record_count,
            "anomaly_detected": True if record_count > 0 else False,
            "confidence_score": 0.92
        }
        
        # return the response to the node js 
        return jsonify(response), 200
        
    except Exception as e:
        # handle errors 
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # make the server run on the local computer port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)