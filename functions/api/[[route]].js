const fallbackQuotes = [
    "The journey of a thousand miles begins with one step.",
    "That which does not kill us makes us stronger.",
    "Life is what happens when you're busy making other plans.",
    "When the going gets tough, the tough get going.",
    "You must be the change you wish to see in the world.",
    "You only live once, but if you do it right, once is enough.",
    "The only impossible journey is the one you never begin."
];

async function getRandomQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random');
        if (!response.ok) throw new Error('API failed');
        const data = await response.json();
        return `"${data.content}" — ${data.author}`;
    } catch (err) {
        return fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    }
}

// Generate a random ID
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Endpoint: /api/start
    if (request.method === 'POST' && url.pathname === '/api/start') {
        try {
            const body = await request.json();
            const { token, channelId, message, count, minDelayMs = 2000, maxDelayMs = 5000, randomize = false } = body;

            if (!token || !channelId || (!message && !randomize) || !count) {
                return new Response(JSON.stringify({ error: 'Missing required configuration fields' }), { status: 400 });
            }

            const sequenceId = uuidv4();
            const initialState = {
                id: sequenceId,
                token,
                channelId,
                message,
                count: Number(count),
                minDelayMs: Number(minDelayMs),
                maxDelayMs: Number(maxDelayMs),
                randomize: Boolean(randomize),
                sentCount: 0,
                status: 'running',
                errorData: null
            };

            // Store initial state in KV
            await env.CHRONOS_KV.put(sequenceId, JSON.stringify(initialState));

            // Offload the heavy work to context.waitUntil() so the request can resolve immediately
            context.waitUntil(processSequence(sequenceId, env));

            return new Response(JSON.stringify({ success: true, sequenceId }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    // Endpoint: /api/status?id=xxxxx
    if (request.method === 'GET' && url.pathname === '/api/status') {
        const id = url.searchParams.get('id');
        if (!id) return new Response(JSON.stringify({ error: 'Missing Sequence ID' }), { status: 400 });

        const data = await env.CHRONOS_KV.get(id);
        if (!data) return new Response(JSON.stringify({ error: 'Sequence not found' }), { status: 404 });

        return new Response(data, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Endpoint: /api/update-status
    if (request.method === 'POST' && url.pathname === '/api/update-status') {
        try {
            const body = await request.json();
            const { id, status } = body;

            if (!id || !['paused', 'running', 'aborted'].includes(status)) {
                return new Response(JSON.stringify({ error: 'Invalid ID or status payload' }), { status: 400 });
            }

            const existingData = await env.CHRONOS_KV.get(id);
            if (!existingData) return new Response(JSON.stringify({ error: 'Sequence not found' }), { status: 404 });

            const parsedData = JSON.parse(existingData);

            // Do not override if already completed or aborted
            if (parsedData.status === 'completed' || parsedData.status === 'aborted') {
                return new Response(JSON.stringify({ error: `Cannot change status of a ${parsedData.status} sequence.` }), { status: 400 });
            }

            parsedData.status = status;
            await env.CHRONOS_KV.put(id, JSON.stringify(parsedData));

            return new Response(JSON.stringify({ success: true, newlyUpdatedStatus: status }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
        }
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}


// Heavy lifting background loop detached from the HTTP Response Cycle
async function processSequence(sequenceId, env) {
    let rawState = await env.CHRONOS_KV.get(sequenceId);
    if (!rawState) return;

    let state = JSON.parse(rawState);

    // Outer orchestration loop
    while (state.sentCount < state.count && state.status !== 'aborted') {
        // Fetch fresh state every loop just in case user paused/aborted via API
        rawState = await env.CHRONOS_KV.get(sequenceId);
        state = JSON.parse(rawState);

        if (state.status === 'aborted') break;

        // If Paused, just sleep heavily and re-poll the KV store
        if (state.status === 'paused') {
            await sleep(2000);
            continue;
        }

        // FIRE MESSAGE
        try {
            const payloadToSend = state.randomize ? await getRandomQuote() : state.message;

            const res = await fetch(`https://discord.com/api/v9/channels/${state.channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': state.token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: payloadToSend })
            });

            if (!res.ok) {
                const errorData = await res.text();
                let friendlyError = res.statusText;
                try {
                    const parsed = JSON.parse(errorData);
                    friendlyError = parsed.message || friendlyError;
                } catch (e) { }

                // Unrecoverable Discord Error. Mark sequence as errored and break loop.
                state.status = 'error';
                state.errorData = `Discord Error: ${friendlyError}`;
                await env.CHRONOS_KV.put(sequenceId, JSON.stringify(state));
                break;
            }

            // Success Updates!
            state.sentCount += 1;

            // Check if final message
            if (state.sentCount >= state.count) {
                state.status = 'completed';
            }

            // Push increment to KV
            await env.CHRONOS_KV.put(sequenceId, JSON.stringify(state));

        } catch (discordErr) {
            state.status = 'error';
            state.errorData = `Internal Fetch Error: ${discordErr.message}`;
            await env.CHRONOS_KV.put(sequenceId, JSON.stringify(state));
            break;
        }

        // Sleep before the next iteration
        if (state.status === 'running') {
            const randomDelay = Math.floor(Math.random() * (state.maxDelayMs - state.minDelayMs + 1) + state.minDelayMs);

            // Sleep in 1-second chunks so we can intercept abort signals faster
            let slept = 0;
            while (slept < randomDelay) {
                const midSleepStateCheck = await env.CHRONOS_KV.get(sequenceId);
                if (midSleepStateCheck) {
                    const parsedCheck = JSON.parse(midSleepStateCheck);
                    if (parsedCheck.status === 'aborted') break;
                }
                await sleep(1000);
                slept += 1000;
            }
        }
    }
}
