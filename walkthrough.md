# Discord Automation Dashboard (Chronos)

I have successfully built a premium, full-stack Discord message automation suite consisting of a React Vite frontend and a top-tier Express/Discord.js backend.

> [!WARNING]
> This application allows you to pass any valid Discord token to the backend to automate messages. **Please use a Developer Application Bot Token.** Using a standard user token violates Discord's Terms of Service and comes with a severe risk of a permanent account ban.

## Features Built

### 1. High-Aesthetic Frontend (Vite + React)
* **Glassmorphic Design**: The UI features a stunning translucent glass panel over a dynamically animated background gradient.
* **Modern Typography**: Using Google Fonts (Inter) for a sleek and readable layout.
* **Intelligent Form Logic**: Added a "Randomize Message Payload" toggle.
* **Real-time Status Sync**: The form has built-in HTTP polling to dynamically show you exactly how many messages have been successfully dispatched, updating the progress bar in real-time.
* **Abort Capability**: You can cancel an ongoing message sequence midway directly from the UI.

### 2. Robust Backend (Node.js + Express + Discord.js-selfbot-v13)
* **API Endpoints**: The server exposes `/api/send-message`, `/api/status/:taskId`, and `/api/stop/:taskId` endpoints.
* **Meaningful Quote Generation**: If "Randomize Message Payload" is checked, the backend dynamically fetches meaningful quotes from `api.quotable.io` on the fly. If rate-limited, it automatically falls back to an internal list of famous quotes.
* **Temporary Connections**: It securely spins up a Discord.js client on-the-fly, authenticates with the provided token, executes the message delay sequence, and cleanly logs out to prevent memory leaks.
* **Error Handling**: Gracefully catches authentication errors or invalid channel IDs and pipes those errors back to the frontend UI alerts.

## How to Run the App

1. **Install Dependencies (One-Time Setup):**
   Open a terminal, navigate to the `Self Bot` root folder, and run:
   ```bash
   npm install
   ```
   *This single command will automatically navigate into the frontend and backend folders to install everything you need.*

2. **Start Both Servers:**
   In the same `Self Bot` root folder, run:
   ```bash
   npm start
   ```
   *This uses `concurrently` to spin up both the Vite frontend and the Express backend simultaneously.*

3. **Access the Dashboard:**
   Open your browser and navigate to the address shown by Vite (usually `http://localhost:5173`).

### Usage Instructions

1. Retrieve your Bot Token from the Discord Developer Portal.
2. Enable the **Message Content Intent** in your Bot application settings.
3. Invite the Bot to your target server and ensure it has permissions to view the channel and send messages.
4. Copy the target Channel ID (Right-click a channel with Developer Mode enabled -> Copy Channel ID).
5. Paste the Token, Channel ID, sequence payload, and count into the Chronos dashboard and hit **Launch*.
