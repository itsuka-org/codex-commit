import { spawn } from "child_process";
import { summarizeErrorOutput } from "../../shared/errorOutput";
import { CommandResult } from "../../shared/process";

export class GitClient {
  async createBranch(name: string, repoRoot: string): Promise<void> {
    const branchName = name.trim();
    if (!branchName) {
      throw new Error("Branch name cannot be empty.");
    }

    const checkResult = await this.run(["check-ref-format", "--branch", branchName], repoRoot);
    if (checkResult.error) {
      throw new Error(`git check-ref-format failed: ${checkResult.error}`);
    }
    if (checkResult.code !== 0) {
      throw new Error(`Invalid branch name: ${summarizeErrorOutput((checkResult.stderr || checkResult.stdout).trim())}`);
    }

    const createResult = await this.run(["checkout", "-b", branchName], repoRoot);
    if (createResult.error) {
      throw new Error(`git checkout -b failed: ${createResult.error}`);
    }
    if (createResult.code !== 0) {
      throw new Error(`Failed to create branch: ${summarizeErrorOutput((createResult.stderr || createResult.stdout).trim())}`);
    }
  }

  private run(args: string[], cwd: string): Promise<CommandResult> {
    return new Promise(resolve => {
      const child = spawn("git", args, { stdio: "pipe", cwd });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });
      child.on("error", err => {
        resolve({ code: null, stdout: "", stderr: "", error: err.message });
      });
      child.on("close", code => {
        resolve({ code, stdout, stderr });
      });
    });
  }
}
