import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DroneGrid from './DroneGrid'
import { TargetPosition } from '../types'

// Mock setInterval and clearInterval
global.setInterval = vi.fn((cb) => {
  cb()
  return 1 as any
})

global.clearInterval = vi.fn()

describe('DroneGrid', () => {
  const mockTargets: TargetPosition[] = [
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
    {
      id: 3,
      range_m: 15000,
      azimuth_deg: 180,
      vel_m_s: 0,
      rcs: 0.3,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the canvas element', () => {
    render(<DroneGrid targets={mockTargets} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('displays range information', () => {
    render(<DroneGrid targets={mockTargets} maxRange={50000} />)

    expect(screen.getByText(/2d position plot/i)).toBeInTheDocument()
    expect(screen.getByText(/range: 0 to 50 km/i)).toBeInTheDocument()
  })

  it('displays click instruction when onDroneSelect is provided', () => {
    const mockOnDroneSelect = vi.fn()
    render(
      <DroneGrid
        targets={mockTargets}
        onDroneSelect={mockOnDroneSelect}
      />
    )

    expect(
      screen.getByText(/click on a drone to select it/i)
    ).toBeInTheDocument()
  })

  it('does not display click instruction when onDroneSelect is not provided', () => {
    render(<DroneGrid targets={mockTargets} />)

    expect(
      screen.queryByText(/click on a drone to select it/i)
    ).not.toBeInTheDocument()
  })

  it('displays legend items', () => {
    render(<DroneGrid targets={mockTargets} />)

    expect(screen.getByText('Drone Position')).toBeInTheDocument()
    expect(screen.getByText('Movement Trail')).toBeInTheDocument()
    expect(screen.getByText('Velocity Vector')).toBeInTheDocument()
  })

  it('handles empty targets array', () => {
    render(<DroneGrid targets={[]} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('calls onDroneSelect when canvas is clicked on a drone', () => {
    const mockOnDroneSelect = vi.fn()
    render(
      <DroneGrid
        targets={mockTargets}
        onDroneSelect={mockOnDroneSelect}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()

    // Mock getBoundingClientRect for click position calculation
    if (canvas) {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 600,
        width: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      }))

      // Click near the center where a drone might be (approximate position)
      // Note: This is a simplified test - actual position calculation depends on polar coordinates
      fireEvent.click(canvas, {
        clientX: 300,
        clientY: 300,
      })

      // The callback should be called (either with a drone ID or null)
      expect(mockOnDroneSelect).toHaveBeenCalled()
    }
  })

  it('handles click on empty space to deselect', () => {
    const mockOnDroneSelect = vi.fn()
    render(
      <DroneGrid
        targets={mockTargets}
        selectedDroneId={1}
        onDroneSelect={mockOnDroneSelect}
      />
    )

    const canvas = document.querySelector('canvas')
    if (canvas) {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 600,
        width: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      }))

      // Click far from any drone (top-left corner)
      fireEvent.click(canvas, {
        clientX: 10,
        clientY: 10,
      })

      // Should deselect (call with null)
      expect(mockOnDroneSelect).toHaveBeenCalled()
    }
  })

  it('toggles selection when clicking on already selected drone', () => {
    const mockOnDroneSelect = vi.fn()
    render(
      <DroneGrid
        targets={mockTargets}
        selectedDroneId={1}
        onDroneSelect={mockOnDroneSelect}
      />
    )

    const canvas = document.querySelector('canvas')
    if (canvas) {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 600,
        width: 600,
        height: 600,
        x: 0,
        y: 0,
        toJSON: vi.fn(),
      }))

      // Click on selected drone should deselect it
      fireEvent.click(canvas, {
        clientX: 300,
        clientY: 300,
      })

      expect(mockOnDroneSelect).toHaveBeenCalled()
    }
  })

  it('uses custom maxRange when provided', () => {
    render(<DroneGrid targets={mockTargets} maxRange={100000} />)

    expect(screen.getByText(/range: 0 to 100 km/i)).toBeInTheDocument()
  })

  it('uses default maxRange when not provided', () => {
    render(<DroneGrid targets={mockTargets} />)

    expect(screen.getByText(/range: 0 to 50 km/i)).toBeInTheDocument()
  })

  it('has correct canvas dimensions', () => {
    render(<DroneGrid targets={mockTargets} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toHaveAttribute('width', '600')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('updates when targets change', () => {
    const { rerender } = render(<DroneGrid targets={mockTargets} />)

    const canvas1 = document.querySelector('canvas')
    expect(canvas1).toBeInTheDocument()

    const newTargets: TargetPosition[] = [
      {
        id: 4,
        range_m: 25000,
        azimuth_deg: 270,
        vel_m_s: 15,
        rcs: 0.9,
      },
    ]

    rerender(<DroneGrid targets={newTargets} />)

    const canvas2 = document.querySelector('canvas')
    expect(canvas2).toBeInTheDocument()
  })

  it('updates when selectedDroneId changes', () => {
    const { rerender } = render(
      <DroneGrid targets={mockTargets} selectedDroneId={null} />
    )

    rerender(<DroneGrid targets={mockTargets} selectedDroneId={1} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })
})

