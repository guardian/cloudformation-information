import type { Stack } from "@aws-sdk/client-cloudformation";

export const LOG_LEVELS = ["debug", "log", "warn", "error", "off"] as const;
export type LogLevel = typeof LOG_LEVELS[number];

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
  PropagateAtLaunch?: string;
}

export interface ResourceProperties {
  Tags?: ResourceTag[];
}

export interface Resource {
  Type: string;
  Properties?: ResourceProperties;
  DeletionPolicy?: "Delete" | "Retain" | "Snapshot";
  UpdateReplacePolicy?: "Delete" | "Retain" | "Snapshot";
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

export interface ResourceRule {
  /**
   * The CloudFormation resource identifier.
   * @example AWS::S3::Bucket
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html
   */
  resourceType: string;

  /**
   * A function that checks the definition of each resource of type [[resourceType]] against best practices,
   * where `true` signals it best practice is being followed.
   */
  validate: (template: CloudFormationTemplate) => Record<LogicalId, boolean>;
}
