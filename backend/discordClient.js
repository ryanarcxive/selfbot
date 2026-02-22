const { Client } = require('discord.js-selfbot-v13');

// Map to hold references to clients or intervals so we can stop them
const activeOperations = new Map();

/**
 * Helper to wait for a specific duration
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fallbackQuotes = [
    "The journey of a thousand miles begins with one step.",
    "That which does not kill us makes us stronger.",
    "Life is what happens when you're busy making other plans.",
    "When the going gets tough, the tough get going.",
    "You must be the change you wish to see in the world.",
    "You only live once, but if you do it right, once is enough.",
    "The only impossible journey is the one you never begin."
];

/**
 * Fetch a meaningful random quote
 */
async function getRandomQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random');
        if (!response.ok) throw new Error('API failed');
        const data = await response.json();
        return `"${data.content}" — ${data.author}`;
    } catch (err) {
        // Fallback if the free API is rate-limited or down
        return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    }
}

/**
 * Starts a sequence of messages
 */
async function startSendingMessages({ token, channelId, message, count, minDelayMs, maxDelayMs, taskId, randomize, onProgress, onComplete, onError }) {
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

            const payloadToSend = randomize ? await getRandomQuote() : message;
            console.log(`[Backend Debug] Sending message ${i + 1}/${count}: ${payloadToSend}`);
            await channel.send(payloadToSend);

            onProgress({ sent: i + 1, total: count });

            // Add delay unless it's the last message
            if (i < count - 1 && !isStopped) {
                const randomDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1) + minDelayMs);
                console.log(`[Backend Debug] Waiting randomized delay of ${randomDelay}ms...`);
                await sleep(randomDelay);
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
