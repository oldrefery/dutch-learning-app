# Sentry Telemetry Smoke Check

Use this procedure after changing Sentry configuration, creating a new native
build, or changing the source map upload flow. Never run it against the
production environment.

## Preconditions

- Use an EAS `preview` build connected to the `preview` update channel.
- Confirm the build uses the expected app version and native build number.
- Confirm source maps for that build or update were uploaded successfully.
- Use only synthetic values. Never enter a real email, token, user id, or
  credential in the smoke payload.

## Trigger

Temporarily invoke the following code from a local diagnostic action. Remove
the invocation before committing:

```ts
const smokeMarker = `sentry-smoke-${Date.now()}`

Sentry.startSpan(
  {
    name: 'sentry.telemetry.smoke-check',
    op: 'test',
  },
  () => {
    Sentry.addBreadcrumb({
      category: 'telemetry.smoke',
      message: smokeMarker,
      data: {
        access_token: 'synthetic-access-token',
        email: 'synthetic@example.invalid',
      },
    })

    Sentry.captureException(new Error(`SENTRY_SMOKE_CHECK ${smokeMarker}`), {
      tags: {
        smoke_check: 'controlled',
      },
      extra: {
        marker: smokeMarker,
        clientSecret: 'synthetic-client-secret',
      },
    })
  }
)

await Sentry.flush(5000)
```

Performance sampling is probabilistic. If the smoke transaction is not
captured, retry at most four times. The error event itself is not governed by
the trace sampling rate.

## Verify In Sentry

Search the `dutch-learning-app` project with the exact marker and verify:

1. The event has `environment=preview`.
2. `release` is `<application-id>@<native-version>+<native-build>`.
3. `dist` is the native build number.
4. The stack trace resolves to TypeScript source rather than only bundle
   offsets.
5. Breadcrumb and extra values show `[REDACTED]`.
6. Searching for each synthetic raw value returns no matching event.
7. An error replay, when supported on the test device, keeps text, images, and
   vector content masked.

If environment, release, or dist is wrong, stop the rollout and compare the
runtime metadata with `scripts/upload-sourcemaps.sh`. If a raw synthetic value
is visible, treat it as a privacy regression and do not deploy.

## Cleanup

- Remove the temporary diagnostic invocation.
- Run the Sentry configuration and sanitizer tests.
- Resolve the smoke issue in Sentry after verification.
- Record the build, channel, marker, and result in the release checklist.

References:

- [Sentry React Native configuration](https://docs.sentry.io/platforms/react-native/configuration/options/)
- [Sentry React Native source maps](https://docs.sentry.io/platforms/react-native/sourcemaps/)
- [Sentry React Native replay privacy](https://docs.sentry.io/platforms/react-native/session-replay/privacy/)
- [Expo application metadata](https://docs.expo.dev/versions/v55.0.0/sdk/application/)
- [Expo Updates channels](https://docs.expo.dev/versions/v55.0.0/sdk/updates/)
