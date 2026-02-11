/**
 * SSRF protection: block internal IPs and non-HTTP schemes.
 * Prevents attackers from accessing 169.254.169.254 (AWS metadata), localhost, etc.
 */

function isPrivateOrReserved(hostname: string): boolean {
  // Resolve hostname to IP - we can't do DNS in serverless easily, so we block by hostname patterns
  const lower = hostname.toLowerCase();

  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "127.0.0.1" ||
    lower.startsWith("127.")
  ) {
    return true;
  }

  // IPv4 address patterns
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map((x) => parseInt(x, 10));
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local, AWS metadata)
    if (a === 169 && b === 254) return true;
  }

  // IPv6 localhost
  if (lower === "[::1]" || lower.startsWith("[::ffff:127.")) return true;

  return false;
}

export function validateUrlForScreenshot(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname;
  if (isPrivateOrReserved(hostname)) {
    throw new Error("Internal and private URLs are not allowed");
  }
}
