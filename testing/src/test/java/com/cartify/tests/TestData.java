package com.cartify.tests;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Creates the data a test needs through the API, as an admin. */
final class TestData {

    private TestData() {}

    /** Creates (or restores) the "JUnit Test" category and returns its id. */
    static String category(ApiClient admin) {
        ApiClient.Response r = admin.post("/api/categories",
                Map.of("name", "JUnit Test", "description", "Created by the automated tests"));
        if (r.status() == 201) return r.body().path("category").path("_id").asText();

        // It already exists from an earlier run: look it up.
        for (var c : admin.get("/api/categories").body().path("categories")) {
            if ("JUnit Test".equals(c.path("name").asText())) return c.path("_id").asText();
        }
        throw new IllegalStateException("Could not create the test category: " + r.body());
    }

    /** Creates an in-stock product with this name and returns its id. */
    static String product(ApiClient admin, String name) {
        ApiClient.Response r = admin.post("/api/products", Map.of(
                "name", name, "brand", "Lumen", "description", "Created by the automated tests",
                "price", 999, "mrp", 1299, "category", category(admin), "stock", 10));
        assertEquals(201, r.status(), "product was not created: " + r.body());
        return r.body().path("product").path("_id").asText();
    }
}
