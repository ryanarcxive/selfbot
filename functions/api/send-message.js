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

export async function onRequestPost({ request }) {
    try {
        const body = await request.json();
        const { token, channelId, message, randomize = false } = body;

        if (!token || !channelId || (!message && !randomize)) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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

        return new Response(JSON.stringify({ success: true, contentSent: payloadToSend }), {
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
