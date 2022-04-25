import { Config } from "./config";
import { validate as validateIam } from "./rules/iam";
import { validate as validateSecurityGroups } from "./rules/security-group";
import type { CloudFormationTemplate, ResourceTypeReport } from "./types";

export function uniqueTemplateResourceTypes({ Resources }: CloudFormationTemplate): string[] {
  return Array.from(new Set(Object.values(Resources).map((_) => _.Type)));
}

export function isStackDefinedWithGuCDK({ Resources }: CloudFormationTemplate): boolean {
  return Object.values(Resources)
    .flatMap((resource) => resource.Properties)
    .flatMap((properties) => properties?.Tags ?? [])
    .some((tag) => tag.Key === Config.GU_CDK_TAG);
}

export function guCDKVersion({ Resources }: CloudFormationTemplate): string | undefined {
  const guCDKTag = Object.values(Resources)
    .flatMap((resource) => resource.Properties)
    .flatMap((properties) => properties?.Tags ?? [])
    .find((tag) => tag.Key === Config.GU_CDK_TAG);

  return guCDKTag ? guCDKTag.Value : undefined;
}

export function validateResources(template: CloudFormationTemplate): ResourceTypeReport[] {
  return uniqueTemplateResourceTypes(template).map((resourceType) => {
    switch (resourceType) {
      case "AWS::EC2::SecurityGroup":
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(validateSecurityGroups(template))).has(false),
        };
      case "AWS::IAM::Policy":
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(validateIam(template))).has(false),
        };
      default:
        return {
          ResourceType: resourceType,
        };
    }
  });
}
