import mongoose from "mongoose";
import HttpError from "./HttpError.js";

export const notFound = (req, res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error, req, res, _next) => {
  if (res.headersSent) {
    return _next(error);
  }

  let statusCode = error.statusCode ?? error.status ?? 500;
  let message = error.message;

  if (error.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON request body";
  } else if (error.type === "entity.too.large") {
    statusCode = 413;
    message = "Request body exceeds the 10kb limit";
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "A user with that username or email already exists";
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
  }

  if (statusCode >= 500) {
    console.error(error);
    message = "Internal server error";
  }

  res.status(statusCode).json({ message });
};
