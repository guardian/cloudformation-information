import type { CloudFormationTemplate, LogicalId, Resource, ResourceProperties, ResourceRule } from "../types";
import { getResourcesByType } from "../util";

interface SecurityGroupIngressRule {
  IpProtocol: "tcp" | "udp" | "icmp";
  FromPort: number;
  ToPort: number;
}

interface SecurityGroupProperties extends ResourceProperties {
  SecurityGroupIngress?: SecurityGroupIngressRule[];
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

export const SecurityGroupResources: ResourceRule = {
  resourceType: "AWS::EC2::SecurityGroup",

  validate(template: CloudFormationTemplate): Record<LogicalId, boolean> {
    const securityGroups = getResourcesByType(SecurityGroupResources.resourceType, template);

    return Object.entries(securityGroups).reduce((acc, [logicalId, sg]) => {
      return {
        ...acc,
        [logicalId]: isSshBlocked(sg),
      };
    }, {});
  },
};
