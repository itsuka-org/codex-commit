import * as vscode from "vscode";
import {
  BRANCH_CREATOR_PLACEHOLDER_DEFAULT,
  BRANCH_CREATOR_SCM_ID,
  BRANCH_CREATOR_SCM_LABEL
} from "./constants";

type BranchCreatorSessionState = {
  visible: boolean;
  placeholder: string;
  value: string;
  targetRepoRoot?: string;
};

export class BranchCreatorSession implements vscode.Disposable {
  private sourceControl: vscode.SourceControl | undefined;
  private state: BranchCreatorSessionState = {
    visible: false,
    placeholder: BRANCH_CREATOR_PLACEHOLDER_DEFAULT,
    value: ""
  };

  constructor(private readonly acceptInputCommand: vscode.Command) {}

  show(placeholder: string, value: string, targetRepoRoot: string): void {
    this.state = {
      visible: true,
      placeholder,
      value,
      targetRepoRoot
    };
    this.applyState();
  }

  hide(): void {
    if (!this.sourceControl) {
      this.state = {
        visible: false,
        placeholder: BRANCH_CREATOR_PLACEHOLDER_DEFAULT,
        value: ""
      };
      return;
    }

    this.state = {
      visible: false,
      placeholder: BRANCH_CREATOR_PLACEHOLDER_DEFAULT,
      value: ""
    };

    const sourceControl = this.sourceControl;
    sourceControl.dispose();
    this.sourceControl = undefined;
  }

  getInputValue(): string {
    return this.sourceControl?.inputBox.value.trim() ?? this.state.value.trim();
  }

  getTargetRepoRoot(): string | undefined {
    return this.state.targetRepoRoot;
  }

  dispose(): void {
    this.hide();
  }

  private applyState(): void {
    const inputBox = this.ensureSourceControl().inputBox;
    inputBox.placeholder = this.state.placeholder;
    inputBox.value = this.state.value;
    inputBox.visible = this.state.visible;
    inputBox.enabled = true;
  }

  private ensureSourceControl(): vscode.SourceControl {
    if (this.sourceControl) {
      return this.sourceControl;
    }

    const sourceControl = vscode.scm.createSourceControl(BRANCH_CREATOR_SCM_ID, BRANCH_CREATOR_SCM_LABEL);
    sourceControl.acceptInputCommand = this.acceptInputCommand;
    sourceControl.inputBox.enabled = true;
    sourceControl.inputBox.visible = false;
    sourceControl.inputBox.placeholder = BRANCH_CREATOR_PLACEHOLDER_DEFAULT;
    this.sourceControl = sourceControl;
    return sourceControl;
  }
}
