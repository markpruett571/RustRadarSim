# Radar Simulation Project

A radar simulation system with a Rust backend and React frontend for visualizing range-Doppler maps and radar data.

## Project Structure

- `src/main.rs` - Rust backend with radar simulation logic and REST API
- `frontend/` - React frontend application built with Vite

## Prerequisites

- Rust (latest stable version)
- Node.js (v18 or higher recommended)
- npm or yarn

## Running the Application

### Backend (Rust API Server)

1. Start the Rust backend server:
```bash
cargo run
```

The server will start on `http://127.0.0.1:3001`

### Frontend (React Application)

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies (if not already done):
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will typically run on `http://localhost:5173` (Vite's default port)

## Features

- **Radar Simulation**: Configurable radar parameters including:
  - Carrier frequency (fc)
  - Sampling rate (fs)
  - Pulse repetition frequency (PRF)
  - Number of pulses
  - Pulse width
  - Noise level

- **Visualizations**:
  - Range Profile: Line chart showing average magnitude per range bin
  - Range-Doppler Map: Heatmap visualization of range vs Doppler frequency

- **Interactive Controls**: Adjust simulation parameters and run new simulations in real-time

## API Endpoints

### HTTP REST API

- `GET /api/simulate` - Run radar simulation with optional query parameters:
  - `fc` - Carrier frequency (Hz)
  - `fs` - Sampling rate (Hz)
  - `prf` - Pulse repetition frequency (Hz)
  - `num_pulses` - Number of pulses
  - `pulse_width` - Pulse width (seconds)
  - `noise_sigma` - Noise standard deviation

Example: `http://127.0.0.1:3001/api/simulate?fc=10000000000&fs=1000000&prf=500`

### WebSocket API

- `ws://127.0.0.1:3001/ws` - WebSocket connection for real-time communication

**Message Format:**

Send simulation request:
```json
{
  "type": "simulate",
  "params": {
    "fc": 10000000000,
    "fs": 1000000,
    "prf": 500,
    "num_pulses": 32,
    "pulse_width": 0.00005,
    "noise_sigma": 0.1
  }
}
```

Receive responses:
- `{"type": "result", ...}` - Simulation result with range_doppler_map, range_profile, and config
- `{"type": "error", "message": "..."}` - Error message
- `{"type": "status", "message": "..."}` - Status update (e.g., "Running simulation...")

The frontend automatically uses WebSocket when available and falls back to HTTP if the WebSocket connection fails.

## Building for Production

### Backend
```bash
cargo build --release
```

### Frontend
```bash
cd frontend
npm run build
```

The built frontend will be in `frontend/dist/`

