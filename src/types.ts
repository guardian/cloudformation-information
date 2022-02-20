import type { Stack } from "@aws-sdk/client-cloudformation";

export interface Parameter {
  Type: string;
  Description?: string;
  Default?: string | number;
  AllowedValues?: Array<string | number>;
}

export interface ResourceTag {
  Key: string;
  Value: string;
}

export interface ResourceProperties {
  Tags?: ResourceTag[];
}

export interface Resource {
  Type: string;
  Properties?: Record<string, ResourceProperties>;
}

export interface CloudFormationTemplate {
  Parameters?: Record<string, Parameter>;
  Resources: Record<string, Resource>;
}

export interface HydratedStack extends Stack {
  metadata: {
    resourceTypes: string[];
    isDefinedWithGuCDK: boolean;
  };
}