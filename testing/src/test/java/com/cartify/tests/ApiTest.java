package com.cartify.tests;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * JUnit 5 tests of the Cartify REST API (black-box: they only send HTTP requests).
 * The TC numbers match the test-case table of the SRS (Section 11.1).
 */
@DisplayName("Cartify REST API (JUnit 5)")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ApiTest {

    private final ApiClient guest = new ApiClient();

    @Test
    @Order(1)
    @DisplayName("TC-53  Health check answers 200")
    void healthCheck() {
        ApiClient.Response r = guest.get("/api/health");
        assertEquals(200, r.status());
        assertTrue(r.body().path("success").asBoolean(), "success should be true");
    }

    @Test
    @Order(2)
    @DisplayName("TC-19  Anyone can list products")
    void listProductsIsPublic() {
        ApiClient.Response r = guest.get("/api/products");
        assertEquals(200, r.status());
        assertTrue(r.body().path("products").isArray(), "products should be a list");
    }

    @Test
    @Order(3)
    @DisplayName("TC-01  Sign-up refuses an invalid email")
    void registerRejectsInvalidEmail() {
        ApiClient.Response r = guest.post("/api/auth/register",
                Map.of("name", "Test User", "email", "not-an-email", "password", "Password123"));
        assertEquals(400, r.status());
    }

    @Test
    @Order(4)
    @DisplayName("TC-01  Sign-up refuses a password shorter than 8 characters")
    void registerRejectsShortPassword() {
        ApiClient.Response r = guest.post("/api/auth/register",
                Map.of("name", "Test User", "email", "someone@example.com", "password", "123"));
        assertEquals(400, r.status());
    }

    @Test
    @Order(5)
    @DisplayName("TC-03  Login with a wrong password is refused")
    void loginWithWrongPassword() {
        ApiClient.Response r = guest.login("nobody@example.com", "WrongPassword1");
        assertEquals(401, r.status());
        assertEquals("Invalid credentials", r.body().path("message").asText());
    }

    @Test
    @Order(6)
    @DisplayName("TC-24  The bag needs sign-in")
    void cartNeedsLogin() {
        assertEquals(401, guest.get("/api/cart").status());
    }

    @Test
    @Order(7)
    @DisplayName("TC-40  A guest cannot see orders or the user list")
    void protectedRoutesNeedLogin() {
        assertEquals(401, guest.get("/api/orders/my").status());
        assertEquals(401, guest.get("/api/users").status());
    }

    @Test
    @Order(8)
    @DisplayName("TC-20  AI search understands a price limit")
    void aiSearchReadsPrice() {
        ApiClient.Response r = guest.post("/api/ai/search", Map.of("query", "shoes under 3000"));
        assertEquals(200, r.status());
        assertEquals(3000, r.body().path("interpretation").path("maxPrice").asInt(),
                "the assistant should read 'under 3000' as maxPrice = 3000");
    }

    // ---- The tests below need an Admin login (see README). Without one they are skipped. ----

    @Test
    @Order(9)
    @DisplayName("TC-50  Admin can sign in")
    void adminCanLogin() {
        assumeTrue(Config.hasAdminLogin(), "no admin login given (-Dadmin.email / -Dadmin.password)");
        ApiClient admin = new ApiClient();
        ApiClient.Response r = admin.login(Config.ADMIN_EMAIL, Config.ADMIN_PASSWORD);
        assertEquals(200, r.status());
        String role = r.body().path("user").path("role").asText();
        assertTrue(role.equals("admin") || role.equals("superadmin"), "role was " + role);
    }

    @Test
    @Order(10)
    @DisplayName("TC-11  Product price cannot be above its MRP")
    void mrpBelowPriceIsRejected() {
        ApiClient admin = signedInAdmin();
        String categoryId = TestData.category(admin);
        ApiClient.Response r = admin.post("/api/products", Map.of(
                "name", "JUnit Bad Price", "brand", "Test", "description", "Price above MRP",
                "price", 1500, "mrp", 1000, "category", categoryId, "stock", 5));
        assertEquals(400, r.status());
    }

    @Test
    @Order(11)
    @DisplayName("TC-15, TC-19  New product is listed in the shop, and hidden after removal")
    void createSearchAndRemoveProduct() {
        ApiClient admin = signedInAdmin();
        String name = "JUnit Lamp " + System.currentTimeMillis();
        String id = TestData.product(admin, name);

        JsonNode found = guest.get("/api/products?q=" + name.replace(" ", "%20")).body().path("products");
        assertTrue(containsName(found, name), "the new product should be found by search");

        assertEquals(200, admin.delete("/api/products/" + id).status());
        JsonNode after = guest.get("/api/products?q=" + name.replace(" ", "%20")).body().path("products");
        assertFalse(containsName(after, name), "a removed product must not be listed in the shop");
    }

    private static ApiClient signedInAdmin() {
        assumeTrue(Config.hasAdminLogin(), "no admin login given (-Dadmin.email / -Dadmin.password)");
        ApiClient admin = new ApiClient();
        assertEquals(200, admin.login(Config.ADMIN_EMAIL, Config.ADMIN_PASSWORD).status(), "admin login failed");
        return admin;
    }

    private static boolean containsName(JsonNode products, String name) {
        for (JsonNode p : products) {
            if (name.equals(p.path("name").asText())) return true;
        }
        return false;
    }
}
