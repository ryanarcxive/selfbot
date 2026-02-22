import React, { useState } from 'react';
import { Send, RefreshCw, AlertCircle, CheckCircle2, Dices } from 'lucide-react';

export default function Form({ onStatusUpdate }) {
    const [formData, setFormData] = useState({
        token: '',
        channelId: '',
        message: '',
        count: 10,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        randomize: false
    });

    const [status, setStatus] = useState('idle'); // idle, running, paused, completed, error
    const [errorMsg, setErrorMsg] = useState('');
    const [sentCount, setSentCount] = useState(0);

    const isPausedRef = React.useRef(false);
    const isAbortedRef = React.useRef(false);



    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const [sequenceId, setSequenceId] = useState(null);
    const pollIntervalRef = React.useRef(null);

    // Initial load: Check for ID in URL
    React.useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const idFromUrl = queryParams.get('id');

        if (idFromUrl) {
            setSequenceId(idFromUrl);
            setStatus('running'); // Assume running until first poll returns
            onStatusUpdate('info', 'Reconnecting to background sequence...');

            // Trigger immediate poll, then start interval
            pollStatus(idFromUrl);
            pollIntervalRef.current = setInterval(() => pollStatus(idFromUrl), 3000);
        }

        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, []);

    const startTask = async (e) => {
        if (e) e.preventDefault();

        setStatus('running');
        setErrorMsg('');
        setSentCount(0);
        setSequenceId(null);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        if (Number(formData.minDelayMs) >= Number(formData.maxDelayMs)) {
            setStatus('error');
            setErrorMsg('Max delay must be greater than Min delay.');
            return;
        }

        try {
            onStatusUpdate('info', 'Initiating background sequence...');

            const response = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: formData.token,
                    channelId: formData.channelId,
                    message: formData.message,
                    count: formData.count,
                    minDelayMs: formData.minDelayMs,
                    maxDelayMs: formData.maxDelayMs,
                    randomize: formData.randomize
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to start sequence');

            setSequenceId(data.sequenceId);
            onStatusUpdate('info', 'Sequence dispatched! ID: ' + data.sequenceId);

            // Start Polling
            pollIntervalRef.current = setInterval(() => pollStatus(data.sequenceId), 3000);

        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message);
            onStatusUpdate('error', err.message);
        }
    };

    const pollStatus = async (id) => {
        try {
            const res = await fetch(`/api/status?id=${id}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setSentCount(data.sentCount);
            setStatus(data.status); // running, paused, aborted, completed, error

            if (data.status === 'completed') {
                clearInterval(pollIntervalRef.current);
                onStatusUpdate('success', `Sequence completed! Dispatched ${data.sentCount} messages.`);
            } else if (data.status === 'error') {
                clearInterval(pollIntervalRef.current);
                setErrorMsg(data.errorData);
                onStatusUpdate('error', data.errorData);
            } else if (data.status === 'aborted') {
                clearInterval(pollIntervalRef.current);
                onStatusUpdate('info', 'Sequence aborted manually.');
            }

        } catch (err) {
            console.error("Polling error", err);
        }
    };

    const updateRemoteStatus = async (newStatus) => {
        if (!sequenceId) return;
        try {
            await fetch('/api/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: sequenceId, status: newStatus })
            });
            // Don't set react status here, let the next poll cycle grab the true source of truth
        } catch (e) { console.error("Failed to update status"); }
    }

    const handlePauseToggle = () => {
        const nextStatus = status === 'paused' ? 'running' : 'paused';
        updateRemoteStatus(nextStatus);
        onStatusUpdate('info', `Requesting sequence to ${nextStatus}...`);
    };

    const handleAbort = () => {
        updateRemoteStatus('aborted');
        onStatusUpdate('info', 'Requesting sequence abortion...');
    };

    const isRunning = status === 'running' || status === 'paused';
    const progressPercent = typeof formData.count === 'number' && formData.count > 0

        ? Math.round((sentCount / formData.count) * 100)
        : 0;

    return (
        <form className="mt-4 flex-col gap-4" onSubmit={startTask}>
            <div className="input-group">
                <label htmlFor="token">
                    Discord Token (Bot/User)
                    {!formData.token.startsWith('Bot ') && formData.token.length > 5 && (
                        <span style={{ color: 'var(--danger)', marginLeft: '8px', fontSize: '0.75rem' }}>
                            Warning: User tokens violate ToS
                        </span>
                    )}
                </label>
                <input
                    type="password"
                    id="token"
                    name="token"
                    placeholder="MTA... or Bot MTA..."
                    value={formData.token}
                    onChange={handleChange}
                    required
                    disabled={isRunning}
                />
            </div>

            <div className="input-group">
                <label htmlFor="channelId">Target Channel ID</label>
                <input
                    type="text"
                    id="channelId"
                    name="channelId"
                    placeholder="e.g. 123456789012345678"
                    value={formData.channelId}
                    onChange={handleChange}
                    required
                    disabled={isRunning}
                />
            </div>

            <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                    type="checkbox"
                    id="randomize"
                    name="randomize"
                    checked={formData.randomize}
                    onChange={handleChange}
                    disabled={isRunning}
                    style={{ width: 'auto', cursor: 'pointer' }}
                />
                <label htmlFor="randomize" style={{ marginBottom: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Dices size={16} /> Randomize Message Payload
                </label>
            </div>

            <div className="input-group" style={{ opacity: formData.randomize ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                <label htmlFor="message">Message Payload</label>
                <textarea
                    id="message"
                    name="message"
                    placeholder={formData.randomize ? "Random text will be generated automatically..." : "Type the message you want to blast..."}
                    value={formData.randomize ? "" : formData.message}
                    onChange={handleChange}
                    required={!formData.randomize}
                    disabled={isRunning || formData.randomize}
                />
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div className="input-group" style={{ flex: 1.5 }}>
                    <label htmlFor="count">Send Count</label>
                    <input
                        type="number"
                        id="count"
                        name="count"
                        min="1"
                        max="10000"
                        value={formData.count}
                        onChange={handleChange}
                        required
                        disabled={isRunning}
                    />
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                    <label htmlFor="minDelayMs">Min Delay (ms)</label>
                    <input
                        type="number"
                        id="minDelayMs"
                        name="minDelayMs"
                        min="500"
                        step="100"
                        value={formData.minDelayMs}
                        onChange={handleChange}
                        required
                        disabled={isRunning}
                    />
                </div>

                <div className="input-group" style={{ flex: 1 }}>
                    <label htmlFor="maxDelayMs">Max Delay (ms)</label>
                    <input
                        type="number"
                        id="maxDelayMs"
                        name="maxDelayMs"
                        min="500"
                        step="100"
                        value={formData.maxDelayMs}
                        onChange={handleChange}
                        required
                        disabled={isRunning}
                    />
                </div>
            </div>

            {/* Status Badges */}
            {isRunning && (
                <div className="mb-6 flex-col" style={{ alignItems: 'center', color: 'var(--accent)' }}>
                    <RefreshCw className="mb-4" size={32} style={{ animation: status === 'paused' ? 'none' : 'spin 2s linear infinite', opacity: status === 'paused' ? 0.5 : 1 }} />
                    <p style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {status === 'paused' ? 'Sequence Paused' : 'Executing background sequence...'}
                    </p>

                    {sequenceId && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                            ID: {sequenceId}
                        </p>
                    )}

                    {/* Progress Bar Container */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${progressPercent}%`,
                            background: 'var(--accent)',
                            transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>
                        {sentCount} / {formData.count} messages dispatched ({progressPercent}%)
                    </p>
                </div>
            )}

            {status === 'completed' && (
                <div className="mb-6 text-center" style={{ color: 'var(--success)' }}>
                    <CheckCircle2 size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--success)' }}>Successfully sent {sentCount} messages!</p>
                </div>
            )}

            {status === 'error' && (
                <div className="mb-6 text-center" style={{ color: 'var(--danger)' }}>
                    <AlertCircle size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--danger)' }}>{errorMsg}</p>
                </div>
            )}

            {/* Controls */}
            {!isRunning ? (
                <button type="submit">
                    <Send size={20} /> Launch Sequence
                </button>
            ) : (
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={handlePauseToggle}
                        style={{ flex: 1, backgroundColor: status === 'paused' ? 'var(--success)' : 'var(--bg-card)' }}
                    >
                        {status === 'paused' ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button
                        type="button"
                        onClick={handleAbort}
                        style={{ flex: 1, backgroundColor: 'var(--danger)', color: 'white' }}
                    >
                        ⏹ Abort Sequence
                    </button>
                </div>
            )}

            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </form>
    );
}
