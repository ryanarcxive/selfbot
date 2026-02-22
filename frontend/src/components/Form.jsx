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

    const [status, setStatus] = useState('idle'); // idle, running, completed, error
    const [errorMsg, setErrorMsg] = useState('');
    const [sentCount, setSentCount] = useState(0);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const startTask = async (e) => {
        e.preventDefault();
        setStatus('running');
        setErrorMsg('');
        setSentCount(0);

        if (Number(formData.minDelayMs) >= Number(formData.maxDelayMs)) {
            setStatus('error');
            setErrorMsg('Max delay must be greater than Min delay.');
            return;
        }

        try {
            onStatusUpdate('info', 'Sequence initiated! Waiting for completion...');
            const response = await fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start sequence');
            }

            setSentCount(data.sent || 0);
            setStatus('completed');
            onStatusUpdate('success', `Sequence completed! Dispatched ${data.sent || 0} messages.`);

        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message);
            onStatusUpdate('error', err.message);
        }
    };

    const isRunning = status === 'running';

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
            {status === 'running' && (
                <div className="mb-6 flex-col" style={{ alignItems: 'center', color: 'var(--accent)' }}>
                    <RefreshCw className="mb-4" size={32} style={{ animation: 'spin 2s linear infinite' }} />
                    <p style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        Executing sequence...
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.5rem' }}>
                        Due to stateless architecture, please keep this window open while the sequence completes.
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
            <button type="submit" disabled={isRunning} style={{ opacity: isRunning ? 0.5 : 1, cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                <Send size={20} /> {isRunning ? 'Running...' : 'Launch Sequence'}
            </button>

            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </form>
    );
}
