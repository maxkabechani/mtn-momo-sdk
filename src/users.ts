import type { HttpClient } from "./httpClient.js";

import { Environment, type ApiUserInfo, type Credentials } from "./common.js";
import {
  encodeStrictPathSegment,
  generateReferenceId,
  pathUuid,
} from "./security.js";

export default class Users {
  private client: HttpClient;
  private environment: Environment;

  constructor(
    client: HttpClient,
    environment: Environment = Environment.SANDBOX,
  ) {
    this.client = client;
    this.environment = environment;
  }

  /**
   * Used to create an API user in the sandbox target environment
   * @param host The provider callback host
   */
  public create(host: string): Promise<string> {
    this.assertSandbox();
    const safeHost = encodeStrictPathSegment(host, "host");
    const userId = generateReferenceId();
    return this.client
      .post(
        "/v1_0/apiuser",
        { providerCallbackHost: decodeURIComponent(safeHost) },
        {
          headers: {
            "X-Reference-Id": userId,
          },
        },
      )
      .then(() => userId);
  }

  /**
   * Used to create an API key for an API user in the sandbox target environment.
   * @param userId
   */
  public login(userId: string): Promise<Credentials> {
    this.assertSandbox();
    return this.client
      .post<Credentials>(`/v1_0/apiuser/${pathUuid(userId, "userId")}/apikey`)
      .then((response) => response.data);
  }

  /**
   * Used to retrieve an API user by reference id in the sandbox target environment.
   * @param referenceId API user reference id (X-Reference-Id used at creation)
   */
  public getApiUser(referenceId: string): Promise<ApiUserInfo> {
    this.assertSandbox();
    return this.client
      .get<ApiUserInfo>(`/v1_0/apiuser/${pathUuid(referenceId)}`)
      .then((response) => response.data);
  }

  private assertSandbox(): void {
    if (this.environment !== Environment.SANDBOX) {
      throw new Error("API user provisioning is only available in sandbox");
    }
  }
}
