import React, { useState } from 'react';
import Form from './components/Form';

function App() {
  const [notification, setNotification] = useState(null);

  const handleStatusUpdate = (type, message) => {
    setNotification({ type, message });

    // Auto-clear notification after 5 seconds if not an error or running state
    if (type !== 'error') {
      setTimeout(() => setNotification(null), 5000);
    }
  };

  return (
    <div style={{ padding: '2rem', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>

        <div className="text-center mb-8">
          <h1>Chronos</h1>
          <p>Advanced Discord Automation Interface</p>
        </div>

        {notification && (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            backgroundColor: notification.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${notification.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
            color: notification.type === 'error' ? '#fca5a5' : '#6ee7b7'
          }}>
            {notification.message}
          </div>
        )}

        <Form onStatusUpdate={handleStatusUpdate} />

      </div>
    </div>
  );
}

export default App;
