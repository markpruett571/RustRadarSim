import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DetectionControls from './SimulationControls'

describe('DetectionControls', () => {
  const mockOnStartDetection = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the component with correct title and description', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={false}
        connected={true}
      />
    )

    expect(screen.getByText('Drone Detection System')).toBeInTheDocument()
    expect(
      screen.getByText('Active radar system for detecting and tracking drones in real-time.')
    ).toBeInTheDocument()
  })

  it('renders "Start Detection" button when not tracking', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={false}
        connected={true}
      />
    )

    const button = screen.getByRole('button', { name: /start detection/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('renders "Detection Active" button when tracking', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={true}
        connected={true}
      />
    )

    const button = screen.getByRole('button', { name: /detection active/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
  })

  it('disables button when not connected', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={false}
        connected={false}
      />
    )

    const button = screen.getByRole('button', { name: /start detection/i })
    expect(button).toBeDisabled()
  })

  it('disables button when tracking', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={true}
        connected={true}
      />
    )

    const button = screen.getByRole('button', { name: /detection active/i })
    expect(button).toBeDisabled()
  })

  it('calls onStartDetection when button is clicked and enabled', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={false}
        connected={true}
      />
    )

    const button = screen.getByRole('button', { name: /start detection/i })
    fireEvent.click(button)

    expect(mockOnStartDetection).toHaveBeenCalledTimes(1)
  })

  it('does not call onStartDetection when button is disabled', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={true}
        connected={true}
      />
    )

    const button = screen.getByRole('button', { name: /detection active/i })
    fireEvent.click(button)

    expect(mockOnStartDetection).not.toHaveBeenCalled()
  })

  it('shows detection status message when tracking', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={true}
        connected={true}
      />
    )

    expect(
      screen.getByText('✓ Monitoring airspace for drones...')
    ).toBeInTheDocument()
  })

  it('does not show detection status message when not tracking', () => {
    render(
      <DetectionControls
        onStartDetection={mockOnStartDetection}
        tracking={false}
        connected={true}
      />
    )

    expect(
      screen.queryByText('✓ Monitoring airspace for drones...')
    ).not.toBeInTheDocument()
  })
})

