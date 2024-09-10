/**
 * Represents a standard API response.
 */
class ApiResponse {
  /**
   * The HTTP status code of the response.
   */
  public statusCode: number;

  /**
   * The response data.
   */
  public data: any;

  /**
   * A message associated with the response.
   * Defaults to "Success".
   */
  public message: string;

  /**
   * Indicates whether the request was successful (status code below 400).
   */
  public success: boolean;

  /**
   * Creates a new ApiResponse instance.
   * @param statusCode The HTTP status code of the response.
   * @param data The response data.
   * @param message A message associated with the response.
   */
  constructor(statusCode: number, message: string = "Success", data?: any) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

export default ApiResponse;
