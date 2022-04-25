import type { CloudFormationTemplate, LogicalId, Resource, ResourceProperties, ResourceRule } from "../types";
import { getResourcesByType } from "../util";

interface AsgProperties extends ResourceProperties {
  DesiredCapacity?: unknown;
}

function isDesiredCapacitySet(resource: Resource): boolean {
  if (!resource.Properties) {
    return false;
  }

  const properties = resource.Properties as AsgProperties;
  return !!properties.DesiredCapacity;
}

function areTagsPropagated(resource: Resource): boolean {
  if (!resource.Properties) {
    return false;
  }

  const tags = resource.Properties.Tags;

  if (!tags || tags.length === 0) {
    return false;
  }

  return tags.filter((tag) => !!tag.PropagateAtLaunch).length > 0;
}

export const Asg: ResourceRule = {
  resourceType: "AWS::AutoScaling::AutoScalingGroup",

  validate(template: CloudFormationTemplate): Record<LogicalId, boolean> {
    const resources = getResourcesByType(Asg.resourceType, template);

    return Object.entries(resources).reduce((acc, [logicalId, resource]) => {
      return {
        ...acc,
        [logicalId]: !isDesiredCapacitySet(resource) && areTagsPropagated(resource),
      };
    }, {});
  },
};
