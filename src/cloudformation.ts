import type { DescribeStacksCommandOutput, GetTemplateCommandOutput, Stack } from "@aws-sdk/client-cloudformation";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  GetTemplateCommand,
  StackStatus,
} from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";
import { yamlParse } from "yaml-cfn";
import { Config } from "./config";
import type { CloudFormationTemplate, StackInfo } from "./types";

export class CloudFormationInformation {
  private readonly profile: string;
  private readonly client: CloudFormationClient;

  constructor(profile: string, region: string = "eu-west-1") {
    this.profile = profile;

    this.client = new CloudFormationClient({
      region,
      credentials: fromIni({ profile }),
      retryStrategy: new StandardRetryStrategy(() => Promise.resolve(Config.SDK_MAX_ATTEMPTS), {
        delayDecider: (delayBase: number, attempts: number) => {
          return Math.floor(Math.min(Config.SDK_MAX_RETRY_DELAY, 2 ** attempts * delayBase));
        },
      }),
    });
  }

  private async describeStacks(next?: string): Promise<Stack[]> {
    const command: DescribeStacksCommand = new DescribeStacksCommand({ NextToken: next });
    const { Stacks = [], NextToken }: DescribeStacksCommandOutput = await this.client.send(command);
    return NextToken ? [...Stacks, ...(await this.describeStacks(NextToken))] : Stacks;
  }

  private async getTemplate(stackArn: string): Promise<CloudFormationTemplate> {
    const command: GetTemplateCommand = new GetTemplateCommand({ StackName: stackArn });
    const { TemplateBody }: GetTemplateCommandOutput = await this.client.send(command);

    if (!TemplateBody) {
      return Promise.reject("No template");
    }

    try {
      return JSON.parse(TemplateBody) as CloudFormationTemplate;
    } catch (err) {
      try {
        return yamlParse(TemplateBody) as CloudFormationTemplate;
      } catch (e) {
        return Promise.reject(`Unable to determine a JSON or YAML template for stack ${stackArn}`);
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

  async run(): Promise<StackInfo[]> {
    const allStacks: Stack[] = await this.describeStacks();
    const stacks: Stack[] = allStacks.filter(({ StackStatus: status }) => status !== StackStatus.DELETE_COMPLETE);

    return await Promise.all(
      stacks.map(async (stack: Stack) => {
        const { StackId, StackName, StackStatus, CreationTime } = stack;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- AWS's types are strange, `StackId` is never going to be `undefined`
        const stackArn = StackId!;
        const template = await this.getTemplate(stackArn);

        return {
          StackId,
          StackStatus,
          StackName,
          CreationTime,
          ResourceTypes: CloudFormationInformation.getUniqueTemplateResourceTypes(template),
          DefinedWithGuCDK: CloudFormationInformation.isStackDefinedWithGuCDK(template),
          Profile: this.profile,
        };
      })
    );
  }
}
