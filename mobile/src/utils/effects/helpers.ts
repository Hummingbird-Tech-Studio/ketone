import { Effect, Fiber, Stream } from 'effect';

/**
 * Bridge an Effect's success/error channels to UI callbacks.
 * Returns a cleanup function that interrupts the fiber.
 *
 * Generic over:
 *   • A – success value
 *   • E – error value  (inferred from `eff`)
 *
 * Works for any `Effect` whose environment is already satisfied (`R = never`).
 */
export function runWithUi<A, E>(
  eff: Effect.Effect<A, E>,
  onSuccess: (value: A) => void,
  onFailure: (error: E) => void,
): () => void {
  const fiber = Effect.runFork(
    eff.pipe(
      Effect.matchEffect({
        onSuccess: (value) => Effect.sync(() => onSuccess(value)),
        onFailure: (err) => Effect.sync(() => onFailure(err)),
      }),
    ),
  );

  return () => {
    Effect.runFork(Fiber.interruptFork(fiber));
  };
}

/**
 * Execute an `Effect` that *yields* a `Stream`, push every chunk to `onData`,
 * send domain errors to `onError`, and return a `cancel` function that
 * interrupts the fibre (which in turn runs the stream's finalizer).
 */
export function runStreamWithUi<A, E>(
  streamEff: Effect.Effect<Stream.Stream<A, E>, E>,
  onData: (data: A) => void,
  onError: (error: E) => void,
): () => void {
  const fiber = Effect.runFork(
    streamEff.pipe(
      Effect.flatMap((str) => {
        return Stream.runForEach(str, (a) => {
          return Effect.sync(() => onData(a));
        });
      }),
      Effect.catchAll((err) => {
        return Effect.sync(() => onError(err));
      }),
    ),
  );

  return () => {
    Effect.runFork(Fiber.interruptFork(fiber));
  };
}
