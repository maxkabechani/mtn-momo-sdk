import type { HttpClient } from "./httpClient";
import { v4 as uuid } from "uuid";

import type { ApiUserInfo, Credentials } from "./common";

export default class Users {
  private client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /**
   * Used to create an API user in the sandbox target environment
   * @param host The provider callback host
   */
  public create(host: string): Promise<string> {
    const userId: string = uuid();
    return this.client
      .post(
        "/v1_0/apiuser",
        { providerCallbackHost: host },
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
    return this.client
      .post<Credentials>(`/v1_0/apiuser/${userId}/apikey`)
      .then((response) => response.data);
  }

  /**
   * Used to retrieve an API user by reference id in the sandbox target environment.
   * @param referenceId API user reference id (X-Reference-Id used at creation)
   */
  public getApiUser(referenceId: string): Promise<ApiUserInfo> {
    return this.client
      .get<ApiUserInfo>(`/v1_0/apiuser/${referenceId}`)
      .then((response) => response.data);
  }
}
