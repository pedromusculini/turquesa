export {};

declare global {
  var verificationCodes: Map<string, { code: string; expiresAt: number }> | undefined;
}
