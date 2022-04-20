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

export interface StackMetadata
  extends Pick<Stack, "StackId" | "StackName" | "StackStatus" | "CreationTime" | "LastUpdatedTime"> {
  Profile: string;
  Region: string;
  Template?: CloudFormationTemplate;
}

export interface StackInfo extends StackMetadata {
  ResourceTypes: string[];
  DefinedWithGuCDK: boolean;
  GuCDKVersion?: string;
}

export interface StackInfoForCsv extends Omit<StackInfo, "Template"> {
  ReportTime: Date;
}

export const StackInfoForCsv = {
  fromStackInfo(
    reportTime: Date,
    {
      StackId,
      StackName,
      StackStatus,
      CreationTime,
      LastUpdatedTime,
      Profile,
      Region,
      ResourceTypes,
      DefinedWithGuCDK,
      GuCDKVersion,
    }: StackInfo
  ): StackInfoForCsv {
    return {
      ReportTime: reportTime,
      StackId,
      StackName,
      StackStatus,
      CreationTime,
      LastUpdatedTime,
      Profile,
      Region,
      ResourceTypes,
      DefinedWithGuCDK,
      GuCDKVersion,
    };
  },
};
