export function register() {
  if (!process.env.AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with `npx auth secret` and add it to your environment.",
    );
  }
}
