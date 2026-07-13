import * as assert from "node:assert/strict";
import { access, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import {
  buildCodexEnvironment,
  buildCodexExecArgs,
  CodexClient,
  type ProcessRunnerPort
} from "../../infrastructure/codex/codexClient";
import {
  ProcessRunnerError,
  type ProcessResult,
  type ProcessRunOptions
} from "../../infrastructure/process/processRunner";

suite("CodexClient", () => {
  test("builds a read-only ephemeral command without legacy flags", () => {
    const args = buildCodexExecArgs(config({ model: "gpt-test", effort: "high" }), "/tmp/result");
    assert.deepEqual(args, [
      "exec",
      "--model",
      "gpt-test",
      "-c",
      "model_reasoning_effort=\"high\"",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--output-last-message",
      "/tmp/result",
      "--color",
      "never",
      "-"
    ]);
  });

  test("aliases OPENAI_API_KEY without overwriting CODEX_API_KEY", () => {
    assert.equal(buildCodexEnvironment({ OPENAI_API_KEY: "openai" }).CODEX_API_KEY, "openai");
    assert.equal(
      buildCodexEnvironment({ OPENAI_API_KEY: "openai", CODEX_API_KEY: "codex" }).CODEX_API_KEY,
      "codex"
    );
  });

  test("reads only the output-last-message file and cleans its directory", async () => {
    let outputPath = "";
    const runner = new FakeRunner(async options => {
      if (options.args?.[0] === "--version") {
        return result("codex-cli 0.142.3\n");
      }
      outputPath = options.args![options.args!.indexOf("--output-last-message") + 1];
      await writeFile(outputPath, "feat: generated\n", "utf8");
      return result("diagnostic stdout");
    });
    const client = createClient(runner);
    assert.equal(await client.run("prompt", "/repo"), "feat: generated");
    await assert.rejects(access(dirname(outputPath)));
  });

  test("does not start exec for an unsupported version", async () => {
    const runner = new FakeRunner(async () => result("codex-cli 0.142.2\n"));
    const client = createClient(runner);
    await assert.rejects(client.run("prompt", "/repo"), /0\.142\.3 or newer.*0\.142\.2/u);
    assert.equal(runner.calls.length, 1);
    assert.deepEqual(runner.calls[0].args, ["--version"]);
  });

  test("reports command not found from the version check", async () => {
    const runner = new FakeRunner(async () => {
      throw new ProcessRunnerError("spawn", "missing", "ENOENT");
    });
    await assert.rejects(createClient(runner).run("prompt", "/repo"), /extension host environment/u);
    assert.equal(runner.calls.length, 1);
    assert.deepEqual(runner.calls[0].args, ["--version"]);
  });

  test("adds a WSL-specific hint only for a WSL extension host", async () => {
    const runner = new FakeRunner(async () => {
      throw new ProcessRunnerError("spawn", "missing", "ENOENT");
    });

    await assert.rejects(createClient(runner, "wsl").run("prompt", "/repo"), /Install it in WSL/u);
  });

  test("caches version checks per executable path", async () => {
    let currentConfig = config();
    const runner = new FakeRunner(async options => {
      if (options.args?.[0] === "--version") {
        return result("codex-cli 0.142.4\n");
      }
      const outputPath = options.args![options.args!.indexOf("--output-last-message") + 1];
      await writeFile(outputPath, "ok", "utf8");
      return result();
    });
    const client = new CodexClient({ debug: () => undefined }, runner, {
      getConfig: () => currentConfig,
      environment: {}
    });
    await client.run("one", "/repo");
    await client.run("two", "/repo");
    currentConfig = config({ codexPath: "/opt/codex" });
    await client.run("three", "/repo");
    assert.equal(runner.calls.filter(call => call.args?.[0] === "--version").length, 2);
  });

  test("classifies authentication failure for WSL", async () => {
    const runner = new FakeRunner(async options =>
      options.args?.[0] === "--version"
        ? result("codex-cli 0.142.3")
        : { ...result(), code: 1, stderr: "Missing credentials" }
    );
    const client = createClient(runner, "wsl");
    await assert.rejects(client.run("prompt", "/repo"), /authentication failed.*in WSL/u);
  });

  test("reports missing and empty final output", async () => {
    const missingRunner = new FakeRunner(async options => {
      if (options.args?.[0] === "--version") {
        return result("codex-cli 0.142.3");
      }
      const outputPath = options.args![options.args!.indexOf("--output-last-message") + 1];
      await rm(outputPath);
      return result();
    });
    await assert.rejects(createClient(missingRunner).run("prompt", "/repo"), /did not create/u);

    const emptyRunner = new FakeRunner(async options =>
      options.args?.[0] === "--version" ? result("codex-cli 0.142.3") : result()
    );
    await assert.rejects(createClient(emptyRunner).run("prompt", "/repo"), /empty final message/u);
  });
});

class FakeRunner implements ProcessRunnerPort {
  readonly calls: ProcessRunOptions[] = [];

  constructor(private readonly handler: (options: ProcessRunOptions) => Promise<ProcessResult>) {}

  run(options: ProcessRunOptions): Promise<ProcessResult> {
    this.calls.push(options);
    return this.handler(options);
  }
}

function result(stdout = ""): ProcessResult {
  return { code: 0, signal: null, stdout, stderr: "" };
}

function config(overrides: Partial<CodexCommitConfig> = {}): CodexCommitConfig {
  return {
    commitMessagePromptTemplate: "{{diff}}",
    branchNamePromptTemplate: "{{diff}}",
    debugLog: false,
    ...overrides
  };
}

function createClient(runner: ProcessRunnerPort, remoteName?: string): CodexClient {
  return new CodexClient({ debug: () => undefined }, runner, {
    getConfig: () => config(),
    getRemoteName: () => remoteName,
    environment: {}
  });
}
