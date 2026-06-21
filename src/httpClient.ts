import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_TIMEOUT_MS,
  redactSensitiveText,
  redactUrl,
} from "./security.js";

export interface RequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxResponseBytes?: number;
  data?: unknown;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export interface InternalRequestConfig extends RequestConfig {
  url: string;
  method: string;
}

export interface SafeRequestSummary {
  method: string;
  url: string;
  timeout: number;
}

export interface FetchResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: SafeRequestSummary;
}

interface HttpClientErrorOptions {
  status?: number;
  providerCode?: string;
  providerMessage?: string;
  retryable?: boolean;
  causeName?: string;
  secrets?: string[];
}

export class HttpClientError extends Error {
  public readonly config: SafeRequestSummary;
  public readonly status?: number;
  public readonly providerCode?: string;
  public declare readonly providerMessage?: string;
  public readonly retryable: boolean;
  public readonly causeName?: string;

  constructor(
    message: string,
    config: SafeRequestSummary,
    options: HttpClientErrorOptions = {},
  ) {
    super(redactValues(message, options.secrets));
    this.name = "HttpClientError";
    this.config = Object.freeze({ ...config });
    this.status = options.status;
    this.providerCode = options.providerCode;
    this.retryable = options.retryable ?? false;
    this.causeName = options.causeName;

    if (options.providerMessage) {
      Object.defineProperty(this, "providerMessage", {
        value: redactValues(options.providerMessage, options.secrets),
        enumerable: false,
        writable: false,
      });
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      config: this.config,
      status: this.status,
      providerCode: this.providerCode,
      retryable: this.retryable,
      causeName: this.causeName,
    };
  }
}

export class RequestTimeoutError extends HttpClientError {
  public override readonly name = "RequestTimeoutError";
}

export class RequestAbortedError extends HttpClientError {
  public override readonly name = "RequestAbortedError";
}

export class UnexpectedRedirectError extends HttpClientError {
  public override readonly name = "UnexpectedRedirectError";
}

export class ResponseSizeLimitError extends HttpClientError {
  public override readonly name = "ResponseSizeLimitError";
}

class InterceptorManagerImpl<V> {
  handlers: {
    onFulfilled: ((value: V) => V | Promise<V>) | null;
    onRejected: ((error: unknown) => unknown) | null;
  }[] = [];

  use(
    onFulfilled?: ((value: V) => V | Promise<V>) | null,
    onRejected?: ((error: unknown) => unknown) | null,
  ): number {
    this.handlers.push({
      onFulfilled: onFulfilled || null,
      onRejected: onRejected || null,
    });
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null as never;
    }
  }
}

export interface HttpClientDefaults {
  baseURL?: string;
  headers: {
    common: Record<string, string>;
    [key: string]: Record<string, string> | string | undefined;
  };
  timeout: number;
  maxResponseBytes: number;
}

export class HttpClient {
  defaults: HttpClientDefaults = {
    headers: { common: {} },
    timeout: DEFAULT_TIMEOUT_MS,
    maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
  };

  interceptors = {
    request: new InterceptorManagerImpl<InternalRequestConfig>(),
    response: new InterceptorManagerImpl<FetchResponse>(),
  };

  constructor(config?: RequestConfig) {
    if (config?.baseURL) {
      this.defaults.baseURL = config.baseURL;
    }
    if (config?.headers) {
      this.defaults.headers.common = { ...config.headers };
    }
    if (config?.timeout !== undefined) {
      this.defaults.timeout = config.timeout;
    }
    if (config?.maxResponseBytes !== undefined) {
      this.defaults.maxResponseBytes = config.maxResponseBytes;
    }
  }

