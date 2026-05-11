import { createHmac, timingSafeEqual } from "node:crypto";

export const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const verifyStripeSignature = (
  payload: string,
  header: string,
  secret: string,
) => {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  if (!parts.t || !parts.v1) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${parts.t}.${payload}`)
    .digest("hex");
  return safeEqual(expected, parts.v1);
};

export const mapBillingEventToAction = (event: string) => {
  if (/created|paid|provision/i.test(event)) {
    return "provision";
  }
  if (/unsuspend|reactivate/i.test(event)) {
    return "unsuspend";
  }
  if (/suspend/i.test(event)) {
    return "suspend";
  }
  if (/terminate|cancel|deleted/i.test(event)) {
    return "terminate";
  }
  if (/limit|upgrade|downgrade/i.test(event)) {
    return "update_limits";
  }
  return "ignore";
};
