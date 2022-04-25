# CloudFormation Information

A command line tool to audit Cloudformation stacks for a given set of AWS
accounts.

The motivation is to assist with @guardian/cdk migrations.

```
$ npm run start -- --help

index.ts [command]

Commands:
  index.ts overview  list stacks, contained resources, and if @guardian/cdk managed

Options:
  --help          Show help                                            [boolean]
  --version       Show version number                                  [boolean]
  --prefer-cache  use local cache and fail is not found                [boolean]
```

## How do I run it?

1. Install dependencies: `nvm use; npm i`
2. Get CloudFormation Read credentials from Janus for each account you want to report for
3. Update the list of profiles in [`src/config.ts`](./src/config.ts) to match the credentials obtained from step 1
4. Run your command: `npm run start -- [command] [options]`

## How does it work?

1. List all CloudFormation stacks in an account (via `describe-stacks`)
2. Parse the template for each stack:
   1. Download a stack's template (via `get-template`)
   2. Attempt to parse the template as JSON or YAML, downloading to `./output/templates`
   3. If _any_ resource if the stack has the Tag "gu:cdk:version", it has been defined with `@guardian/cdk`
3. Produce a CSV report in `./output/data`

## Known issues

- Every so often AWS requests will experience throttling, efforts have been made to solve this, but they do not work in all scenarios.
