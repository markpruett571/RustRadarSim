# Radar Simulation Platform

A radar simulation platform with a Rust (Tokio/Axum) backend and React frontend. Features real-time drone tracking, threat analysis, observability, and resilient system patterns.

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
- Health Check: `http://127.0.0.1:3001/health`
- Metrics: `http://127.0.0.1:3001/metrics`
- Swagger UI: `http://127.0.0.1:3001/swagger-ui/`
- OpenAPI JSON: `http://127.0.0.1:3001/api-docs/openapi.json`
- Drone Tracking WebSocket: `ws://127.0.0.1:3001/ws`

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

- `ws://127.0.0.1:3001/ws` - WebSocket connection for drone tracking

**WebSocket (`/ws`) Messages:**

Send tracking request:
```json
{
  "type": "start_tracking"
}
```

Receive tracking results:
- `{"type": "targets", "targets": {...}}` - Drone tracking data

## Technology Stack

### Backend
- **Rust** with **Tokio** - High-performance async runtime
- **Axum** 0.8 - Modern async web framework
- **tracing** & **tracing-subscriber** - Structured logging and observability
- **utoipa** 5.4 - Automatic OpenAPI documentation generation
- **utoipa-swagger-ui** 9.0 - Interactive Swagger UI
- **tower-http** - Middleware for timeouts, tracing, CORS
- **serde** - Serialization framework for API data structures
- **thiserror** & **anyhow** - Error handling

### Frontend
- **React** 19 with **TypeScript**
- **Vite** - Fast build tool and dev server
- **Vitest** - Testing framework
- **React Testing Library** - Component testing

## Architecture

This project follows production-grade architecture patterns:

- **Async Backend Services**: Tokio-based async services for high concurrency
- **Observability**: Structured logging, metrics, and health checks
- **Resilience**: Retry logic, timeouts, graceful degradation
- **Security**: Input validation, CORS configuration, request timeouts
- **Modular Design**: Well-separated concerns, documented API contracts
- **CI/CD**: Automated testing, linting, and building

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

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

### Environment Variables

- `RUST_LOG` - Control log levels (default: `radar_sim=info,tower_http=info`)
- `PRODUCTION` - Set to `true` to enable production mode (restricts CORS)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (production mode)

### Testing

#### Backend Tests
```bash
cargo test
```

#### Frontend Tests
```bash
cd frontend
npm test
```

### CI/CD

The project includes GitHub Actions workflows for:
- Automated testing on push/PR
- Code linting (clippy, eslint)
- Format checking (rustfmt)
- Build verification

## Production Deployment

### Backend

1. Build release binary:
```bash
cargo build --release
```

2. Set environment variables:
```bash
export PRODUCTION=true
export ALLOWED_ORIGINS=https://yourdomain.com
export RUST_LOG=radar_sim=info
```

3. Run the server:
```bash
./target/release/radar_sim
```

### Frontend

1. Build production assets:
```bash
cd frontend
npm run build
```

2. Serve the `dist/` directory with a web server (nginx, Apache, etc.)

### Monitoring

- Health checks: Configure load balancer to check `/health` endpoint
- Metrics: Integrate `/metrics` endpoint with Prometheus/Grafana
- Logs: Configure log aggregation for structured JSON logs

## Key Features

### Observability
- Structured JSON logging with configurable levels
- Application metrics (requests, success rates, connections)
- Health check endpoints for monitoring
- Request/response tracing

### Resilience
- Automatic retry with exponential backoff
- Request timeouts (30 seconds)
- Graceful error handling
- Offline detection and user feedback

### Security
- Input validation on all endpoints
- Configurable CORS policies
- Request timeout protection
- Error message sanitization

### Performance
- Async/await for non-blocking I/O
- Efficient WebSocket connection management
- CPU-intensive tasks on blocking thread pool
- Optimized builds for production
