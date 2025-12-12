const CONTENT_SECURITY_POLICY = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  media-src 'self' https:;
  object-src 'none';
  base-uri 'self';
  upgrade-insecure-requests;
  block-all-mixed-content;
  frame-ancestors 'none';
  form-action 'self';
`
  .replace(/\s{2,}/g, " ")
  .trim()

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
