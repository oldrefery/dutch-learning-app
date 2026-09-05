/* eslint-disable no-undef */
// Wait script for Maestro tests
// Adds a delay to allow app navigation and state updates to complete
// after login or other async operations

const waitMs = 2000 // 2 seconds

// Use Maestro's built-in wait
output.delay = waitMs
