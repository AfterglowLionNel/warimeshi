export function sanitizeRedirectPath(input: string | null | undefined, fallback = "/group") {
  if (!input) return fallback

  let value = input
  try {
    value = decodeURIComponent(input)
  } catch {
    value = input
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("\\") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    return fallback
  }

  if (!value.startsWith("/")) return fallback

  return value
}
