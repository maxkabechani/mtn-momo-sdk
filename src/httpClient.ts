export interface RequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  data?: any;
  params?: Record<string, string>;
}

export interface InternalRequestConfig extends RequestConfig {
  url: string;
  method: string;
}

export interface FetchResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: InternalRequestConfig;
}

export class HttpClientError extends Error {
  config: InternalRequestConfig;
  request?: any;
  response?: FetchResponse;

  constructor(
    message: string,
    config: InternalRequestConfig,
    response?: FetchResponse,
  ) {
    super(message);
    this.name = "HttpClientError";
    this.config = config;
    this.response = response;
  }
}

class InterceptorManagerImpl<V> {
  handlers: {
    onFulfilled: ((value: V) => V | Promise<V>) | null;
    onRejected: ((error: any) => any) | null;
  }[] = [];

  use(
    onFulfilled?: ((value: V) => V | Promise<V>) | null,
    onRejected?: ((error: any) => any) | null,
  ): number {
    this.handlers.push({
      onFulfilled: onFulfilled || null,
      onRejected: onRejected || null,
    });
    return this.handlers.length - 1;
  }

  eject(id: number): void {
    if (this.handlers[id]) {
      this.handlers[id] = null as any;
    }
  }
}

export interface HttpClientDefaults {
  baseURL?: string;
  headers: {
    common: Record<string, string>;
    [key: string]: Record<string, string> | string | undefined;
  };
  timeout?: number;
}

export class HttpClient {
  defaults: HttpClientDefaults = {
    headers: { common: {} },
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
  }

  async request<T = any>(
    config: InternalRequestConfig,
  ): Promise<FetchResponse<T>> {
    let currentConfig: InternalRequestConfig = { ...config };

    // Set base URL
    if (
      this.defaults.baseURL &&
      currentConfig.url &&
      !currentConfig.url.startsWith("http")
    ) {
      const baseUrl = this.defaults.baseURL.endsWith("/")
        ? this.defaults.baseURL.substring(0, this.defaults.baseURL.length - 1)
        : this.defaults.baseURL;
      const urlPath = currentConfig.url.startsWith("/")
        ? currentConfig.url
        : `/${currentConfig.url}`;
      currentConfig.url = baseUrl + urlPath;
    }

    // Merge headers
    currentConfig.headers = {
      ...this.defaults.headers.common,
      ...currentConfig.headers,
    };

    // Run request interceptors
    for (const interceptor of this.interceptors.request.handlers) {
      if (interceptor?.onFulfilled) {
        currentConfig = await interceptor.onFulfilled(currentConfig);
      }
    }

    const { url, method, data, timeout } = currentConfig;
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: currentConfig.headers,
    };

    if (data !== undefined) {
      if (typeof data === "string") {
        fetchOptions.body = data;
      } else if (data instanceof URLSearchParams) {
        fetchOptions.body = data;
      } else {
        fetchOptions.body = JSON.stringify(data);
        if (!(fetchOptions.headers as Record<string, string>)["Content-Type"]) {
          (fetchOptions.headers as Record<string, string>)["Content-Type"] =
            "application/json";
        }
      }
    }

    let timer: NodeJS.Timeout | undefined;
    if (timeout) {
      const controller = new AbortController();
      fetchOptions.signal = controller.signal;
      timer = setTimeout(() => controller.abort(), timeout);
    }

    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (e: any) {
      let error = new HttpClientError(e.message, currentConfig);
      // Run response reject interceptors for network errors
      for (const interceptor of this.interceptors.response.handlers) {
        if (interceptor?.onRejected) {
          try {
            await interceptor.onRejected(error);
          } catch (interceptedError: any) {
            error = interceptedError;
          }
        }
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseData: any = null;
    let responseText = await response.text();
    const contentType = response.headers.get("content-type");

    if (responseText) {
      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = responseText;
        }
      } else {
        responseData = responseText;
      }
    }

    let fetchResponse: FetchResponse<T> = {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config: currentConfig,
    };

    if (!response.ok) {
      let error = new HttpClientError(
        `Request failed with status code ${response.status}`,
        currentConfig,
        fetchResponse,
      );

      for (const interceptor of this.interceptors.response.handlers) {
        if (interceptor?.onRejected) {
          try {
            await interceptor.onRejected(error);
          } catch (e) {
            error = e as HttpClientError;
          }
        }
      }
      throw error;
    }

    // Run response fulfil interceptors
    for (const interceptor of this.interceptors.response.handlers) {
      if (interceptor?.onFulfilled) {
        fetchResponse = await interceptor.onFulfilled(fetchResponse);
      }
    }

    return fetchResponse;
  }

  get<T = any>(url: string, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  post<T = any>(url: string, data?: any, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "POST", data });
  }

  put<T = any>(url: string, data?: any, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "PUT", data });
  }

  delete<T = any>(url: string, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }

  patch<T = any>(url: string, data?: any, config?: RequestConfig) {
    return this.request<T>({ ...config, url, method: "PATCH", data });
  }
}

export function createHttpClient(config?: RequestConfig): HttpClient {
  return new HttpClient(config);
}
