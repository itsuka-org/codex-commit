export type ConfigurationInspection<T> = {
  defaultValue?: T;
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  defaultLanguageValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
};

export type InspectableConfiguration = {
  get<T>(section: string, defaultValue: T): T;
  inspect<T>(section: string): ConfigurationInspection<T> | undefined;
};

export function readMigratedSetting<T>(
  config: InspectableConfiguration,
  currentKey: string,
  legacyKey: string,
  fallback: T
): T {
  const current = config.inspect<T>(currentKey);
  if (hasExplicitConfigurationValue(current)) {
    return config.get<T>(currentKey, fallback);
  }

  const legacy = config.inspect<T>(legacyKey);
  if (hasExplicitConfigurationValue(legacy)) {
    return config.get<T>(legacyKey, fallback);
  }

  return config.get<T>(currentKey, fallback);
}

export function hasExplicitConfigurationValue<T>(inspection: ConfigurationInspection<T> | undefined): boolean {
  if (!inspection) {
    return false;
  }
  return [
    inspection.globalValue,
    inspection.workspaceValue,
    inspection.workspaceFolderValue,
    inspection.globalLanguageValue,
    inspection.workspaceLanguageValue,
    inspection.workspaceFolderLanguageValue
  ].some(value => value !== undefined);
}
