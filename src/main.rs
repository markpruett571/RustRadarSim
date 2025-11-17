use axum::http::Method;
use radar_sim::observability::{init_tracing, AppMetrics};
use radar_sim::routes::create_router;
use radar_sim::types::{
    AnalysisWebSocketMessage, DroneAnalysis, RiskAssessment,
    TargetPosition, TrajectoryAnalysis, WebSocketMessage,
};
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    cors::{AllowOrigin, Any, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use axum::http::HeaderValue;
use tracing::info;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(radar_sim::handlers::analyze_handler),
    components(schemas(
        TargetPosition,
        DroneAnalysis,
        TrajectoryAnalysis,
        RiskAssessment,
        WebSocketMessage,
        AnalysisWebSocketMessage
    )),
    tags(
        (name = "Analysis", description = "Drone analysis endpoints")
    ),
    info(
        title = "Drone Radar Simulation API",
        description = "API for drone radar simulation and analysis",
        version = "1.0.0"
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize structured logging
    init_tracing();

    // Initialize application metrics
    let metrics = Arc::new(AppMetrics::new());

    // Configure CORS - allow all origins in development, restrict in production
    let cors = if std::env::var("PRODUCTION").is_ok() {
        // Production: restrict to specific origins
        let allowed_origins = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173".to_string());
        let origins: Result<Vec<HeaderValue>, _> = allowed_origins
            .split(',')
            .map(|s| s.trim().parse())
            .collect();
        
        match origins {
            Ok(origins_vec) if !origins_vec.is_empty() => {
                CorsLayer::new()
                    .allow_origin(AllowOrigin::list(origins_vec))
                    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                    .allow_headers(Any)
                    .allow_credentials(true)
            }
            _ => {
                // Fallback to allowing all if parsing fails
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
                    .allow_headers(Any)
            }
        }
    } else {
        // Development: allow all origins
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
            .allow_headers(Any)
    };

    // Build middleware stack with resilience features
    let middleware_stack = ServiceBuilder::new()
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::new(std::time::Duration::from_secs(30)))
        .layer(cors);

    let app = create_router(metrics.clone())
        .merge(
            SwaggerUi::new("/swagger-ui")
                .url("/api-docs/openapi.json", ApiDoc::openapi())
        )
        .layer(middleware_stack);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    
    info!("Server starting on http://127.0.0.1:3001");
    info!("Analysis API endpoint: http://127.0.0.1:3001/api/analyze");
    info!("Drone Tracking WebSocket endpoint: ws://127.0.0.1:3001/ws");
    info!("Analysis WebSocket endpoint: ws://127.0.0.1:3001/ws/analyze");
    info!("Health check endpoint: http://127.0.0.1:3001/health");
    info!("Metrics endpoint: http://127.0.0.1:3001/metrics");
    info!("Swagger UI: http://127.0.0.1:3001/swagger-ui/");
    info!("OpenAPI JSON: http://127.0.0.1:3001/api-docs/openapi.json");

    axum::serve(listener, app).await?;

    Ok(())
}
