require('dotenv').config(); // for loading the .env file 
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

// make the adapter that connects to the postgres (from the .env file)
const adapter = new PrismaPg({ 
    connectionString: process.env.DIRECT_URL 
});

// pass the adapter to the Prisma 
const prisma = new PrismaClient({ adapter });

module.exports = prisma;