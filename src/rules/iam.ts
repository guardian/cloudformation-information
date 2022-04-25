import type { CloudFormationTemplate, LogicalId, Resource, ResourceProperties } from "../types";
import { getResourcesByType } from "../util";

interface IamStatement {
  Action: string | string[];
  Effect: "Allow" | "Deny";
  Resource: string;
}

interface IamProperties extends ResourceProperties {
  PolicyDocument?: {
    Statement: IamStatement | IamStatement[];
  };
}

function hasNoStarActions(resource: Resource): boolean {
  if (!resource.Properties) {
    return true;
  }

  const iamProperties = resource.Properties as IamProperties;

  if (!iamProperties.PolicyDocument) {
    return true;
  }

  try {
    if (Array.isArray(iamProperties.PolicyDocument.Statement)) {
      return !iamProperties.PolicyDocument.Statement.some((statement) => statement.Action.includes("*"));
    } else {
      return iamProperties.PolicyDocument.Statement.Action.includes("*");
    }
  } catch (e) {
    return false;
  }
}

export function validate(template: CloudFormationTemplate): Record<LogicalId, boolean> {
  const resources = getResourcesByType("AWS::IAM::Policy", template);

  return Object.entries(resources).reduce((acc, [logicalId, resource]) => {
    return {
      ...acc,
      [logicalId]: hasNoStarActions(resource),
    };
  }, {});
}
