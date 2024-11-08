> [!NOTE]
> This is for [Gitpod Flex](https://app.gitpod.io), if you are using [Gitpod Classic](https://www.gitpod.io) (PAYG), please refer to the [Gitpod Classic Environment Cleanup Action](https://github.com/marketplace/actions/delete-clean-gitpod-workspaces)

# Gitpod Environment Cleanup Action

Automatically clean up stale Gitpod environments that haven't been started for a specified number of days and have no pending changes. This action helps maintain a clean workspace and manage resource usage in your Gitpod Flex organization.

> [!IMPORTANT]
> `GITPOD_TOKEN`: Required. [Learn more](https://www.gitpod.io/docs/flex/integrations/personal-access-token) about how to create a Gitpod Personal Access Token in Gitpod Flex.


## Features

- 🧹 Cleans up stale environments automatically
- ⏰ Configurable inactivity threshold (default: 10 days since last start)
- ✅ Smart cleanup - only deletes environments that are:
  - In STOPPED phase
  - Have no uncommitted changes
  - Have no unpushed commits
  - Haven't been started for X days
- 📄 Optional summary report of deleted environments
- 🔄 Handles pagination for organizations with many environments

## Usage

### Basic Usage

Create a new workflow file (e.g., `.github/workflows/cleanup-gitpod-environments.yml`):

```yaml
name: Cleanup Gitpod Environments

on:
  schedule:
    - cron: '0 14 * * 6'  # Runs at 2:00 PM UTC (14:00) every Saturday
  workflow_dispatch:      # Allows manual triggering

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Old Environments
        uses: Siddhant-K-code/cleanup-gitpod-environments@v1
        with:
          GITPOD_TOKEN: ${{ secrets.GITPOD_TOKEN }}
          ORGANIZATION_ID: ${{ secrets.GITPOD_ORGANIZATION_ID }}
```

### Advanced Usage

```yaml
name: Cleanup Gitpod Environments

on:
  schedule:
    - cron: '0 14 * * 6'  # Runs at 2:00 PM UTC (14:00) every Saturday
  workflow_dispatch:      # Allows manual triggering

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Old Environments
        uses: Siddhant-K-code/cleanup-gitpod-environments@v1
        with:
          GITPOD_TOKEN: ${{ secrets.GITPOD_TOKEN }}
          ORGANIZATION_ID: ${{ secrets.GITPOD_ORGANIZATION_ID }}
          OLDER_THAN_DAYS: 15
          PRINT_SUMMARY: true
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `GITPOD_TOKEN` | Yes | - | Gitpod Personal Access Token with necessary permissions |
| `ORGANIZATION_ID` | Yes | - | Your Gitpod Flex organization ID |
| `OLDER_THAN_DAYS` | No | 10 | Delete environments not started for this many days |
| `PRINT_SUMMARY` | No | false | Generate a summary of deleted environments |

## Outputs

| Output | Description |
|--------|-------------|
| `success` | 'true' if the action completed successfully, 'false' otherwise |
| `deleted_count` | Number of environments deleted |

## Prerequisites

1. **Gitpod Personal Access Token**:
   - Go to [Gitpod User Settings](https://app.gitpod.io/settings/personal-access-tokens)
   - Create a new token with necessary permissions
   - Add it as a GitHub secret named `GITPOD_TOKEN`

2. **Organization ID**:
   - Get your organization ID from Gitpod Flex dashboard
   - Add it as a GitHub secret named `GITPOD_ORGANIZATION_ID`

## Deletion Criteria

An environment will be deleted if it meets ALL of the following criteria:
- Is in `STOPPED` phase
- Has no uncommitted changes
- Has no unpushed commits
- Is older than the specified number of days
- Belongs to the specified organization

## Security Considerations

- Always store your Gitpod token and organization ID as GitHub secrets
- Review the environments being deleted in the action logs
- Consider starting with a higher `OLDER_THAN_DAYS` value and gradually decreasing it

## Support

For issues and feature requests, please create an issue in this repository.

## Acknowledgments

This action is maintained by [@Siddhant-K-code](https://github.com/Siddhant-K-code) and is not an official Gitpod product.
