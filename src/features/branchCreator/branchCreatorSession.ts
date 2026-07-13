import * as vscode from "vscode";
import {
  BRANCH_CREATOR_PLACEHOLDER_DEFAULT,
  BRANCH_CREATOR_SCM_ID,
  BRANCH_CREATOR_SCM_LABEL
} from "./constants";

export interface BranchCreatorSessionPort {
  show(placeholder: string, value: string, targetRepoUri: vscode.Uri): void;
  hide(): void;
  getInputValue(): string;
  getTargetRepoUri(): vscode.Uri | undefined;
}

export class BranchCreatorSession implements vscode.Disposable, BranchCreatorSessionPort {
  private sourceControl: vscode.SourceControl | undefined;
  private targetRepoUri: vscode.Uri | undefined;

  constructor(private readonly acceptInputCommand: vscode.Command) {}

  show(placeholder: string, value: string, targetRepoUri: vscode.Uri): void {
    const inputBox = this.ensureSourceControl(targetRepoUri).inputBox;
    this.targetRepoUri = targetRepoUri;
    inputBox.placeholder = placeholder;
    inputBox.value = value;
    inputBox.visible = true;
    inputBox.enabled = true;
  }

  hide(): void {
    this.sourceControl?.dispose();
    this.sourceControl = undefined;
    this.targetRepoUri = undefined;
  }

  getInputValue(): string {
    return this.sourceControl?.inputBox.value.trim() ?? "";
  }

  getTargetRepoUri(): vscode.Uri | undefined {
    return this.targetRepoUri;
  }

  dispose(): void {
    this.hide();
  }

  private ensureSourceControl(rootUri: vscode.Uri): vscode.SourceControl {
    if (this.sourceControl && this.sourceControl.rootUri?.toString() === rootUri.toString()) {
      return this.sourceControl;
    }

    this.sourceControl?.dispose();
    const sourceControl = vscode.scm.createSourceControl(
      BRANCH_CREATOR_SCM_ID,
      BRANCH_CREATOR_SCM_LABEL,
      rootUri
    );
    sourceControl.acceptInputCommand = this.acceptInputCommand;
    sourceControl.inputBox.enabled = true;
    sourceControl.inputBox.visible = false;
    sourceControl.inputBox.placeholder = BRANCH_CREATOR_PLACEHOLDER_DEFAULT;
    this.sourceControl = sourceControl;
    return sourceControl;
  }
}
