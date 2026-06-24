// src-tauri/src/http_client.rs — execute a single HTTP request for the .http
// REST client. Uses ureq (already a dependency).
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
}

#[derive(Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub time_ms: u64,
}

#[tauri::command]
pub async fn http_request(req: HttpRequest) -> Result<HttpResponse, String> {
    tokio::task::spawn_blocking(move || http_blocking(req))
        .await
        .map_err(|e| e.to_string())?
}

fn http_blocking(req: HttpRequest) -> Result<HttpResponse, String> {
    let start = Instant::now();
    let mut r = ureq::request(&req.method.to_uppercase(), &req.url);
    for (k, v) in &req.headers {
        r = r.set(k, v);
    }
    let result = match &req.body {
        Some(b) if !b.is_empty() => r.send_string(b),
        _ => r.call(),
    };
    let resp = match result {
        Ok(resp) => resp,
        Err(ureq::Error::Status(_, resp)) => resp, // 4xx/5xx still carry a response
        Err(e) => return Err(e.to_string()),
    };
    let status = resp.status();
    let status_text = resp.status_text().to_string();
    let headers = resp
        .headers_names()
        .iter()
        .map(|n| (n.clone(), resp.header(n).unwrap_or("").to_string()))
        .collect();
    let body = resp.into_string().unwrap_or_default();
    Ok(HttpResponse {
        status,
        status_text,
        headers,
        body,
        time_ms: start.elapsed().as_millis() as u64,
    })
}
