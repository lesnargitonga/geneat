// Lightweight typed fetch client with automatic JWT refresh.
// Tokens are persisted in localStorage so a page refresh keeps you signed in.

const ACCESS_KEY = "omni.access";
const REFRESH_KEY = "omni.refresh";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

function withBase(path: string): string {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(tokens: AuthTokens) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public payload?: unknown
  ) {
    super(`${status}: ${detail}`);
  }
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const rt = tokenStore.refresh;
  if (!rt) return null;
  try {
    const r = await fetch(withBase("/admin/auth/refresh"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) {
      tokenStore.clear();
      return null;
    }
    const data = (await r.json()) as AuthTokens;
    tokenStore.set(data);
    return data.access_token;
  } catch {
    tokenStore.clear();
    return null;
  }
}

function ensureRefresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  noAuth?: boolean;
  raw?: boolean;
}

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {}
): Promise<T> {
  const { body, noAuth, raw, headers, ...rest } = opts;

  const send = async (token: string | null): Promise<Response> => {
    const h = new Headers(headers || {});
    if (body !== undefined && !(body instanceof FormData)) {
      h.set("content-type", "application/json");
    }
    if (token && !noAuth) h.set("authorization", `Bearer ${token}`);
    return fetch(withBase(path), {
      ...rest,
      headers: h,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
          ? body
          : JSON.stringify(body),
    });
  };

  let resp = await send(tokenStore.access);
  if (resp.status === 401 && !noAuth) {
    const fresh = await ensureRefresh();
    if (fresh) resp = await send(fresh);
  }

  if (raw) return resp as unknown as T;

  if (resp.status === 204) return undefined as T;

  const text = await resp.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    const detail =
      (data as { detail?: string })?.detail || resp.statusText || "Request failed";
    throw new ApiError(resp.status, String(detail), data);
  }
  return data as T;
}
