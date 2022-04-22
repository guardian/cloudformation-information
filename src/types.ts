import type { Stack } from "@aws-sdk/client-cloudformation";

export type StackName = string;

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

export type LogicalId = string;

export interface CloudFormationTemplate {
  Parameters?: Record<string, Parameter>;
  Resources: Record<LogicalId, Resource>;
}

export const EMPTY_CLOUDFORMATION_TEMPLATE: CloudFormationTemplate = {
  Resources: {},
};

export interface StackMetadata extends Stack {
  Profile: string;
  Region: string;
  Template: CloudFormationTemplate;
}

export interface ResourceTypeReport {
  ResourceType: string;
  FollowsBestPractice?: boolean;
}

export interface StackMetadataForCsv extends StackMetadata {
  ReportTime: Date;
  ResourceTypes: ResourceTypeReport[];
  DefinedWithGuCDK: boolean;
  GuCDKVersion?: string;
}

export interface SecurityGroupIngressRule {
  IpProtocol: "tcp" | "udp" | "icmp";
  FromPort: number;
  ToPort: number;
}

export interface SecurityGroupProperties extends ResourceProperties {
  SecurityGroupIngress?: SecurityGroupIngressRule[];
}
