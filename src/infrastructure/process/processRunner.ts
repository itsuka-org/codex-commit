import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";

export type ProcessRunOptions = {
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
};

export type ProcessResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export type ProcessFailureKind = "spawn" | "stdin" | "timeout" | "cancelled" | "output_limit" | "disposed";

export class ProcessRunnerError extends Error {
  constructor(
    readonly kind: ProcessFailureKind,
    message: string,
    readonly code?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ProcessRunnerError";
  }
}

export type SpawnFactory = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;
const FORCE_KILL_GRACE_MS = 1_000;
const EXIT_STREAM_DRAIN_GRACE_MS = 250;

export class ProcessRunner {
  private readonly children = new Map<ChildProcessWithoutNullStreams, NodeJS.Timeout | undefined>();
  private disposed = false;

  constructor(private readonly spawnProcess: SpawnFactory = spawn as SpawnFactory) {}

  run(options: ProcessRunOptions): Promise<ProcessResult> {
    if (this.disposed) {
      return Promise.reject(new ProcessRunnerError("disposed", "Process runner has been disposed."));
    }
    if (options.signal?.aborted) {
      return Promise.reject(new ProcessRunnerError("cancelled", "Process was cancelled."));
    }

    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = this.spawnProcess(options.command, [...(options.args ?? [])], {
          cwd: options.cwd,
          env: options.env,
          stdio: "pipe",
          windowsHide: true
        });
      } catch (error) {
        const code = getErrorCode(error);
        reject(new ProcessRunnerError("spawn", `Failed to start ${options.command}.`, code, { cause: error }));
        return;
      }

      this.children.set(child, undefined);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");

      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let settled = false;
      let exitDrainTimer: NodeJS.Timeout | undefined;
      const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
      const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const cleanupRequestListeners = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        if (exitDrainTimer) {
          clearTimeout(exitDrainTimer);
        }
        options.signal?.removeEventListener("abort", onAbort);
      };
      const settleResolve = (result: ProcessResult) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanupRequestListeners();
        resolve(result);
      };
      const settleReject = (error: ProcessRunnerError) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanupRequestListeners();
        reject(error);
      };
      const terminate = () => this.terminateChild(child);
      const onData = (stream: "stdout" | "stderr", chunk: string | Buffer) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        outputBytes += Buffer.byteLength(text, "utf8");
        if (outputBytes > maxOutputBytes) {
          terminate();
          settleReject(
            new ProcessRunnerError("output_limit", `Process output exceeded ${maxOutputBytes} bytes.`)
          );
          return;
        }
        if (stream === "stdout") {
          stdout += text;
        } else {
          stderr += text;
        }
      };
      const onAbort = () => {
        terminate();
        settleReject(new ProcessRunnerError("cancelled", "Process was cancelled."));
      };
      const timeout = timeoutMs > 0
        ? setTimeout(() => {
            terminate();
            settleReject(new ProcessRunnerError("timeout", `Process timed out after ${timeoutMs} ms.`));
          }, timeoutMs)
        : undefined;

      child.stdout.on("data", chunk => onData("stdout", chunk));
      child.stderr.on("data", chunk => onData("stderr", chunk));
      child.once("error", error => {
        const code = getErrorCode(error);
        settleReject(new ProcessRunnerError("spawn", `Failed to run ${options.command}.`, code, { cause: error }));
      });
      child.once("exit", (code, signal) => {
        if (settled) {
          destroyProcessStreams(child);
          this.releaseChild(child);
          return;
        }
        exitDrainTimer = setTimeout(() => {
          destroyProcessStreams(child);
          this.releaseChild(child);
          settleResolve({ code, signal, stdout, stderr });
        }, EXIT_STREAM_DRAIN_GRACE_MS);
        exitDrainTimer.unref();
      });
      child.once("close", (code, signal) => {
        this.releaseChild(child);
        settleResolve({ code, signal, stdout, stderr });
      });
      child.stdin.once("error", error => {
        terminate();
        settleReject(new ProcessRunnerError("stdin", `Failed to write to ${options.command} stdin.`, undefined, {
          cause: error
        }));
      });
      options.signal?.addEventListener("abort", onAbort, { once: true });

      if (!child.stdin.writable) {
        terminate();
        settleReject(new ProcessRunnerError("stdin", `The ${options.command} process has no writable stdin.`));
        return;
      }

      child.stdin.end(options.stdin ?? "");
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const child of this.children.keys()) {
      this.terminateChild(child);
    }
  }

  private terminateChild(child: ChildProcessWithoutNullStreams): void {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    const currentTimer = this.children.get(child);
    if (currentTimer) {
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      // A close/error event owns final cleanup when the process is already gone.
    }
    const forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // Best-effort cleanup during shutdown.
        }
      }
    }, FORCE_KILL_GRACE_MS);
    forceKillTimer.unref();
    this.children.set(child, forceKillTimer);
  }

  private releaseChild(child: ChildProcessWithoutNullStreams): void {
    const forceKillTimer = this.children.get(child);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
    this.children.delete(child);
  }
}

function destroyProcessStreams(child: ChildProcessWithoutNullStreams): void {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}
