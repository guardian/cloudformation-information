import { isDeepStrictEqual } from "util";
import type { CloudFormationTemplate, LogicalId, Resource, ResourceProperties, ResourceRule } from "../types";
import { getResourcesByType } from "../util";

interface PublicAccessBlockConfiguration {
  BlockPublicAcls?: boolean;
  BlockPublicPolicy?: boolean;
  IgnorePublicAcls?: boolean;
  RestrictPublicBuckets?: boolean;
}

const strictlyPrivateBucket: PublicAccessBlockConfiguration = {
  BlockPublicAcls: true,
  BlockPublicPolicy: true,
  IgnorePublicAcls: true,
  RestrictPublicBuckets: true,
};

interface S3BucketProperties extends ResourceProperties {
  PublicAccessBlockConfiguration?: PublicAccessBlockConfiguration;
}

function isBucketPrivate(resource: Resource): boolean {
  if (!resource.Properties) {
    return false;
  }

  const props = resource.Properties as S3BucketProperties;
  return isDeepStrictEqual(props.PublicAccessBlockConfiguration, strictlyPrivateBucket);
}

function isBucketRetained(resource: Resource): boolean {
  const { DeletionPolicy, UpdateReplacePolicy } = resource;
  return DeletionPolicy === "Retain" && UpdateReplacePolicy === "Retain";
}

export const S3Bucket: ResourceRule = {
  resourceType: "AWS::S3::Bucket",

  validate(template: CloudFormationTemplate): Record<LogicalId, boolean> {
    const resources = getResourcesByType(S3Bucket.resourceType, template);

    return Object.entries(resources).reduce((acc, [logicalId, resource]) => {
      return {
        ...acc,
        [logicalId]: isBucketRetained(resource) && isBucketPrivate(resource),
      };
    }, {});
  },
};
