require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startSendingMessages, stopSendingMessages } = require('./discordClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory store for active tasks (in a real app, use a DB/Redis)
const activeTasks = new Map();

app.post('/api/send-message', async (req, res) => {
  const { token, channelId, message, count, delayMs = 2000, randomize = false } = req.body;

  if (!token || !channelId || (!message && !randomize) || count === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const taskId = Date.now().toString();

  try {
    // We launch the process asynchronously
    const taskPromise = startSendingMessages({
      token,
      channelId,
      message,
      count,
      delayMs,
      taskId,
      randomize,
      onProgress: (progress) => {
        // You could use Server-Sent Events (SSE) or WebSockets to stream progress
        // Here we just update the in-memory map
        activeTasks.set(taskId, { status: 'running', ...progress });
      },
      onComplete: () => {
        activeTasks.set(taskId, { status: 'completed' });
      },
      onError: (err) => {
        activeTasks.set(taskId, { status: 'error', error: err.message });
      }
    });

    activeTasks.set(taskId, { status: 'started', total: count, sent: 0 });

    res.json({ success: true, taskId, message: 'Message sequence started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status/:taskId', (req, res) => {
  const task = activeTasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

app.post('/api/stop/:taskId', (req, res) => {
  const { taskId } = req.params;
  const success = stopSendingMessages(taskId);
  if (success) {
    activeTasks.set(taskId, { status: 'stopped' });
    res.json({ success: true, message: 'Task stopped' });
  } else {
    res.status(404).json({ error: 'Task not found or already stopped' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
