const BASE = "/internal/v1";

async function request<T>(
  getToken: () => Promise<string>,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status });
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function createApiClient(getToken: () => Promise<string>) {
  const get = <T>(path: string) => request<T>(getToken, "GET", path);
  const post = <T>(path: string, body: unknown) => request<T>(getToken, "POST", path, body);
  const put = <T>(path: string, body: unknown) => request<T>(getToken, "PUT", path, body);
  const del = <T>(path: string) => request<T>(getToken, "DELETE", path);

  return { get, post, put, del };
}

export type ApiClient = ReturnType<typeof createApiClient>;
