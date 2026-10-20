import HttpError from "../middleware/HttpError.js";

export const sendPasswordResetEmail = async (email, token) => {
  const { RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM || !FRONTEND_URL) {
    throw new HttpError(503, "Password reset email is not configured");
  }

  let resetUrl;
  try {
    const frontendUrl = new URL(FRONTEND_URL);
    if (
      !["http:", "https:"].includes(frontendUrl.protocol) ||
      frontendUrl.username ||
      frontendUrl.password
    ) {
      throw new Error("Invalid frontend URL");
    }

    resetUrl = new URL("/reset-password", frontendUrl);
    resetUrl.searchParams.set("token", token);
  } catch {
    throw new HttpError(503, "Password reset email is not configured");
  }

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: "Reset your password",
        html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl.href}">Reset your password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
        text: `We received a request to reset your password. Open this link to continue: ${resetUrl.href}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("Resend password-reset request failed:", error.message);
    throw new HttpError(503, "Password reset email could not be sent");
  }

  if (!response.ok) {
    console.error(
      `Resend password-reset request failed with status ${response.status}`
    );
    throw new HttpError(503, "Password reset email could not be sent");
  }
};
