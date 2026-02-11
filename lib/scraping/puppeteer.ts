/**
 * Puppeteer screenshot and HTML fetch service.
 * Uses @sparticuz/chromium for Netlify/serverless. For local dev, use CHROME_PATH
 * or install: npx @puppeteer/browsers install chromium@latest --path ./chromium
 */

import { validateUrlForScreenshot } from "./url-validator";

export interface ScreenshotResult {
  screenshotBuffer: Buffer;
  html: string;
  url: string;
}

export async function captureScreenshotAndHtml(url: string): Promise<ScreenshotResult> {
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  validateUrlForScreenshot(normalizedUrl);

  const puppeteer = await import("puppeteer-core");
  const chromium = await import("@sparticuz/chromium");

  const isServerless = !!(
    process.env.AWS_LAMBDA_FUNCTION_VERSION ||
    process.env.NETLIFY
  );

  let executablePath: string;
  let args: string[];
  let defaultViewport: { width: number; height: number } | null;
  let headless: boolean | "shell";

  if (isServerless) {
    executablePath = await chromium.default.executablePath();
    args = chromium.default.args;
    defaultViewport = { width: 1440, height: 900 };
    headless = true;
  } else {
    executablePath =
      process.env.CHROME_PATH ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : process.platform === "win32"
          ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
          : "chromium");
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
    defaultViewport = { width: 1440, height: 900 };
    headless = true;
  }

  const browser = await puppeteer.default.launch({
    args,
    defaultViewport,
    executablePath,
    headless,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1440, height: 900 });

    const response = await page.goto(normalizedUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load ${normalizedUrl}: ${response?.status() ?? "No response"}`);
    }

    const html = await page.content();
    const screenshotBuffer = Buffer.from(
      await page.screenshot({ type: "png", fullPage: false })
    );

    return { screenshotBuffer, html, url: normalizedUrl };
  } finally {
    await browser.close();
  }
}
