import * as vscode from "vscode";

export type ProgressRequest = {
  title: string;
  cancellable?: boolean;
};

export interface UiAdapter {
  showInformationMessage(message: string): void;
  showWarningMessage(message: string): void;
  showErrorMessage(message: string): void;
  executeCommand(command: string): Promise<unknown>;
  withProgress<T>(request: ProgressRequest, task: (signal: AbortSignal) => Promise<T>): Promise<T>;
}

export class VscodeUiAdapter implements UiAdapter {
  showInformationMessage(message: string): void {
    void vscode.window.showInformationMessage(message);
  }

  showWarningMessage(message: string): void {
    void vscode.window.showWarningMessage(message);
  }

  showErrorMessage(message: string): void {
    void vscode.window.showErrorMessage(message);
  }

  executeCommand(command: string): Promise<unknown> {
    return Promise.resolve(vscode.commands.executeCommand(command));
  }

  withProgress<T>(request: ProgressRequest, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return Promise.resolve(vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: request.title,
        cancellable: request.cancellable ?? false
      },
      async (_progress, token) => {
        const abortController = new AbortController();
        const cancellation = token.onCancellationRequested(() => abortController.abort());
        try {
          return await task(abortController.signal);
        } finally {
          cancellation.dispose();
        }
      }
    ));
  }
}
