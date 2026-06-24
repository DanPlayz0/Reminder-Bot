import configuration from "@/configuration";
import * as Sentry from "@sentry/node";

const sentryEnabled = Boolean(configuration.sentry_dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: configuration.sentry_dsn,
    environment: configuration.sentry_environment,
  });
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  console.error(message, error);

  if (!sentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    scope.setExtra("message", message);
    Sentry.captureException(error);
  });
}

export function logMessage(message: string, context?: Record<string, unknown>) {
  console.log(message);

  if (!sentryEnabled) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    Sentry.captureMessage(message);
  });
}
