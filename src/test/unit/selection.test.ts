import * as assert from "node:assert/strict";
import { findBestMatchingRepositoryRoot } from "../../features/repositorySelection/pathUtils";
import { selectRepositoryRoot } from "../../features/repositorySelection/selection";

suite("repository selection", () => {
  const main = "/workspace/main";
  const other = "/workspace/other";
  const worktree = "/workspace/main/.worktrees/feature";

  test("returns the only repository", () => {
    assert.equal(selectRepositoryRoot({ repositories: [{ rootPath: main }] }), main);
  });

  test("returns undefined for no repositories", () => {
    assert.equal(selectRepositoryRoot({ repositories: [] }), undefined);
  });

  test("preferred path wins over every fallback", () => {
    assert.equal(
      selectRepositoryRoot({
        repositories: [
          { rootPath: main, selected: true },
          { rootPath: worktree }
        ],
        preferredPath: `${worktree}/src/a.ts`,
        activeEditorPath: `${main}/src/b.ts`
      }),
      worktree
    );
  });

  test("hint wins over selected repository", () => {
    assert.equal(
      selectRepositoryRoot({
        repositories: [
          { rootPath: main, selected: true },
          { rootPath: other }
        ],
        hintedPath: `${other}/src/a.ts`
      }),
      other
    );
  });

  test("uses exactly one selected repository", () => {
    assert.equal(
      selectRepositoryRoot({
        repositories: [
          { rootPath: main, selected: true },
          { rootPath: other }
        ]
      }),
      main
    );
  });

  test("multiple selected repositories fall through to active editor", () => {
    assert.equal(
      selectRepositoryRoot({
        repositories: [
          { rootPath: main, selected: true },
          { rootPath: other, selected: true }
        ],
        activeEditorPath: `${other}/src/a.ts`
      }),
      other
    );
  });

  test("workspace path is used after active editor", () => {
    assert.equal(
      selectRepositoryRoot({
        repositories: [{ rootPath: main }, { rootPath: other }],
        activeEditorPath: "/outside/a.ts",
        workspacePaths: [other]
      }),
      other
    );
  });

  test("falls back to the first repository", () => {
    assert.equal(
      selectRepositoryRoot({ repositories: [{ rootPath: main }, { rootPath: other }] }),
      main
    );
  });

  test("deepest nested worktree wins", () => {
    assert.equal(
      findBestMatchingRepositoryRoot([main, worktree], `${worktree}/src/a.ts`),
      worktree
    );
  });

  test("sibling and parent paths do not match", () => {
    assert.equal(findBestMatchingRepositoryRoot([main], "/workspace/main-copy/a.ts"), undefined);
    assert.equal(findBestMatchingRepositoryRoot([`${main}/nested`], main), undefined);
  });

  test("Windows paths are case insensitive", () => {
    assert.equal(
      findBestMatchingRepositoryRoot(["C:\\Work\\Repo"], "c:\\work\\repo\\src\\a.ts", "win32"),
      "C:\\Work\\Repo"
    );
  });
});
