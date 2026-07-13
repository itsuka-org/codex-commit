export function forwardAbortSignal(source: AbortSignal, target: AbortController): () => void {
  if (source.aborted) {
    target.abort();
    return () => undefined;
  }

  const abort = () => target.abort();
  source.addEventListener("abort", abort, { once: true });
  return () => source.removeEventListener("abort", abort);
}
