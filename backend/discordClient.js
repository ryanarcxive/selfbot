const { Client } = require('discord.js-selfbot-v13');

// Map to hold references to clients or intervals so we can stop them
const activeOperations = new Map();

/**
 * Helper to wait for a specific duration
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to generate random string
 */
function generateRandomText(length = 20) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result.trim() || 'random_message'; // fallback if only spaces
}

/**
 * Starts a sequence of messages
 */
async function startSendingMessages({ token, channelId, message, count, delayMs, taskId, randomize, onProgress, onComplete, onError }) {
    const client = new Client({ checkUpdate: false });
    let isStopped = false;

    activeOperations.set(taskId, {
        stop: () => {
            isStopped = true;
            client.destroy();
        }
    });

    try {
        console.log(`[Backend Debug] Attempting to login with token length: ${token ? token.length : 0}`);
        await client.login(token);
        console.log(`[Backend Debug] Login successful as ${client.user?.tag || 'User'}`);

        // In selfbot-v13, login resolves when the socket connects. 
        // We can just add a small safety sleep instead of waiting for a 'ready' event which sometimes gets swallowed by Discord for user accounts.
        console.log('[Backend Debug] Waiting a moment for client to populate cache...');
        await sleep(2000);
        console.log(`[Backend Debug] Client is READY as ${client.user?.tag}`);

        console.log(`[Backend Debug] Fetching channel ID: ${channelId}`);
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.log(`[Backend Debug] Channel fetch returned null or undefined`);
            throw new Error('Channel not found or bot lacks permissions.');
        }

        if (typeof channel.isText === 'function' && !channel.isText() || typeof channel.isTextBased === 'function' && !channel.isTextBased()) {
            console.log(`[Backend Debug] Channel is not a text channel`);
            throw new Error('Channel is not a text channel.');
        }
        console.log(`[Backend Debug] Channel fetched successfully. Starting message loop for count: ${count}, Randomize: ${randomize}`);

        for (let i = 0; i < count; i++) {
            if (isStopped) {
                console.log(`[Backend Debug] Task was manually stopped at message ${i}`);
                break;
            }

            const payloadToSend = randomize ? generateRandomText(Math.floor(Math.random() * 30) + 10) : message;
            console.log(`[Backend Debug] Sending message ${i + 1}/${count}: ${payloadToSend}`);
            await channel.send(payloadToSend);

            onProgress({ sent: i + 1, total: count });

            // Add delay unless it's the last message
            if (i < count - 1 && !isStopped) {
                console.log(`[Backend Debug] Waiting ${delayMs}ms...`);
                await sleep(delayMs);
            }
        }

        if (!isStopped) {
            console.log(`[Backend Debug] Operation complete`);
            onComplete();
        }
    } catch (error) {
        console.error(`[Backend Debug] ERROR CAUGHT:`, error);
        onError(error);
    } finally {
        isStopped = true;
        client.destroy();
        activeOperations.delete(taskId);
    }
}

/**
 * Stops an ongoing message sequence
 */
function stopSendingMessages(taskId) {
    const operation = activeOperations.get(taskId);
    if (operation) {
        operation.stop();
        activeOperations.delete(taskId);
        return true;
    }
    return false;
}

module.exports = {
    startSendingMessages,
    stopSendingMessages
};
