import { Config } from "./config";
import { Asg } from "./rules/asg";
import { IamResources } from "./rules/iam";
import { SecurityGroupResources } from "./rules/security-group";
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
      case SecurityGroupResources.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(SecurityGroupResources.validate(template))).has(false),
        };
      case IamResources.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(IamResources.validate(template))).has(false),
        };
      case Asg.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(Asg.validate(template))).has(false),
        };
      default:
        return {
          ResourceType: resourceType,
        };
    }
  });
}
