import { Config } from "./config";
import { Asg } from "./rules/asg";
import { IamResources } from "./rules/iam";
import { S3Bucket } from "./rules/s3";
import { SecurityGroupResources } from "./rules/security-group";
import type { CloudFormationTemplate, LogicalId, ResourceTypeReport } from "./types";

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

function followsBestPractice(
  template: CloudFormationTemplate,
  validate: (template: CloudFormationTemplate) => Record<LogicalId, boolean>
): boolean {
  return !Object.values(validate(template)).includes(false);
}

export function validateResources(template: CloudFormationTemplate): ResourceTypeReport[] {
  return uniqueTemplateResourceTypes(template).map((resourceType) => {
    switch (resourceType) {
      case SecurityGroupResources.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: followsBestPractice(template, SecurityGroupResources.validate),
        };
      case IamResources.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: followsBestPractice(template, IamResources.validate),
        };
      case Asg.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: followsBestPractice(template, Asg.validate),
        };
      case "AWS::ElasticLoadBalancing::LoadBalancer":
        return {
          ResourceType: resourceType,
          FollowsBestPractice: false,
        };
      case S3Bucket.resourceType:
        return {
          ResourceType: resourceType,
          FollowsBestPractice: followsBestPractice(template, S3Bucket.validate),
        };
      default:
        return {
          ResourceType: resourceType,
        };
    }
  });
}
