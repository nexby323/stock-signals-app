const mongoose = require('mongoose');

/**
 * async fucntion to connect to the database
 */
const connectDB = async () => {
    try {
        //the URI (connection string) to the database
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