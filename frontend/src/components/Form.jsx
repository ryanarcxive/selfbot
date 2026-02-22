import React, { useState } from 'react';
import { Send, StopCircle, RefreshCw, AlertCircle, CheckCircle2, Dices } from 'lucide-react';

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
    const [taskId, setTaskId] = useState(null);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

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
        setProgress(0);
        setTotal(formData.count);

        if (Number(formData.minDelayMs) >= Number(formData.maxDelayMs)) {
            setStatus('error');
            setErrorMsg('Max delay must be greater than Min delay.');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start sequence');
            }

            setTaskId(data.taskId);
            pollStatus(data.taskId);
            onStatusUpdate('success', 'Sequence initiated successfully!');

        } catch (err) {
            setStatus('error');
            setErrorMsg(err.message);
            onStatusUpdate('error', err.message);
        }
    };

    const stopTask = async () => {
        if (!taskId) return;

        try {
            await fetch(`http://localhost:3000/api/stop/${taskId}`, { method: 'POST' });
            setStatus('idle');
            onStatusUpdate('info', 'Sequence stopped gracefully.');
        } catch (err) {
            console.error('Failed to stop task:', err);
        }
    };

    const pollStatus = async (id) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/status/${id}`);
                // If task is not found, it might have been deleted or never existed on restart
                if (!response.ok) {
                    clearInterval(interval);
                    setStatus('idle');
                    return;
                }

                const data = await response.json();

                if (data.status === 'running') {
                    setProgress(data.sent || 0);
                    setTotal(data.total || formData.count);
                } else if (data.status === 'completed') {
                    setProgress(data.total || formData.count);
                    setStatus('completed');
                    onStatusUpdate('success', 'All messages delivered successfully!');
                    clearInterval(interval);
                } else if (data.status === 'error') {
                    setStatus('error');
                    setErrorMsg(data.error);
                    onStatusUpdate('error', `Sequence failed: ${data.error}`);
                    clearInterval(interval);
                } else if (data.status === 'stopped') {
                    setStatus('idle');
                    clearInterval(interval);
                }
            } catch (err) {
                // Soft fail polling
                console.warn('Polling error:', err);
            }
        }, 1000);
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
                        Sending: {progress} / {total}
                    </p>
                    <div style={{ width: '100%', height: '8px', background: 'var(--input-bg)', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', width: `${(progress / total) * 100}%`, transition: 'width 0.3s ease' }}></div>
                    </div>
                </div>
            )}

            {status === 'completed' && (
                <div className="mb-6 text-center" style={{ color: 'var(--success)' }}>
                    <CheckCircle2 size={48} style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: 'var(--success)' }}>Sequence Completed!</p>
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
                <button type="button" className="btn-danger" onClick={stopTask}>
                    <StopCircle size={20} /> Abort Sequence
                </button>
            )}

            <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </form>
    );
}
