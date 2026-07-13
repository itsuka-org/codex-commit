import * as assert from "node:assert/strict";
import {
  buildBranchPrompt,
  buildCommitPrompt,
  expandPromptTemplate
} from "../../shared/promptTemplate";

suite("prompt templates", () => {
  test("appends the diff when the token is absent", () => {
    assert.equal(buildCommitPrompt("Instructions", "DIFF"), "Instructions\n\nStaged diff:\nDIFF");
  });

  test("replaces one diff token", () => {
    assert.equal(buildBranchPrompt("Before {{diff}} after", "差分"), "Before 差分 after");
  });

  test("replaces every diff token", () => {
    assert.equal(buildCommitPrompt("{{diff}} / {{diff}}", "D"), "D / D");
  });

  test("empty templates use the fallback header", () => {
    assert.equal(buildBranchPrompt("", "D"), "Diff:\nD");
  });

  test("unknown tokens and Unicode are preserved", () => {
    assert.equal(
      expandPromptTemplate("説明 {{unknown}}\n{{diff}}", { diff: "変更" }, { token: "diff", header: "Diff:" }),
      "説明 {{unknown}}\n変更"
    );
  });
});