  async request<T = unknown>(
    config: InternalRequestConfig,
  ): Promise<FetchResponse<T>> {
    let currentConfig: InternalRequestConfig = {
      ...config,
      headers: { ...config.headers },
    };

    if (
      this.defaults.baseURL &&
      currentConfig.url &&
      !/^https?:\/\//i.test(currentConfig.url)
    ) {
      const baseUrl = this.defaults.baseURL.replace(/\/+$/, "");
      const urlPath = currentConfig.url.startsWith("/")
        ? currentConfig.url
        : `/${currentConfig.url}`;
      currentConfig.url = baseUrl + urlPath;
    }

    currentConfig.headers = {
      ...this.defaults.headers.common,
      ...currentConfig.headers,
    };
    currentConfig.timeout = currentConfig.timeout ?? this.defaults.timeout;
    currentConfig.maxResponseBytes =
      currentConfig.maxResponseBytes ?? this.defaults.maxResponseBytes;

    for (const interceptor of this.interceptors.request.handlers) {
      if (interceptor?.onFulfilled) {
        currentConfig = await interceptor.onFulfilled(currentConfig);
      }
    }

    const summary = safeRequestSummary(currentConfig);
    const fetchOptions: RequestInit = {
      method: currentConfig.method || "GET",
      headers: currentConfig.headers,
      redirect: "manual",
    };

    if (currentConfig.data !== undefined) {
      if (
        typeof currentConfig.data === "string" ||
        currentConfig.data instanceof URLSearchParams
      ) {
        fetchOptions.body = currentConfig.data;
      } else {
        fetchOptions.body = JSON.stringify(currentConfig.data);
        if (!hasHeader(fetchOptions.headers, "content-type")) {
          (fetchOptions.headers as Record<string, string>)["Content-Type"] =
            "application/json";
        }
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = currentConfig.timeout ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    const abortFromCaller = () => controller.abort(currentConfig.signal?.reason);
    if (currentConfig.signal) {
      if (currentConfig.signal.aborted) {
        abortFromCaller();
      } else {
        currentConfig.signal.addEventListener("abort", abortFromCaller, {
          once: true,
        });
      }
    }
    fetchOptions.signal = controller.signal;
    const cleanupAbortState = () => {
      clearTimeout(timer);
      currentConfig.signal?.removeEventListener("abort", abortFromCaller);
    };

    let response: Response;
    try {
      response = await fetch(currentConfig.url, fetchOptions);
    } catch (cause) {
      const causeError = cause instanceof Error ? cause : new Error(String(cause));
      const error = timedOut
        ? new RequestTimeoutError("Request timed out", summary, {
            retryable: true,
            causeName: causeError.name,
          })
        : currentConfig.signal?.aborted
          ? new RequestAbortedError("Request was aborted", summary, {
              retryable: false,
              causeName: causeError.name,
            })
          : new HttpClientError("Network request failed", summary, {
              retryable: true,
              causeName: causeError.name,
            });
      cleanupAbortState();
      throw await this.runRejectedInterceptors(error);
    }

    if (response.status >= 300 && response.status < 400) {
      const error = new UnexpectedRedirectError(
        "Unexpected redirect response",
        summary,
        { status: response.status, retryable: false },
      );
      cleanupAbortState();
      throw await this.runRejectedInterceptors(error);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseText: string;
    try {
      responseText = await readResponseText(
      response,
      currentConfig.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
      summary,
      );
    } catch (error) {
      cleanupAbortState();
      if (error instanceof ResponseSizeLimitError) {
        throw await this.runRejectedInterceptors(error);
      }
      const causeError =
        error instanceof Error ? error : new Error(String(error));
      const safeError = timedOut
        ? new RequestTimeoutError("Request timed out", summary, {
            retryable: true,
            causeName: causeError.name,
          })
        : currentConfig.signal?.aborted
          ? new RequestAbortedError("Request was aborted", summary, {
              retryable: false,
              causeName: causeError.name,
            })
          : new HttpClientError("Failed to read response body", summary, {
              status: response.status,
              retryable: true,
              causeName: causeError.name,
            });
      throw await this.runRejectedInterceptors(safeError);
    }
    cleanupAbortState();

    const responseData = parseResponseBody(
      responseText,
      response.headers.get("content-type"),
    );
    const fetchResponse: FetchResponse<T> = {
      data: responseData as T,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config: summary,
    };

    if (!response.ok) {
      const body =
        responseData && typeof responseData === "object"
          ? (responseData as Record<string, unknown>)
          : {};
      const providerCode =
        typeof body.code === "string" ? body.code : undefined;
      const providerMessage =
        typeof body.message === "string" ? body.message : undefined;
      const error = new HttpClientError(
        `Request failed with status code ${response.status}`,
        summary,
        {
          status: response.status,
          providerCode,
          providerMessage,
          retryable: response.status === 429 || response.status >= 500,
          secrets: sensitiveHeaderValues(currentConfig.headers),
        },
      );
      throw await this.runRejectedInterceptors(error);
    }

    let interceptedResponse: FetchResponse = fetchResponse;
    for (const interceptor of this.interceptors.response.handlers) {
      if (interceptor?.onFulfilled) {
        interceptedResponse = await interceptor.onFulfilled(interceptedResponse);
      }
    }

    return interceptedResponse as FetchResponse<T>;
  }

  get<T = unknown>(url: string, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "POST", data });
  }

  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "PUT", data });
  }

  delete<T = unknown>(url: string, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }

  patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "PATCH", data });
  }

  private async runRejectedInterceptors(error: Error): Promise<Error> {
    let currentError = error;
    for (const interceptor of this.interceptors.response.handlers) {
      if (interceptor?.onRejected) {
        try {
          await interceptor.onRejected(currentError);
        } catch (interceptedError) {
          currentError =
            interceptedError instanceof Error
              ? interceptedError
              : new Error(String(interceptedError));
        }
      }
    }
    return currentError;
  }
}

function safeRequestSummary(config: InternalRequestConfig): SafeRequestSummary {
  return Object.freeze({
    method: config.method || "GET",
    url: redactUrl(config.url),
    timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
  });
}

function hasHeader(
  headers: RequestInit["headers"] | undefined,
  name: string,
): boolean {
  if (!headers) return false;
  const expected = name.toLowerCase();
  if (headers instanceof Headers) return headers.has(name);
  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === expected);
  }
  return Object.keys(headers).some((key) => key.toLowerCase() === expected);
}

async function readResponseText(
  response: Response,
  limit: number,
  summary: SafeRequestSummary,
): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new ResponseSizeLimitError(
      "Response body exceeded the configured size limit",
      summary,
    );
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ResponseSizeLimitError(
        "Response body exceeded the configured size limit",
        summary,
      );
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function parseResponseBody(
  responseText: string,
  contentType: string | null,
): unknown {
  if (!responseText) return null;
  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  }
  return responseText;
}

function sensitiveHeaderValues(
  headers: Record<string, string> | undefined,
): string[] {
  if (!headers) return [];
  const sensitiveNames = new Set([
    "authorization",
    "ocp-apim-subscription-key",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
  ]);
  return Object.entries(headers)
    .filter(([name]) => sensitiveNames.has(name.toLowerCase()))
    .map(([, value]) => value)
    .filter(Boolean);
}

function redactValues(value: string, secrets: string[] = []): string {
  let redacted = redactSensitiveText(value);
  for (const secret of secrets) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

export function createHttpClient(config?: RequestConfig): HttpClient {
  return new HttpClient(config);
}
