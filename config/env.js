import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const parsePort = (value) => {
  if (!/^\d+$/.test(value)) {
    throw new Error("PORT must be a number between 1 and 65535");
  }

  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error("PORT must be a number between 1 and 65535");
  }
  return port;
};

const parseClientOrigin = (value) => {
  if (!value) {
    throw new Error("CLIENT_ORIGIN is required");
  }

  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a valid HTTP or HTTPS origin");
  }

  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== value ||
    origin.username ||
    origin.password
  ) {
    throw new Error(
      "CLIENT_ORIGIN must be an origin only, without a path or trailing slash"
    );
  }

  return origin.origin;
};

export const getConfig = () => {
  const mongodbUri = process.env.MONGODB_URI?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  if (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }

  return {
    port: parsePort(process.env.PORT ?? "5000"),
    mongodbUri,
    jwtSecret,
    clientOrigin: parseClientOrigin(process.env.CLIENT_ORIGIN?.trim()),
  };
};

export const getClientOrigin = () =>
  parseClientOrigin(process.env.CLIENT_ORIGIN?.trim());
