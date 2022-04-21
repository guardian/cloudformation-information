import { existsSync, mkdirSync, rmSync } from "fs";
import { yamlParse } from "yaml-cfn";
import type { CloudFormationTemplate } from "./types";

export function ensureCleanDirectory(name: string) {
  if (existsSync(name)) {
    console.log(`Removing pre-existing directory ${name}`);
    rmSync(name, { recursive: true });
  }
  console.log(`Creating directory ${name}`);
  mkdirSync(name, { recursive: true });
}

/**
 * Convert a string to `CloudFormationTemplate`.
 * Attempts to read string as JSON then YAML.
 *
 * Can throw if the YAML template does not match the CFN schema, e.g. there are duplicated properties.
 * See https://github.com/guardian/payment-api/pull/209
 */
export function stringToCloudFormationTemplate(template: string): CloudFormationTemplate {
  try {
    return JSON.parse(template) as CloudFormationTemplate;
  } catch (err) {
    return yamlParse(template) as CloudFormationTemplate;
  }
}
