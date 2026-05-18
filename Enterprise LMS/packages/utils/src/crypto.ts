import { randomBytes } from "crypto";

export function generateId(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}
