import { defineConfig } from "@vscode/test-cli";

const common = {
  files: "out/test/extension/**/*.test.js",
  workspaceFolder: `${process.cwd()}/src/test/fixtures/workspace`,
  mocha: {
    timeout: 20_000
  }
};

export default defineConfig([
  {
    ...common,
    label: "min",
    version: "1.109.0"
  },
  {
    ...common,
    label: "stable",
    version: "stable"
  }
]);
