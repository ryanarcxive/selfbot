const { startSendingMessages } = require('./discordClient');

// Read args
const token = process.argv[2];
const channelId = process.argv[3];
const message = process.argv[4];

console.log('Testing with Token length:', token ? token.length : 0);

startSendingMessages({
    token,
    channelId,
    message,
    count: 1,
    delayMs: 1000,
    taskId: 'test1',
    onProgress: (p) => console.log('Progress:', p),
    onComplete: () => console.log('Complete!'),
    onError: (e) => console.log('Error:', e)
});
