import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CircularRadar from './CircularRadar'
import { SimulationConfig, TargetPosition } from '../types'

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 16)
  return 1
})

global.cancelAnimationFrame = vi.fn()

describe('CircularRadar', () => {
  const mockConfig: SimulationConfig = {
    n_range_bins: 64,
    n_doppler_bins: 32,
    fs: 1e6,
    prf: 1000,
    fc: 10e9,
  }

  const createMockData = (): number[][] => {
    const data: number[][] = []
    for (let i = 0; i < mockConfig.n_range_bins; i++) {
      data[i] = []
      for (let j = 0; j < mockConfig.n_doppler_bins; j++) {
        data[i][j] = Math.random() * 0.5
      }
    }
    return data
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the radar canvas', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('displays max value information', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} />)

    expect(screen.getByText(/max value:/i)).toBeInTheDocument()
  })

  it('displays range and doppler bin information', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} />)

    expect(screen.getByText(/range bins:/i)).toBeInTheDocument()
    expect(screen.getByText(/64/i)).toBeInTheDocument()
    expect(screen.getByText(/32/i)).toBeInTheDocument()
  })

  it('displays legend with intensity levels', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} />)

    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('handles minimal data array', () => {
    const minimalData: number[][] = [[0.1, 0.2], [0.3, 0.4]]
    const minimalConfig: SimulationConfig = {
      ...mockConfig,
      n_range_bins: 2,
      n_doppler_bins: 2,
    }
    render(<CircularRadar data={minimalData} config={minimalConfig} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('handles data with all zeros', () => {
    const zeroData: number[][] = Array(mockConfig.n_range_bins)
      .fill(0)
      .map(() => Array(mockConfig.n_doppler_bins).fill(0))
    
    render(<CircularRadar data={zeroData} config={mockConfig} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders with targets prop', () => {
    const data = createMockData()
    const targets: TargetPosition[] = [
      {
        id: 1,
        range_m: 10000,
        azimuth_deg: 45,
        vel_m_s: 10,
        rcs: 0.5,
      },
      {
        id: 2,
        range_m: 20000,
        azimuth_deg: 90,
        vel_m_s: -5,
        rcs: 0.8,
      },
    ]

    render(<CircularRadar data={data} config={mockConfig} targets={targets} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('handles empty targets array', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} targets={[]} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('updates when data changes', () => {
    const data1 = createMockData()
    const { rerender } = render(<CircularRadar data={data1} config={mockConfig} />)

    const canvas1 = document.querySelector('canvas')
    expect(canvas1).toBeInTheDocument()

    const data2 = createMockData()
    rerender(<CircularRadar data={data2} config={mockConfig} />)

    const canvas2 = document.querySelector('canvas')
    expect(canvas2).toBeInTheDocument()
  })

  it('updates when config changes', () => {
    const data = createMockData()
    const { rerender } = render(<CircularRadar data={data} config={mockConfig} />)

    // Create new data matching the new config dimensions
    const newConfig: SimulationConfig = {
      ...mockConfig,
      n_range_bins: 128,
      n_doppler_bins: 64,
    }
    const newData: number[][] = []
    for (let i = 0; i < newConfig.n_range_bins; i++) {
      newData[i] = []
      for (let j = 0; j < newConfig.n_doppler_bins; j++) {
        newData[i][j] = Math.random() * 0.5
      }
    }

    rerender(<CircularRadar data={newData} config={newConfig} />)

    expect(screen.getByText(/128/i)).toBeInTheDocument()
    expect(screen.getByText(/64/i)).toBeInTheDocument()
  })

  it('has correct canvas dimensions', () => {
    const data = createMockData()
    render(<CircularRadar data={data} config={mockConfig} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toHaveAttribute('width', '500')
    expect(canvas).toHaveAttribute('height', '500')
  })
})

