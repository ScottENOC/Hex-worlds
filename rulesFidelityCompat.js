// Bridge helpers exported by earlier IIFE-based fidelity layers.
// Classic scripts resolve these names through the global object at call time.
if (typeof window !== 'undefined') {
  if (typeof window.recordBorderViolation !== 'function' && typeof window.recordDiplomaticViolation === 'function') {
    window.recordBorderViolation = window.recordDiplomaticViolation;
  }
}
