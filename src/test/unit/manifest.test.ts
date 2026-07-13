import * as assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COMMAND_IDS } from "../../shared/commands";

suite("extension manifest", () => {
  test("manifest and TypeScript command IDs match", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as {
      contributes: { commands: Array<{ command: string }>; configuration: { properties: Record<string, { order: number }> } };
      activationEvents?: unknown;
      contributesKeybindings?: unknown;
    };
    assert.deepEqual(
      manifest.contributes.commands.map(command => command.command).sort(),
      [...COMMAND_IDS].sort()
    );
    assert.equal(manifest.activationEvents, undefined);
  });

  test("settings expose only the six current IDs in explicit order", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as {
      contributes: {
        configuration: { properties: Record<string, { order: number; scope: string }> };
        keybindings?: unknown;
      };
    };
    assert.deepEqual(
      Object.entries(manifest.contributes.configuration.properties).map(([id, value]) => [id, value.order]),
      [
        ["codexCommit.model", 10],
        ["codexCommit.effort", 20],
        ["codexCommit.commitMessagePromptTemplate", 30],
        ["codexCommit.branchNamePromptTemplate", 40],
        ["codexCommit.codexPath", 50],
        ["codexCommit.debugLog", 60]
      ]
    );
    assert.ok(
      Object.values(manifest.contributes.configuration.properties).every(value => value.scope === "resource")
    );
    assert.equal(manifest.contributes.keybindings, undefined);
  });
});
