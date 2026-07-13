import * as assert from "node:assert/strict";
import {
  compareVersions,
  isSupportedCodexVersion,
  parseCodexVersion
} from "../../infrastructure/codex/version";

suite("Codex version policy", () => {
  test("parses codex-cli output, whitespace, and prereleases", () => {
    assert.deepEqual(parseCodexVersion(" codex-cli 0.142.3 \n"), { major: 0, minor: 142, patch: 3, prerelease: undefined });
    assert.deepEqual(parseCodexVersion("0.142.3-beta.1"), { major: 0, minor: 142, patch: 3, prerelease: "beta.1" });
    assert.equal(parseCodexVersion("not a version"), undefined);
  });

  test("compares numeric components rather than strings", () => {
    assert.equal(compareVersions(parseCodexVersion("0.9.0")!, parseCodexVersion("0.10.0")!), -1);
    assert.equal(compareVersions(parseCodexVersion("1.0.0")!, parseCodexVersion("0.999.999")!), 1);
  });

  test("checks the compatibility floor", () => {
    assert.equal(isSupportedCodexVersion(parseCodexVersion("0.142.2")!), false);
    assert.equal(isSupportedCodexVersion(parseCodexVersion("0.142.3-beta.1")!), false);
    assert.equal(isSupportedCodexVersion(parseCodexVersion("0.142.3")!), true);
    assert.equal(isSupportedCodexVersion(parseCodexVersion("0.142.4")!), true);
    assert.equal(isSupportedCodexVersion(parseCodexVersion("0.143.0")!), true);
    assert.equal(isSupportedCodexVersion(parseCodexVersion("1.0.0")!), true);
  });
});
