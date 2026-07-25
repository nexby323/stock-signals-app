const mongoose = require('mongoose');

/**
 * async fucntion to connect to the database
 */
const connectDB = async () => {
    try {
        /* 
            connect to local database 
            (127.0.0.1 is the loopback ip address (address of your computer) on port 27017) 
            called stocks-signals
        */
        /*TODO:
            add URI to the cloud mongoDB server
        */
        const mongoURI = process.env.MONGO_URI ;
        
        if (!mongoURI) {
            console.error('[Database] ERROR: MONGO_URI is undefined! Check your .env file and dotenv setup.');
            process.exit(1);
        }
        const conn = await mongoose.connect(mongoURI);
        console.log(`[Database] MongoDB Connected successfully to host: ${conn.connection.host}`);
        
    } catch (error) {
        console.error(`[Database] Connection failed: ${error.message}`);
        //can stop the program if the database is not available 
        process.exit(1); 
    }
};

module.exports = connectDB;