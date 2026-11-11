package com.cartify.tests;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * A tiny HTTP client for the Cartify REST API.
 * It keeps cookies, so after login() the next requests are made as that user
 * (Cartify keeps the login token in an httpOnly cookie).
 */
public class ApiClient {

    /** Status code plus the JSON body of one API answer. */
    public record Response(int status, JsonNode body) {}

    private static final ObjectMapper JSON = new ObjectMapper();

    private final HttpClient http = HttpClient.newBuilder()
            .cookieHandler(new CookieManager())
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public Response get(String path) {
        return send("GET", path, null);
    }

    public Response post(String path, Map<String, ?> body) {
        return send("POST", path, body);
    }

    public Response delete(String path) {
        return send("DELETE", path, null);
    }

    /** Signs in; the session cookie is kept for the following requests. */
    public Response login(String email, String password) {
        return post("/api/auth/login", Map.of("email", email, "password", password));
    }

    private Response send(String method, String path, Map<String, ?> body) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(Config.API_URL + path))
                    .timeout(Duration.ofSeconds(30))
                    .header("Accept", "application/json");
            if (body == null) {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                request.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
            }
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
            String text = response.body();
            JsonNode json = (text == null || text.isBlank()) ? JSON.createObjectNode() : JSON.readTree(text);
            return new Response(response.statusCode(), json);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Cannot reach the Cartify API at " + Config.API_URL
                    + " - is the server running? (" + e.getMessage() + ")", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
