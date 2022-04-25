import { existsSync, mkdirSync, rmSync } from "fs";
import { yamlParse } from "yaml-cfn";
import type { CloudFormationTemplate, LogicalId, Resource } from "./types";
import { EMPTY_CLOUDFORMATION_TEMPLATE } from "./types";

export function ensureCleanDirectory(name: string) {
  if (existsSync(name)) {
    console.debug(`Removing pre-existing directory ${name}`);
    rmSync(name, { recursive: true });
  }
  console.debug(`Creating directory ${name}`);
  mkdirSync(name, { recursive: true });
}

export function stringToCloudFormationTemplate(
  template: string,
  stackName: string,
  profile: string
): CloudFormationTemplate {
  try {
    return JSON.parse(template) as CloudFormationTemplate;
  } catch (err) {
    try {
      return yamlParse(template) as CloudFormationTemplate;
    } catch (err) {
      // Can throw if the YAML template does not match the CFN schema, e.g. there are duplicated properties.
      // See https://github.com/guardian/payment-api/pull/209

      console.error(`[${profile}] Unable to determine a JSON or YAML template for stack ${stackName}`);
      return EMPTY_CLOUDFORMATION_TEMPLATE;
    }
  }
}

export function getResourcesByType(
  resourceType: string,
  { Resources }: CloudFormationTemplate
): Record<LogicalId, Resource> {
  return Object.entries(Resources)
    .filter(([, resource]) => resource.Type === resourceType)
    .reduce((acc, [logicalId, resource]) => ({ ...acc, [logicalId]: resource }), {});
}
