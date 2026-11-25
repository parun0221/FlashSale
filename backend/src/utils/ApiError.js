/**
 * Error dengan status code HTTP.
 *
 * TODO:
 *  - class ApiError extends Error { statusCode, details }
 */

class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;