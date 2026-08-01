require('dotenv').config(); // for loading the .env file 
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// make the adapter that connects to the postgres (from the .env file)
// we pass here the DATABASE_URL and not the direct one because we want normal queries to go thorugh the pooling procees
const adapter = new PrismaPg({ 
    connectionString: process.env.DATABASE_URL 
});

// pass the adapter to the Prisma 
const prisma = new PrismaClient({ adapter });

module.exports = prisma;