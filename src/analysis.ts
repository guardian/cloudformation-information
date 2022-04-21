import { Config } from "./config";
import type { CloudFormationTemplate } from "./types";

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
