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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function onRequestPost({ request }) {
    try {
        const body = await request.json();
        const { token, channelId, message, count, minDelayMs = 2000, maxDelayMs = 5000, randomize = false } = body;

        if (!token || !channelId || (!message && !randomize) || count === undefined) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (Number(minDelayMs) >= Number(maxDelayMs)) {
            return new Response(JSON.stringify({ error: 'Max delay must be greater than Min delay' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let sentCount = 0;

        for (let i = 0; i < count; i++) {
            const payloadToSend = randomize ? await getRandomQuote() : message;

            const res = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': token, // Discord user tokens don't use 'Bot ', standard bot tokens do. Pass as-is.
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: payloadToSend
                })
            });

            if (!res.ok) {
                const errorData = await res.text();
                console.error(`Discord API Error:`, errorData);
                // If the first message fails, we throw an error back to the user immediately.
                if (i === 0) {
                    let friendlyError = res.statusText;
                    try {
                        const parsed = JSON.parse(errorData);
                        friendlyError = parsed.message || friendlyError;
                    } catch (e) { }

                    return new Response(JSON.stringify({ error: `Discord Auth/Channel Error: ${friendlyError}` }), {
                        status: res.status,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                break; // Stop processing the loop if Discord rejects further messages mid-way
            }

            sentCount++;

            if (i < count - 1) {
                const randomDelay = Math.floor(Math.random() * (Number(maxDelayMs) - Number(minDelayMs) + 1) + Number(minDelayMs));
                await sleep(randomDelay);
            }
        }

        return new Response(JSON.stringify({ success: true, sent: sentCount, total: count }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
