import { useState, FormEvent, ChangeEvent } from 'react'
import { SimulationParams } from '../types'

interface SimulationControlsProps {
  params: SimulationParams
  onParamChange: (params: SimulationParams) => void
  onRunSimulation: () => void
  loading: boolean
}

function SimulationControls({ params, onParamChange, onRunSimulation, loading }: SimulationControlsProps) {
  const [localParams, setLocalParams] = useState<SimulationParams>(params)

  const handleChange = (key: keyof SimulationParams, value: string) => {
    const newParams = { ...localParams, [key]: parseFloat(value) || 0 }
    setLocalParams(newParams)
    onParamChange(newParams)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onRunSimulation()
  }

  return (
    <div className="simulation-controls">
      <h2>Simulation Parameters</h2>
      <form onSubmit={handleSubmit}>
        <div className="control-group">
          <label>
            Carrier Frequency (Hz):
            <input
              type="number"
              value={localParams.fc}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('fc', e.target.value)}
              step="1e6"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Sampling Rate (Hz):
            <input
              type="number"
              value={localParams.fs}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('fs', e.target.value)}
              step="1e5"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            PRF (Pulses per second):
            <input
              type="number"
              value={localParams.prf}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('prf', e.target.value)}
              step="10"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Number of Pulses:
            <input
              type="number"
              value={localParams.num_pulses}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('num_pulses', e.target.value)}
              step="1"
              min="1"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Pulse Width (seconds):
            <input
              type="number"
              value={localParams.pulse_width}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('pulse_width', e.target.value)}
              step="1e-6"
            />
          </label>
        </div>

        <div className="control-group">
          <label>
            Noise Sigma:
            <input
              type="number"
              value={localParams.noise_sigma}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('noise_sigma', e.target.value)}
              step="0.01"
              min="0"
            />
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      </form>
    </div>
  )
}

export default SimulationControls

