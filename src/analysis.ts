import { Config } from "./config";
import type { CloudFormationTemplate, LogicalId, Resource, ResourceTypeReport, SecurityGroupProperties } from "./types";

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

export function getResourcesByType(
  resourceType: string,
  { Resources }: CloudFormationTemplate
): Record<LogicalId, Resource> {
  return Object.entries(Resources)
    .filter(([, resource]) => resource.Type === resourceType)
    .reduce((acc, [logicalId, resource]) => ({ ...acc, [logicalId]: resource }), {});
}

export function validateResources(template: CloudFormationTemplate): ResourceTypeReport[] {
  return uniqueTemplateResourceTypes(template).map((resourceType) => {
    switch (resourceType) {
      case "AWS::EC2::SecurityGroup":
        return {
          ResourceType: resourceType,
          FollowsBestPractice: !new Set(Object.values(validateSecurityGroups(template))).has(false),
        };
      default:
        return {
          ResourceType: resourceType,
        };
    }
  });
}

function isSshBlocked(resource: Resource): boolean {
  const sshPort = 22;

  if (!resource.Properties) {
    return true;
  }

  const sgProps = resource.Properties as SecurityGroupProperties;

  try {
    const allowsSsh = sgProps.SecurityGroupIngress?.some(
      ({ IpProtocol, FromPort, ToPort }) => IpProtocol === "tcp" && FromPort <= sshPort && ToPort >= sshPort
    );
    return !allowsSsh;
  } catch (e) {
    // `SecurityGroupIngress` uses an intrinsic function (e.g `Fn:If`), we're not modelling these, so return `false` (SSH is _not_ blocked)
    return false;
  }
}

function validateSecurityGroups(template: CloudFormationTemplate): Record<LogicalId, boolean> {
  const securityGroups = getResourcesByType("AWS::EC2::SecurityGroup", template);

  return Object.entries(securityGroups).reduce((acc, [logicalId, sg]) => {
    return {
      ...acc,
      [logicalId]: isSshBlocked(sg),
    };
  }, {});
}
