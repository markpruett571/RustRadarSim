# Radar Simulation Project

A radar simulation system with a Rust backend and React frontend for visualizing range-Doppler maps and radar data.

## Project Structure

- `src/main.rs` - Rust backend with radar simulation logic and REST API
- `frontend/` - React frontend application built with Vite

## Prerequisites

- Rust (latest stable version) - The project uses `rust-toolchain.toml` to ensure consistent Rust version
- Node.js (v18 or higher recommended)
- npm or yarn

## Running the Application

### Backend (Rust API Server)

1. Start the Rust backend server:
```bash
cargo run
```

The server will start on `http://127.0.0.1:3001`

**Available endpoints:**
- API: `http://127.0.0.1:3001/api/simulate`
- Swagger UI: `http://127.0.0.1:3001/swagger-ui/`
- OpenAPI JSON: `http://127.0.0.1:3001/api-docs/openapi.json`
- WebSocket: `ws://127.0.0.1:3001/ws`
- Analysis WebSocket: `ws://127.0.0.1:3001/ws/analyze`

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
- **OpenAPI Documentation**: Automatic API documentation generation with interactive Swagger UI

## API Documentation

The API includes automatically generated OpenAPI documentation:

- **Swagger UI**: Interactive API documentation available at `http://127.0.0.1:3001/swagger-ui/`
  - Browse all available endpoints
  - Test API calls directly from the browser
  - View request/response schemas
- **OpenAPI JSON**: Machine-readable API specification at `http://127.0.0.1:3001/api-docs/openapi.json`
  - Can be imported into API testing tools
  - Used for code generation and client SDKs

## API Endpoints

### HTTP REST API

- `GET /api/simulate` - Run radar simulation with optional query parameters:
  - `fc` - Carrier frequency (Hz, default: 10 GHz)
  - `fs` - Sampling rate (Hz, default: 1 MHz)
  - `prf` - Pulse repetition frequency (Hz, default: 500 Hz)
  - `num_pulses` - Number of pulses (default: 32)
  - `pulse_width` - Pulse width in seconds (default: 50 μs)
  - `noise_sigma` - Noise standard deviation (default: 0.1)

**Response:** Returns a `SimulationResult` containing:
- `range_doppler_map`: 2D array of range-Doppler data
- `range_profile`: Averaged magnitude per range bin
- `config`: Simulation configuration used

Example: `http://127.0.0.1:3001/api/simulate?fc=10000000000&fs=1000000&prf=500`

> 💡 **Tip**: Use the [Swagger UI](http://127.0.0.1:3001/swagger-ui/) to explore and test the API interactively!

### WebSocket API

- `ws://127.0.0.1:3001/ws` - WebSocket connection for real-time radar simulation
- `ws://127.0.0.1:3001/ws/analyze` - WebSocket connection for drone analysis

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

**Simulation WebSocket (`/ws`) Messages:**

Receive responses:
- `{"type": "result", ...}` - Simulation result with range_doppler_map, range_profile, and config
- `{"type": "error", "message": "..."}` - Error message
- `{"type": "status", "message": "..."}` - Status update (e.g., "Running simulation...")
- `{"type": "targets", "targets": [...]}` - Real-time target position updates (when tracking is active)

Start tracking:
```json
{
  "type": "start_tracking",
  "params": { ... }
}
```

**Analysis WebSocket (`/ws/analyze`) Messages:**

Send analysis request:
```json
{
  "type": "analyze",
  "drone_id": 1,
  "target": {
    "id": 1,
    "range_m": 5000.0,
    "azimuth_deg": 45.0,
    "vel_m_s": 30.0,
    "rcs": 0.8
  }
}
```

Receive analysis results:
- `{"type": "analysis_result", "analysis": {...}}` - Drone analysis with threat level, risk assessment, and recommendations
- `{"type": "analysis_error", "message": "..."}` - Error message
- `{"type": "analysis_status", "message": "..."}` - Status update

The frontend automatically uses WebSocket when available and falls back to HTTP if the WebSocket connection fails.

## Technology Stack

### Backend
- **Rust** with **Axum** 0.8 - High-performance async web framework
- **utoipa** 5.4 - Automatic OpenAPI documentation generation
- **utoipa-swagger-ui** 9.0 - Interactive Swagger UI
- **tokio** - Async runtime
- **ndarray** - Numerical computing for radar signal processing

### Frontend
- **React** with **TypeScript**
- **Vite** - Fast build tool and dev server

## Building for Production

### Backend
```bash
cargo build --release
```

The optimized binary will be in `target/release/radar_sim.exe` (Windows) or `target/release/radar_sim` (Unix)

### Frontend
```bash
cd frontend
npm run build
```

The built frontend will be in `frontend/dist/`

## Development

The project uses `rust-toolchain.toml` to ensure all developers use the same Rust version. The Rust toolchain will be automatically selected when you run `cargo` commands.

