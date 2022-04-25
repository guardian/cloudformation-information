import { Config } from "./config";
import type { LogLevel } from "./types";
import { LOG_LEVELS } from "./types";

export function configure() {
  const shouldLog = (level: LogLevel) => {
    return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(Config.LOG_LEVEL);
  };

  const _console = console;
  global.console = {
    ...global.console,
    log: (message?: unknown, ...optionalParams: unknown[]) => {
      shouldLog("log") && _console.log(message, ...optionalParams);
    },
    warn: (message?: unknown, ...optionalParams: unknown[]) => {
      shouldLog("warn") && _console.warn(message, ...optionalParams);
    },
    error: (message?: unknown, ...optionalParams: unknown[]) => {
      shouldLog("error") && _console.error(message, ...optionalParams);
    },
    debug: (message?: unknown, ...optionalParams: unknown[]) => {
      shouldLog("debug") && _console.debug(message, ...optionalParams);
    },
  };
}
