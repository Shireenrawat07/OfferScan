export const API_BASE_URL = (
  import.meta.env.PROD
    ? ""
    : import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Could not reach OfferScan. Check that the backend is running.");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The backend returned an unreadable response.");
  }
  if (!response.ok || !body?.success) {
    const message = body?.error?.message || "The request could not be completed.";
    const requestId = body?.error?.requestId || response.headers.get("X-Request-Id");
    throw new Error(requestId ? `${message} (Reference: ${requestId})` : message);
  }
  return body.data;
}
