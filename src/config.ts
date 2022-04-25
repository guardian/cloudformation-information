import path from "path";
import type { LogLevel } from "./types";
import { LOG_LEVELS } from "./types";

const outputDir = path.join(__dirname, "..", "output");

const [, , ...args] = process.argv;

function getLogLevel(): LogLevel {
  const defaultLogLevel: LogLevel = "log";

  const logArg = args.find((arg) => arg.startsWith("--log-level="));

  if (!logArg) {
    return defaultLogLevel;
  }

  const [, level] = logArg.split("=");
  return LOG_LEVELS.includes(level as LogLevel) ? (level as LogLevel) : defaultLogLevel;
}

export const Config = {
  PREFER_CACHE: args.includes("--prefer-cache"),
  LOG_LEVEL: getLogLevel(),
  GU_CDK_TAG: "gu:cdk:version",
  SDK_MAX_ATTEMPTS: 10,
  CSV_OUTPUT_DIR: path.join(outputDir, "data"),
  TEMPLATE_OUTPUT_DIR: path.join(outputDir, "templates"),
  ORIGINAL_TEMPLATE_OUTPUT_DIR: path.join(outputDir, "original-templates"),
  AWS_REGIONS: ["eu-west-1", "us-east-1", "us-west-1"],
  AWS_PROFILES: [
    "deployTools",
    "capi",
    "cmsFronts",
    "composer",
    "developerPlayground",
    "media-service",
    "discussion",
    "frontend",
    "workflow",
    "baton",
    "dataTech",
    "domains",
    "identity",
    "investigations",
    "security",
    "membership",
    "mobile",
    "ophan",
    "targeting",
    "root",
    "interactives",
    "multimedia",
    "dataScience",
    "dc3",
    "editorialSystemsDevelopment",
    "esd",
    "glabs",
    "infosec",
    "network",
    "printSites",
    "usInteractives",
    "websysGeneralDev",
    "websysGeneralProd",
  ],
};
