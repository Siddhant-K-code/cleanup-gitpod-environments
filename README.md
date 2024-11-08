> [!NOTE]
> This is for [Gitpod Flex](https://app.gitpod.io), if you are using [Gitpod Classic](https://gitpod.io/workspaces) (PAYG), please refer to the [Gitpod Classic Environment Cleanup Action](https://github.com/marketplace/actions/delete-clean-gitpod-workspaces)

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

## Inputs ⚙️

| Input             | Required | Default | Description                           |
| ----------------- | -------- | ------- | ------------------------------------- |
| `GITPOD_TOKEN`    | Yes      | -       | Gitpod Personal Access Token          |
| `ORGANIZATION_ID` | Yes      | -       | Gitpod Flex organization ID           |
| `OLDER_THAN_DAYS` | No       | 10      | Delete environments older than X days |
| `PRINT_SUMMARY`   | No       | false   | Generate detailed summary report      |

## Outputs 📊

| Output              | Description                              |
| ------------------- | ---------------------------------------- |
| `success`           | 'true' if cleanup completed successfully |
| `deleted_count`     | Number of environments deleted           |
| `avg_days_inactive` | Average days of inactivity               |

## Summary Report Example 📑

```markdown
# Environment Cleanup Summary

| Metric                     | Value       |
| -------------------------- | ----------- |
| Total Environments Cleaned | 5           |
| Average Days Inactive      | 15.3 days   |
| Oldest Last Start          | 25 days ago |
| Newest Last Start          | 10 days ago |

## Deleted Environments

| Environment ID | Project                            | Last Activity | Created    | Creator  | Days Inactive |
| -------------- | ---------------------------------- | ------------- | ---------- | -------- | ------------- |
| 01924aff-...   | github.com/siddhant-k-code/website | 2023-11-01    | 2023-10-15 | user-123 | 15 days       |
| 01924bff-...   | github.com/siddhant-k-code/docs    | 2023-10-25    | 2023-10-01 | user-456 | 22 days       |
| 01924cff-...   | github.com/siddhant-k-code/example | 2023-10-20    | 2023-09-15 | user-789 | 18 days       |
```

## Prerequisites

1. **Gitpod Personal Access Token**:
   - Go to [Gitpod User Settings](https://app.gitpod.io/settings/personal-access-tokens)
   - Create a new token with necessary permissions
   - Add it as a GitHub secret named `GITPOD_TOKEN`

2. **Organization ID**:
   - Get your organization ID from Gitpod Flex dashboard
   - Add it as a GitHub secret named `GITPOD_ORGANIZATION_ID`

## Cleanup Criteria 🔍

An environment is deleted only if ALL conditions are met:
- Not started for X days (configurable)
- Currently in STOPPED phase
- No uncommitted changes
- No unpushed commits

## Security Considerations

- Always store your Gitpod token and organization ID as GitHub secrets
- Review the environments being deleted in the action logs
- Consider starting with a higher `OLDER_THAN_DAYS` value and gradually decreasing it

## Support

For issues and feature requests, please create an issue in this repository.

## Acknowledgments

This action is maintained by [@Siddhant-K-code](https://github.com/Siddhant-K-code) and is not an official Gitpod product.
