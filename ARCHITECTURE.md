# Architecture Documentation

## Overview

This project is a radar simulation platform built with Rust (Tokio/Axum) backend and React frontend.

## System Architecture

### Backend Architecture

#### Core Components

1. **Async Service Layer** (`src/main.rs`, `src/routes.rs`)
   - Built on Tokio async runtime for high-performance concurrent request handling
   - Axum web framework for HTTP/WebSocket endpoints
   - Modular router architecture with state management

2. **Observability** (`src/observability.rs`)
   - Structured logging with `tracing` and `tracing-subscriber`
   - Application metrics tracking (requests, success/failure rates, WebSocket connections)
   - Health check endpoint (`/health`) for service monitoring
   - Metrics endpoint (`/metrics`) for performance monitoring

3. **Error Handling** (`src/error.rs`)
   - Custom error types with `thiserror`
   - Structured error responses with appropriate HTTP status codes
   - Comprehensive error logging

4. **Analysis Engine** (`src/analysis.rs`)
   - Drone threat analysis algorithms
   - Trajectory and risk assessment
   - Blocking task execution to prevent async runtime blocking

5. **API Layer** (`src/handlers.rs`)
   - RESTful API endpoints with OpenAPI documentation
   - WebSocket handler for real-time data streaming
   - Input validation and request metrics tracking

### Resilience Patterns

1. **Timeout Handling**
   - Request timeouts (30 seconds) via `TimeoutLayer`
   - Prevents resource exhaustion from hanging requests

2. **Retry Logic** (Frontend)
   - Exponential backoff retry mechanism
   - Configurable max attempts (default: 3)
   - Network connectivity detection

3. **Graceful Degradation**
   - Service health monitoring
   - Error recovery mechanisms
   - Offline detection and user feedback

4. **Input Validation**
   - Range validation for all inputs
   - Type checking and sanitization
   - Early error returns to prevent invalid processing

### Security Features

1. **CORS Configuration**
   - Environment-based origin restrictions
   - Development: permissive (all origins)
   - Production: restricted to configured origins

2. **Request Timeouts**
   - Prevents DoS attacks via slow requests
   - Resource protection

3. **Input Validation**
   - Comprehensive validation on all endpoints
   - Prevents injection and invalid data processing

### Frontend Architecture

#### Component Structure

1. **Health Dashboard** (`frontend/src/components/HealthDashboard.tsx`)
   - Real-time system health monitoring
   - Performance metrics visualization
   - Auto-refresh every 5 seconds

2. **State Management**
   - React hooks for local state
   - Custom hooks for WebSocket and API interactions
   - Error state management

3. **Resilience Features**
   - Automatic retry with exponential backoff
   - Offline detection
   - Request timeouts
   - User-friendly error messages

#### Hooks

- `useWebSocket`: WebSocket connection management with auto-reconnect
- `useAnalysis`: API calls with retry logic and timeout handling
- `useRetry`: Reusable retry mechanism with configurable backoff

## API Design

### REST Endpoints

- `POST /api/analyze` - Drone analysis endpoint
  - Validates input parameters
  - Returns comprehensive threat analysis
  - OpenAPI documented

- `GET /health` - Health check endpoint
  - Returns service status, version, uptime
  - Service component health checks

- `GET /metrics` - Performance metrics endpoint
  - Request statistics
  - Success/failure rates
  - Active connections

### WebSocket Endpoints

- `ws://127.0.0.1:3001/ws` - Real-time drone tracking

## Observability

### Logging

- Structured JSON logging via `tracing-subscriber`
- Configurable log levels via `RUST_LOG` environment variable
- Request/response logging via `TraceLayer`

### Metrics

- Total requests
- Success/failure counts
- Active WebSocket connections
- Analysis operation counts
- Success rate calculation

### Health Monitoring

- Service health status
- Component-level health checks
- Uptime tracking
- Version information

## Testing Strategy

### Backend Tests

- Unit tests for handlers
- Integration tests for API endpoints
- Input validation tests
- Error handling tests

### Frontend Tests

- Component tests with React Testing Library
- Hook tests
- Integration tests

### CI/CD

- Automated testing on push/PR
- Linting (clippy, eslint)
- Format checking (rustfmt)
- Build verification
- Separate jobs for backend and frontend

## Deployment Considerations

### Production Configuration

1. **Environment Variables**
   - `PRODUCTION=true` - Enables production mode
   - `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
   - `RUST_LOG` - Log level configuration

2. **Build Process**
   - Backend: `cargo build --release`
   - Frontend: `npm run build`
   - Optimized binaries and static assets

3. **Monitoring**
   - Health check endpoint for load balancer integration
   - Metrics endpoint for third-party monitoring integration
   - Structured logs for log aggregation systems

### Scalability

- Stateless API design enables horizontal scaling
- WebSocket connections can be load-balanced with sticky sessions
- Metrics collection supports distributed tracing

## Performance Considerations

1. **Async Runtime**
   - Non-blocking I/O operations
   - Efficient task scheduling
   - Resource pooling

2. **Blocking Tasks**
   - CPU-intensive analysis runs on blocking thread pool
   - Prevents async runtime blocking

3. **Connection Management**
   - Efficient WebSocket connection handling
   - Automatic cleanup on disconnect

## Future Enhancements

1. **Circuit Breaker Pattern**
   - Prevent cascading failures
   - Automatic recovery

2. **Rate Limiting**
   - Per-client rate limits
   - DDoS protection

3. **Distributed Tracing**
   - Request correlation IDs
   - Performance profiling

4. **Caching**
   - Response caching for analysis results
   - Reduced computation for similar inputs

5. **Database Integration**
   - Historical data storage
   - Analytics and reporting
