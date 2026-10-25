export type ShoppingMeasurement = {
  phase: string;
  ms: number;
  at: number;
  serverTiming?: string;
  count?: number;
};
const measurements: ShoppingMeasurement[] = [];
export function shoppingMeasurement(value: Omit<ShoppingMeasurement, "at">) {
  measurements.push({
    ...value,
    ms: Math.round(value.ms * 10) / 10,
    at: Date.now(),
  });
  if (measurements.length > 80) measurements.shift();
}
export function shoppingMeasurements() {
  return measurements.slice();
}
// Development-only, numeric diagnostics for simulator/browser QA; absent from release builds.
if (__DEV__) {
  (
    globalThis as typeof globalThis & {
      __dripgramShoppingTimings?: typeof shoppingMeasurements;
    }
  ).__dripgramShoppingTimings = shoppingMeasurements;
}
