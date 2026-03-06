import * as vscode from "vscode";

export class OutputLogger implements vscode.Disposable {
  private channel: vscode.OutputChannel | undefined;

  constructor(
    private readonly name: string,
    private readonly isDebugEnabled: () => boolean
  ) {}

  appendLine(message: string): void {
    this.getChannel().appendLine(message);
  }

  clear(): void {
    this.getChannel().clear();
  }

  show(preserveFocus = true): void {
    this.getChannel().show(preserveFocus);
  }

  debug(message: string): void {
    if (!this.isDebugEnabled()) {
      return;
    }

    const timestamp = new Date().toISOString();
    this.getChannel().appendLine(`[debug ${timestamp}] ${message}`);
  }

  dispose(): void {
    this.channel?.dispose();
    this.channel = undefined;
  }

  private getChannel(): vscode.OutputChannel {
    if (!this.channel) {
      this.channel = vscode.window.createOutputChannel(this.name);
    }

    return this.channel;
  }
}
