import * as assert from "node:assert/strict";
import {
  buildDiffInput,
  DIFF_TRUNCATION_MARKER
} from "../../shared/diffInputBuilder";

suite("diff input builder", () => {
  test("returns empty for budget zero and empty sections", () => {
    assert.equal(buildDiffInput([{ label: "Staged", content: "x" }], 0), "");
    assert.equal(buildDiffInput([{ label: "Staged", content: "" }], 100), "");
  });

  test("does not mutate its input", () => {
    const sections = [{ label: "Staged", content: "  value  " }];
    buildDiffInput(sections, 100);
    assert.equal(sections[0].content, "  value  ");
  });

  test("reuses a short section's unused budget", () => {
    const long = "x".repeat(1000);
    const result = buildDiffInput(
      [
        { label: "Staged", content: "short" },
        { label: "Unstaged", content: long }
      ],
      240
    );
    assert.ok(result.includes("short"));
    assert.ok(result.match(/x/g)!.length > 100);
    assert.ok(result.length <= 240);
    assert.ok(result.endsWith(DIFF_TRUNCATION_MARKER));
  });

  test("preserves headers from multiple files before body", () => {
    const result = buildDiffInput([{ label: "Staged", content: multiFileDiff() }], 340);
    assert.match(result, /a\/first\.txt/u);
    assert.match(result, /a\/second\.txt/u);
    assert.match(result, /@@ -1 \+1 @@/u);
    assert.ok(result.length <= 340);
  });

  test("handles one huge file and Unicode within the budget", () => {
    const diff = `diff --git a/日本語.txt b/日本語.txt\n--- a/日本語.txt\n+++ b/日本語.txt\n@@ -1 +1 @@\n${"変更".repeat(500)}`;
    const result = buildDiffInput([{ content: diff }], 180);
    assert.ok(result.length <= 180);
    assert.match(result, /日本語/u);
  });
});

function multiFileDiff(): string {
  return [
    "diff --git a/first.txt b/first.txt",
    "index 111..222 100644",
    "--- a/first.txt",
    "+++ b/first.txt",
    "@@ -1 +1 @@",
    `-${"old".repeat(80)}`,
    `+${"new".repeat(80)}`,
    "diff --git a/second.txt b/second.txt",
    "index 333..444 100644",
    "--- a/second.txt",
    "+++ b/second.txt",
    "@@ -1 +1 @@",
    "-old",
    "+new"
  ].join("\n");
}
