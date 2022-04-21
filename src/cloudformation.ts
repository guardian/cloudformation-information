import { existsSync } from "fs";
import { readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Stack } from "@aws-sdk/client-cloudformation";
import { CloudFormationClient, GetTemplateCommand, paginateDescribeStacks } from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { Config } from "./config";
import type { CloudFormationTemplate, StackMetadata } from "./types";
import { ensureCleanDirectory, stringToCloudFormationTemplate } from "./util";

export class CloudFormation {
  private readonly profile: string;
  private readonly region: string;
  private readonly templateDirectory: string;
  private readonly originalTemplateDirectory: string;
  private readonly client: CloudFormationClient;

  constructor(profile: string, region: string) {
    this.profile = profile;
    this.region = region;
    this.templateDirectory = path.join(Config.TEMPLATE_OUTPUT_DIR, region, profile);
    this.originalTemplateDirectory = path.join(Config.ORIGINAL_TEMPLATE_OUTPUT_DIR, region, profile);

    this.client = new CloudFormationClient({
      region,
      maxAttempts: Config.SDK_MAX_ATTEMPTS,
      credentials: fromIni({ profile }),
    });
  }

  /**
   * Download the CloudFormation template for a stack.
   * The original JSON or YAML template will be saved to `this.originalTemplateDirectory`.
   * A JSON version will be saved to `this.templateDirectory`.
   *
   * @param stackArn The ARN of the stack
   * @param stackName The name of the stack, this is used for the filename
   * @private
   */
  private async downloadTemplate(stackArn: string, stackName: string): Promise<CloudFormationTemplate> {
    const { TemplateBody } = await this.client.send(new GetTemplateCommand({ StackName: stackArn }));

    if (!TemplateBody) {
      return Promise.reject(`No template found for ${stackArn}`);
    } else {
      await writeFile(path.join(this.originalTemplateDirectory, stackName), TemplateBody);
      try {
        const template = stringToCloudFormationTemplate(TemplateBody);
        await writeFile(path.join(this.templateDirectory, stackName), JSON.stringify(template, null, 2));
        return template;
      } catch (err) {
        return Promise.reject(
          `[${this.profile}] Unable to determine a JSON or YAML template for stack ${stackName} (${stackArn})`
        );
      }
    }
  }

  /**
   * Get information about all the stacks running in `this.region` for the AWS account.
   * The stack's template will also be downloaded.
   */
  async getStacks(): Promise<StackMetadata[]> {
    ensureCleanDirectory(this.originalTemplateDirectory);
    ensureCleanDirectory(this.templateDirectory);

    const paginator = paginateDescribeStacks({ client: this.client, pageSize: 10 }, {});

    const stacks: Array<Promise<StackMetadata>> = [];

    for await (const page of paginator) {
      if (page.Stacks) {
        stacks.push(
          ...page.Stacks.map(async (stack: Stack) => {
            const baseResponse: StackMetadata = {
              ...stack,
              Profile: this.profile,
              Region: this.region,
            };

            try {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- AWS's types are strange, `StackId` and `StackName` are never going to be `undefined`
              const template = await this.downloadTemplate(stack.StackId!, stack.StackName!);

              return {
                ...baseResponse,
                Template: template,
              };
            } catch (e) {
              return baseResponse;
            }
          })
        );
      }
    }

    return Promise.all(stacks);
  }

  /**
   * Get templates for stacks running in `this.region`.
   *
   * @param preferCache when true and `this.templateDirectory` exists, read templates from disk
   */
  async getTemplates(preferCache: boolean): Promise<Array<Record<string, CloudFormationTemplate>>> {
    if (preferCache && existsSync(this.templateDirectory)) {
      console.log(`loading templates from ${this.templateDirectory}`);
      return Promise.all(
        (await readdir(this.templateDirectory)).map(async (stackName) => {
          const content = await readFile(path.join(this.templateDirectory, stackName));
          return { [stackName]: stringToCloudFormationTemplate(content.toString()) };
        })
      );
    }

    return Promise.resolve(
      (await this.getStacks()).map(({ StackName, Template }) => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- AWS's types are strange, `StackName` is never going to be `undefined`
          [StackName!]: Template ?? ({} as CloudFormationTemplate),
        };
      })
    );
  }
}
