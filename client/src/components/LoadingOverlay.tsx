import './LoadingOverlay.css';
import React from 'react';

interface Props {
  message: string;
}

const LoadingOverlay: React.FC<Props> = ({ message }) => {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay__spinner" />
      <div className="loading-overlay__message">{message}</div>
    </div>
  );
};

export default LoadingOverlay;

