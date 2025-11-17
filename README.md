# Drone Radar Simulation Project

A drone radar simulation system with a Rust backend and React frontend for tracking and analyzing drones.

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
- Analysis API: `http://127.0.0.1:3001/api/analyze`
- Swagger UI: `http://127.0.0.1:3001/swagger-ui/`
- OpenAPI JSON: `http://127.0.0.1:3001/api-docs/openapi.json`
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

- **Drone Tracking**: Real-time tracking of multiple drones with position, velocity, and radar cross-section (RCS) data
- **Drone Analysis**: Comprehensive analysis of detected drones including:
  - Threat level assessment (low, medium, high)
  - Drone type estimation
  - Trajectory analysis (heading, speed, altitude)
  - Risk assessment (proximity risk, velocity risk, overall risk)
  - Actionable recommendations

- **Visualizations**:
  - 2D Position Grid: Interactive visualization of drone positions on a radar grid
  - Drone Information Panel: Detailed information about detected drones

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

- `POST /api/analyze` - Analyze a detected drone

**Request Body:**
```json
{
  "id": 1,
  "range_m": 5000.0,
  "azimuth_deg": 45.0,
  "vel_m_s": 30.0,
  "rcs": 0.8
}
```

**Response:** Returns a `DroneAnalysis` containing:
- `drone_id`: Identifier of the analyzed drone
- `threat_level`: Threat assessment (low, medium, high)
- `estimated_type`: Estimated drone type
- `confidence`: Confidence score (0.0 to 1.0)
- `trajectory_analysis`: Heading, speed, and altitude estimates
- `risk_assessment`: Proximity, velocity, and overall risk scores
- `recommendations`: List of actionable recommendations

> 💡 **Tip**: Use the [Swagger UI](http://127.0.0.1:3001/swagger-ui/) to explore and test the API interactively!

### WebSocket API

- `ws://127.0.0.1:3001/ws/analyze` - WebSocket connection for drone analysis

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

The frontend uses HTTP REST API for drone analysis and can optionally use WebSocket for real-time analysis updates.

## Technology Stack

### Backend
- **Rust** with **Axum** 0.8 - High-performance async web framework
- **utoipa** 5.4 - Automatic OpenAPI documentation generation
- **utoipa-swagger-ui** 9.0 - Interactive Swagger UI
- **tokio** - Async runtime
- **serde** - Serialization framework for API data structures

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

