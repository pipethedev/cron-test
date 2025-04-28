/**
 * runner.js - A configurable cron job runner
 * 
 * This script sets up a cron job that runs at specified intervals
 * and executes a custom task (currently just logging a message).
 * 
 * To use:
 * 1. Install node-cron: npm install node-cron
 * 2. Run: node runner.js
 */
require('dotenv').config();

const cron = require('node-cron');


const config = {
    intervalMinutes: parseInt(process.env.CRON_INTERVAL_MINUTES || '5', 10),
    message: 'Cron job executed successfully!'
};

/**
 * Converts minutes to a cron expression
 * @param {number} minutes - Minutes between executions
 * @returns {string} - Valid cron expression
 */
function minutesToCronExpression(minutes) {
    if (minutes < 60) {
        // For intervals less than an hour, run every X minutes
        return `*/${minutes} * * * *`;
    } else {
        // For longer intervals, this would need more complex logic
        throw new Error('Intervals longer than 59 minutes not supported');
    }
}

// The task to run on schedule
function runTask() {
    const now = new Date();
    console.log(`[${now.toISOString()}] ${config.message}`);
}

try {
    const cronExpression = minutesToCronExpression(config.intervalMinutes);
    console.log(`Setting up cron job to run every ${config.intervalMinutes} minute(s)`);
    console.log(`Cron expression: ${cronExpression}`);

    cron.schedule(cronExpression, runTask);

    console.log('Cron job scheduled successfully!');
    runTask();
} catch (error) {
    console.error('Error setting up cron job:', error.message);
}