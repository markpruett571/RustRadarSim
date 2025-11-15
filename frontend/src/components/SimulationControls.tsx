interface DetectionControlsProps {
  onStartDetection: () => void
  tracking: boolean
  connected: boolean
}

function DetectionControls({ onStartDetection, tracking, connected }: DetectionControlsProps) {
  return (
    <div className="detection-controls">
      <h2>Drone Detection System</h2>
      <p className="detection-description">
        Active radar system for detecting and tracking drones in real-time.
      </p>
      <button 
        onClick={onStartDetection} 
        disabled={!connected || tracking}
        className="start-detection-button"
      >
        {tracking ? 'Detection Active' : 'Start Detection'}
      </button>
      {tracking && (
        <p className="detection-status">✓ Monitoring airspace for drones...</p>
      )}
    </div>
  )
}

export default DetectionControls

