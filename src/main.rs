use axum::http::Method;
use radar_sim::routes::create_router;
use radar_sim::types::{
    AnalysisWebSocketMessage, DroneAnalysis, RiskAssessment, SimulationConfig,
    SimulationParams, SimulationResult, Target, TargetPosition, TrajectoryAnalysis,
    WebSocketMessage,
};
use tower_http::cors::{Any, CorsLayer};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(radar_sim::handlers::simulate_handler, radar_sim::handlers::analyze_handler),
    components(schemas(
        SimulationResult,
        SimulationParams,
        SimulationConfig,
        Target,
        TargetPosition,
        DroneAnalysis,
        TrajectoryAnalysis,
        RiskAssessment,
        WebSocketMessage,
        AnalysisWebSocketMessage
    )),
    tags(
        (name = "Simulation", description = "Radar simulation endpoints"),
        (name = "Analysis", description = "Drone analysis endpoints")
    ),
    info(
        title = "Radar Simulation API",
        description = "API for radar simulation and drone analysis",
        version = "1.0.0"
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    let app = create_router()
        .merge(
            SwaggerUi::new("/swagger-ui")
                .url("/api-docs/openapi.json", ApiDoc::openapi())
        )
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    println!("Server running on http://127.0.0.1:3001");
    println!("API endpoint: http://127.0.0.1:3001/api/simulate");
    println!("Analysis API endpoint: http://127.0.0.1:3001/api/analyze");
    println!("WebSocket endpoint: ws://127.0.0.1:3001/ws");
    println!("Analysis WebSocket endpoint: ws://127.0.0.1:3001/ws/analyze");
    println!("Swagger UI: http://127.0.0.1:3001/swagger-ui/");
    println!("OpenAPI JSON: http://127.0.0.1:3001/api-docs/openapi.json");

    axum::serve(listener, app).await?;

    Ok(())
}
