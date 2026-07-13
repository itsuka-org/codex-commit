import * as assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  ProcessRunner,
  ProcessRunnerError,
  type SpawnFactory
} from "../../infrastructure/process/processRunner";

suite("ProcessRunner", () => {
  test("preserves a UTF-8 character split across chunks", async () => {
    const child = new FakeChild();
    const runner = runnerFor(child);
    const resultPromise = runner.run({ command: "fake" });
    const bytes = Buffer.from("日本語", "utf8");
    child.stdout.write(bytes.subarray(0, 2));
    child.stdout.write(bytes.subarray(2));
    child.close(0);
    const result = await resultPromise;
    assert.equal(result.stdout, "日本語");
  });

  test("settles only once when error and close both fire", async () => {
    const child = new FakeChild();
    const runner = runnerFor(child);
    const resultPromise = runner.run({ command: "missing" });
    child.emit("error", Object.assign(new Error("missing"), { code: "ENOENT" }));
    child.close(1);
    await assert.rejects(resultPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "spawn");
      assert.equal(error.code, "ENOENT");
      return true;
    });
  });

  test("settles after exit when a descendant keeps inherited pipes open", async () => {
    const child = new FakeChild();
    const resultPromise = runnerFor(child).run({ command: "daemonizing" });
    child.stdout.write("complete");
    child.exit(0);

    const result = await resultPromise;
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "complete");
    assert.equal(child.stdout.destroyed, true);
    assert.equal(child.stderr.destroyed, true);
  });

  test("rejects an unavailable stdin before writing", async () => {
    const child = new FakeChild();
    child.stdin.destroy();
    const resultPromise = runnerFor(child).run({ command: "no-stdin", stdin: "prompt" });
    await assert.rejects(resultPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "stdin");
      return true;
    });
    child.close(1);
    assert.deepEqual(child.killSignals, ["SIGTERM"]);
  });

  test("rejects a stdin write error", async () => {
    const child = new FakeChild();
    const resultPromise = runnerFor(child).run({ command: "broken-stdin", stdin: "prompt" });
    child.stdin.emit("error", new Error("broken pipe"));
    await assert.rejects(resultPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "stdin");
      return true;
    });
    child.close(1);
    assert.deepEqual(child.killSignals, ["SIGTERM"]);
  });

  test("stops output that exceeds the configured limit", async () => {
    const child = new FakeChild();
    const runner = runnerFor(child);
    const resultPromise = runner.run({ command: "noisy", maxOutputBytes: 4 });
    child.stdout.write("12345");
    await assert.rejects(resultPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "output_limit");
      return true;
    });
    assert.deepEqual(child.killSignals, ["SIGTERM"]);
  });

  test("distinguishes timeout from cancellation", async () => {
    const timeoutChild = new FakeChild();
    const timeoutPromise = runnerFor(timeoutChild).run({ command: "slow", timeoutMs: 5 });
    await assert.rejects(timeoutPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "timeout");
      return true;
    });

    const cancelChild = new FakeChild();
    const abortController = new AbortController();
    const cancelPromise = runnerFor(cancelChild).run({ command: "slow", signal: abortController.signal });
    abortController.abort();
    await assert.rejects(cancelPromise, (error: unknown) => {
      assert.ok(error instanceof ProcessRunnerError);
      assert.equal(error.kind, "cancelled");
      return true;
    });
  });

  test("dispose terminates every managed child", async () => {
    const first = new FakeChild(true);
    const second = new FakeChild(true);
    const children = [first, second];
    const runner = new ProcessRunner((() => children.shift() as unknown as ChildProcessWithoutNullStreams) as SpawnFactory);
    const firstRun = runner.run({ command: "first" });
    const secondRun = runner.run({ command: "second" });
    runner.dispose();
    await Promise.all([firstRun, secondRun]);
    assert.deepEqual(first.killSignals, ["SIGTERM"]);
    assert.deepEqual(second.killSignals, ["SIGTERM"]);
  });
});

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = new PassThrough();
  readonly killSignals: NodeJS.Signals[] = [];
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  constructor(private readonly closeOnKill = false) {
    super();
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.killSignals.push(signal);
    if (this.closeOnKill) {
      this.signalCode = signal;
      queueMicrotask(() => this.emit("close", null, signal));
    }
    return true;
  }

  close(code: number): void {
    this.exitCode = code;
    this.stdout.end();
    this.stderr.end();
    queueMicrotask(() => this.emit("close", code, null));
  }

  exit(code: number): void {
    this.exitCode = code;
    queueMicrotask(() => this.emit("exit", code, null));
  }
}

function runnerFor(child: FakeChild): ProcessRunner {
  return new ProcessRunner((() => child as unknown as ChildProcessWithoutNullStreams) as SpawnFactory);
}
