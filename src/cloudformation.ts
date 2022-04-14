import { writeFile } from "fs/promises";
import path from "path";
import type { Stack } from "@aws-sdk/client-cloudformation";
import {
  CloudFormationClient,
  GetTemplateCommand,
  paginateDescribeStacks,
  StackStatus,
} from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { yamlParse } from "yaml-cfn";
import { Config } from "./config";
import type { CloudFormationTemplate, StackInfo, StackMetadata } from "./types";

export class CloudFormationInformation {
  private readonly profile: string;
  private readonly client: CloudFormationClient;
  private readonly templateDir: string;

  constructor(profile: string, region: string, templateDir: string) {
    this.profile = profile;
    this.templateDir = templateDir;

    this.client = new CloudFormationClient({
      region,
      maxAttempts: Config.SDK_MAX_ATTEMPTS,
      credentials: fromIni({ profile }),
    });
  }

  private async getStacks(): Promise<StackMetadata[]> {
    const paginator = paginateDescribeStacks({ client: this.client, pageSize: 10 }, {});

    const stacks: Array<Promise<StackMetadata>> = [];

    for await (const page of paginator) {
      if (page.Stacks) {
        stacks.push(
          ...page.Stacks.map(async (stack: Stack) => {
            const { StackId, StackName, StackStatus, CreationTime, LastUpdatedTime } = stack;

            try {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- AWS's types are strange, `StackId` and `StackName` are never going to be `undefined`
              const template = await this.getTemplate(StackId!, StackName!);

              return {
                StackId,
                StackName,
                StackStatus,
                CreationTime,
                LastUpdatedTime,
                Profile: this.profile,
                Template: template,
              };
            } catch (e) {
              return {
                StackId,
                StackName,
                StackStatus,
                CreationTime,
                LastUpdatedTime,
                Profile: this.profile,
              };
            }
          })
        );
      }
    }

    return Promise.all(stacks);
  }

  private async getTemplate(stackArn: string, stackName: string): Promise<CloudFormationTemplate> {
    const { TemplateBody } = await this.client.send(new GetTemplateCommand({ StackName: stackArn }));

    if (!TemplateBody) {
      return Promise.reject(`No template found for ${stackArn}`);
    } else {
      try {
        await writeFile(path.join(this.templateDir, stackName), TemplateBody);
        return JSON.parse(TemplateBody) as CloudFormationTemplate;
      } catch (err) {
        try {
          return yamlParse(TemplateBody) as CloudFormationTemplate;
        } catch (e) {
          /*
          Failure here is likely due to the YAML template not matching the schema, e.g. there are duplicated properties.
          The template should still have been downloaded to `this.templateDir` though.
          See https://github.com/guardian/payment-api/pull/209
           */
          return Promise.reject(
            `[${this.profile}] Unable to determine a JSON or YAML template for stack ${stackName} (${stackArn})`
          );
        }
      }
    }
  }

  private static getUniqueTemplateResourceTypes({ Resources }: CloudFormationTemplate): string[] {
    return Array.from(new Set(Object.values(Resources).map((_) => _.Type)));
  }

  private static isStackDefinedWithGuCDK({ Resources }: CloudFormationTemplate): boolean {
    return Object.values(Resources)
      .flatMap((resource) => resource.Properties)
      .flatMap((properties) => properties?.Tags ?? [])
      .some((tag) => tag.Key === Config.GU_CDK_TAG);
  }

  private static guCDKVersion({ Resources }: CloudFormationTemplate): string | undefined {
    const guCDKTag = Object.values(Resources)
      .flatMap((resource) => resource.Properties)
      .flatMap((properties) => properties?.Tags ?? [])
      .find((tag) => tag.Key === Config.GU_CDK_TAG);

    return guCDKTag ? guCDKTag.Value : undefined;
  }

  async run(): Promise<StackInfo[]> {
    const allStacks: StackMetadata[] = await this.getStacks();
    const stacks: StackMetadata[] = allStacks.filter(
      ({ StackStatus: status }) => status !== StackStatus.DELETE_COMPLETE
    );

    console.log(`[${this.profile}] Found ${allStacks.length} stacks. ${stacks.length} are not deleted.`);

    return stacks.map((stack) => {
      const template = stack.Template;

      return template
        ? {
            ...stack,
            ResourceTypes: CloudFormationInformation.getUniqueTemplateResourceTypes(template),
            DefinedWithGuCDK: CloudFormationInformation.isStackDefinedWithGuCDK(template),
            GuCDKVersion: CloudFormationInformation.guCDKVersion(template),
          }
        : {
            ...stack,
            ResourceTypes: [],
            DefinedWithGuCDK: false,
          };
    });
  }
}
