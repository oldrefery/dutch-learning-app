/* global output */
console.log(
  'D01_NATIVE_SAMPLE ' +
    JSON.stringify({
      sample: output.sample,
      elapsedMs: Date.now() - output.startedAt,
    })
)
