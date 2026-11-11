package com.cartify.tests;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Selenium WebDriver tests: a real Chrome browser opens the Cartify website and
 * clicks through it like a user. JUnit 5 runs them and reports pass / fail.
 * A screenshot of every test is saved in target/screenshots/.
 */
@DisplayName("Cartify website (Selenium + JUnit 5)")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class UiTest {

    private static WebDriver driver;
    private static WebDriverWait wait;
    private String testName;

    @BeforeAll
    static void openBrowser() {
        ChromeOptions options = new ChromeOptions();
        if (Config.HEADLESS) options.addArguments("--headless=new");
        if (!Config.CHROME_BINARY.isBlank()) options.setBinary(Config.CHROME_BINARY);
        options.addArguments("--window-size=1366,900", "--no-sandbox", "--disable-dev-shm-usage");
        // Selenium Manager (built into Selenium 4) downloads the matching ChromeDriver automatically.
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, Duration.ofSeconds(15));
    }

    @AfterAll
    static void closeBrowser() {
        if (driver != null) driver.quit();
    }

    @BeforeEach
    void rememberName(TestInfo info) {
        testName = info.getTestMethod().map(m -> m.getName()).orElse("test");
        driver.manage().window().setSize(new Dimension(1366, 900));
    }

    @AfterEach
    void screenshot() throws Exception {
        File shot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE);
        Path dir = Path.of("target", "screenshots");
        Files.createDirectories(dir);
        Files.copy(shot.toPath(), dir.resolve(testName + ".png"), StandardCopyOption.REPLACE_EXISTING);
    }

    private void open(String path) {
        driver.get(Config.WEB_URL + path);
    }

    @Test
    @Order(1)
    @DisplayName("UI-01  Home page opens with the store name in the tab title")
    void homePageOpens() {
        open("/");
        wait.until(ExpectedConditions.titleContains("Cartify"));
        assertTrue(driver.getTitle().contains("Cartify"));
    }

    @Test
    @Order(2)
    @DisplayName("UI-02  Shop page shows the search box")
    void shopPageHasSearch() {
        open("/products");
        wait.until(ExpectedConditions.titleIs("Shop · Cartify"));
        assertTrue(driver.findElement(By.id("shop-search")).isDisplayed());
    }

    @Test
    @Order(3)
    @DisplayName("TC-19  Searching by name shows the matching product")
    void searchFindsProduct() {
        assumeTrue(Config.hasAdminLogin(), "no admin login given, so no product could be created");
        ApiClient admin = new ApiClient();
        admin.login(Config.ADMIN_EMAIL, Config.ADMIN_PASSWORD);
        String name = "Selenium Lamp " + System.currentTimeMillis();
        TestData.product(admin, name);

        open("/products");
        WebElement search = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("shop-search")));
        search.sendKeys(name);
        WebElement card = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//a[contains(@href,'/products/')][contains(., '" + name + "')]")));
        assertTrue(card.isDisplayed());
    }

    @Test
    @Order(4)
    @DisplayName("TC-03  Wrong password shows an error message")
    void wrongPasswordShowsError() {
        open("/login");
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email"))).sendKeys("nobody@example.com");
        driver.findElement(By.name("password")).sendKeys("WrongPassword1");
        driver.findElement(By.cssSelector("button[type='submit']")).click();
        WebElement toast = wait.until(ExpectedConditions.visibilityOfElementLocated(By.className("Toastify__toast")));
        assertTrue(toast.getText().contains("Invalid credentials"), "toast said: " + toast.getText());
        assertTrue(driver.getCurrentUrl().contains("/login"), "should stay on the login page");
    }

    @Test
    @Order(5)
    @DisplayName("TC-24  A guest who opens the bag is sent to sign in")
    void cartRedirectsGuestToLogin() {
        driver.manage().deleteAllCookies();
        open("/cart");
        wait.until(ExpectedConditions.urlContains("/login"));
        assertTrue(driver.getCurrentUrl().contains("/login"));
    }

    @Test
    @Order(6)
    @DisplayName("TC-57  Footer link opens the Returns policy page")
    void footerOpensReturnsPolicy() {
        open("/");
        WebElement link = wait.until(ExpectedConditions.presenceOfElementLocated(By.linkText("Returns & refunds")));
        ((JavascriptExecutor) driver).executeScript("arguments[0].scrollIntoView({block:'center'});", link);
        wait.until(ExpectedConditions.elementToBeClickable(link)).click();
        WebElement heading = wait.until(ExpectedConditions.visibilityOfElementLocated(By.tagName("h1")));
        assertEquals("Returns & refunds", heading.getText());
    }

    @Test
    @Order(7)
    @DisplayName("TC-50  Admin signs in and sees the dashboard")
    void adminSeesDashboard() {
        assumeTrue(Config.hasAdminLogin(), "no admin login given (-Dadmin.email / -Dadmin.password)");
        driver.manage().deleteAllCookies();
        open("/login");
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.name("email"))).sendKeys(Config.ADMIN_EMAIL);
        driver.findElement(By.name("password")).sendKeys(Config.ADMIN_PASSWORD);
        driver.findElement(By.cssSelector("button[type='submit']")).click();
        wait.until(ExpectedConditions.not(ExpectedConditions.urlContains("/login")));

        open("/admin");
        WebElement recent = wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//h2[normalize-space()='Recent orders']")));
        assertTrue(recent.isDisplayed());
    }

    @Test
    @Order(8)
    @DisplayName("TC-61  Shop page fits a phone screen (no sideways scrolling)")
    void shopFitsPhoneScreen() {
        driver.manage().window().setSize(new Dimension(390, 844));
        open("/products");
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("shop-search")));
        Long pageWidth = (Long) ((JavascriptExecutor) driver)
                .executeScript("return document.documentElement.scrollWidth;");
        Long screenWidth = (Long) ((JavascriptExecutor) driver)
                .executeScript("return document.documentElement.clientWidth;");
        assertTrue(pageWidth <= screenWidth, "page is " + pageWidth + "px wide on a " + screenWidth + "px screen");
    }
}
