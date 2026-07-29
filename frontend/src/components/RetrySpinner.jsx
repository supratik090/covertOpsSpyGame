import React from 'react';

export default function RetrySpinner({ attempt, max }) {
  return (
    <div className="retry-spinner-overlay">
      <div className="retry-spinner-ring">
        <div className="retry-spinner-dot" />
      </div>
      <div className="retry-spinner-text">
        RETRYING SIGNAL ({attempt}/{max})
      </div>
    </div>
  );
}
