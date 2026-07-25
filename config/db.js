const { PrismaClient } = require('../generated/prisma');

/*
    prisma connects automatically on the first
    query.

    This is still the singleton pattern: because Node caches modules
    this file only runs once no matter how many other files require it
    so every part of the app shares this same PrismaClient instance
    we chose to use singelton here because of the same reasoning as in MarketAPIClints.
*/
const prisma = new PrismaClient();

// exporting the client instance directly (not a function like before since theres no separate connect step to trigger anymore)
module.exports = prisma;