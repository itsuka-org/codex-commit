import * as assert from "node:assert/strict";
import {
  hasExplicitConfigurationValue,
  readMigratedSetting,
  type ConfigurationInspection,
  type InspectableConfiguration
} from "../../config/configMigration";

suite("configuration migration", () => {
  test("uses the new default when neither key is explicit", () => {
    assert.equal(read("new-default", undefined, undefined), "new-default");
  });

  test("uses a legacy explicit value when the new key is unset", () => {
    assert.equal(read("new-default", undefined, { workspaceValue: "legacy" }), "legacy");
  });

  test("uses a new explicit value", () => {
    assert.equal(read("new", { globalValue: "new" }, undefined), "new");
  });

  test("new wins when both keys are explicit", () => {
    assert.equal(read("new", { workspaceValue: "new" }, { workspaceValue: "legacy" }), "new");
  });

  test("an explicitly empty new value wins", () => {
    assert.equal(read("", { workspaceFolderValue: "" }, { globalValue: "legacy" }), "");
  });

  test("language override values count as explicit", () => {
    assert.equal(hasExplicitConfigurationValue({ globalLanguageValue: "language" }), true);
    assert.equal(hasExplicitConfigurationValue({ defaultLanguageValue: "default-only" }), false);
  });
});

function read(
  currentValue: string,
  currentInspection: ConfigurationInspection<string> | undefined,
  legacyInspection: ConfigurationInspection<string> | undefined
): string {
  const values = new Map([
    ["current", currentValue],
    ["legacy", legacyInspection?.workspaceValue ?? legacyInspection?.globalValue ?? "legacy"]
  ]);
  const inspections = new Map([
    ["current", currentInspection],
    ["legacy", legacyInspection]
  ]);
  const config: InspectableConfiguration = {
    get: <T>(key: string, fallback: T) => (values.has(key) ? (values.get(key) as T) : fallback),
    inspect: <T>(key: string) => inspections.get(key) as ConfigurationInspection<T> | undefined
  };
  return readMigratedSetting(config, "current", "legacy", "fallback");
}
