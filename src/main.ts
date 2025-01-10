/* eslint-disable  @typescript-eslint/no-explicit-any */

import axios from "axios";
import * as core from "@actions/core";

interface PaginationResponse {
  nextToken?: string;
}

interface GitStatus {
  totalChangedFiles?: number;
  totalUnpushedCommits?: number;
}

interface Creator {
  id: string;
  principal: string;
}

interface EnvironmentMetadata {
  organizationId: string;
  creator: Creator;
  createdAt: string;
  projectId: string;
  runnerId: string;
  lastStartedAt: string;
}

interface EnvironmentSpec {
  specVersion: string;
  desiredPhase: string;
  machine: {
    session: string;
    class: string;
  };
  content: {
    initializer: {
      specs: Array<{
        contextUrl: {
          url: string;
        };
      }>;
    };
  };
  ports?: Array<{
    port: number;
    admission: string;
    name: string;
  }>;
  timeout?: {
    disconnected: string;
  };
}

interface EnvironmentStatus {
  statusVersion: string;
  phase: string;
  content?: {
    phase?: string;
    git?: GitStatus;
    contentLocationInMachine?: string;
  };
}

interface Environment {
  id: string;
  metadata: EnvironmentMetadata;
  spec: EnvironmentSpec;
  status: EnvironmentStatus;
}

interface ListEnvironmentsResponse {
  environments: Environment[];
  pagination: PaginationResponse;
}

interface DeletedEnvironmentInfo {
  id: string;
  projectUrl: string;
  lastStarted: string;
  createdAt: string;
  creator: string;
  inactiveDays: number;
}

/**
 * Sleep function to add delay between API calls
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Formats a date difference in days
 */
function getDaysSince(date: string): number {
  const then = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - then.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Extract project URL from context URL
 */
function getProjectUrl(env: Environment): string {
  try {
    const contextUrl = env.spec.content?.initializer?.specs?.[0]?.contextUrl?.url;
    return contextUrl || 'N/A';
  } catch (error) {
    core.debug(`Error getting project URL for environment ${env.id}: ${error}`);
    return 'N/A';
  }
}

/**
 * Checks if the environment is stale based on its last started time
 */
function isStale(lastStartedAt: string, days: number): boolean {
  const lastStarted = new Date(lastStartedAt);
  const daysInMs = days * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - daysInMs);
  return lastStarted < cutoffDate;
}

async function getRunner(runnerId: string, gitpodToken: string): Promise<boolean> {
  const baseDelay = 2000;
  try {
    const response = await axios.post(
      "https://app.gitpod.io/api/gitpod.v1.RunnerService/GetRunner",
      {
        runner_id: runnerId
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gitpodToken}`,
        },
      }
    );

    await sleep(baseDelay);
    return response.data.runner.kind === "RUNNER_KIND_REMOTE";
  } catch (error) {
    core.debug(`Error getting runner ${runnerId}: ${error}`);
    return false;
  }
}

/**
 * Lists and filters environments that should be deleted
 */
async function listEnvironments(
  gitpodToken: string,
  organizationId: string,
  olderThanDays: number
): Promise<DeletedEnvironmentInfo[]> {
  const toDelete: DeletedEnvironmentInfo[] = [];
  let pageToken: string | undefined = undefined;
  const baseDelay = 2000;
  let retryCount = 0;
  const maxRetries = 3;

  try {
    do {
      try {
        const response: { data: ListEnvironmentsResponse } = await axios.post<ListEnvironmentsResponse>(
          "https://app.gitpod.io/api/gitpod.v1.EnvironmentService/ListEnvironments",
          {
            organization_id: organizationId,
            pagination: {
              page_size: 100,
              page_token: pageToken
            },
            filter: {
              status_phases: ["ENVIRONMENT_PHASE_STOPPED", "ENVIRONMENT_PHASE_UNSPECIFIED"]
            }
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${gitpodToken}`,
            },
          }
        );

        core.debug(`ListEnvironments API Response: ${JSON.stringify(response.data)}`);
        await sleep(baseDelay);

        const environments = response.data.environments;
        core.debug(`Fetched ${environments.length} stopped environments`);

        for (const env of environments) {
          const isRemoteRunner = await getRunner(env.metadata.runnerId, gitpodToken);
          const hasNoChangedFiles = !(env.status.content?.git?.totalChangedFiles);
          const hasNoUnpushedCommits = !(env.status.content?.git?.totalUnpushedCommits);
          const isInactive = isStale(env.metadata.lastStartedAt, olderThanDays);

          if (isRemoteRunner && hasNoChangedFiles && hasNoUnpushedCommits && isInactive) {
            toDelete.push({
              id: env.id,
              projectUrl: getProjectUrl(env),
              lastStarted: env.metadata.lastStartedAt,
              createdAt: env.metadata.createdAt,
              creator: env.metadata.creator.id,
              inactiveDays: getDaysSince(env.metadata.lastStartedAt)
            });
          }
        }

        pageToken = response.data.pagination.nextToken;
        retryCount = 0;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          core.debug(`Rate limit hit in ListEnvironments, waiting ${delay}ms before retry ${retryCount + 1}...`);
          await sleep(delay);
          retryCount++;
          continue;
        }
        throw error;
      }
    } while (pageToken);

    return toDelete;
  } catch (error) {
    core.error(`Error in listEnvironments: ${error}`);
    throw error;
  }
}

/**
 * Deletes a specified environment
 */
async function deleteEnvironment(
  environmentId: string,
  gitpodToken: string,
  organizationId: string
) {
  let retryCount = 0;
  const maxRetries = 3;
  const baseDelay = 2000;

  while (retryCount <= maxRetries) {
    try {
      const response = await axios.post(
        "https://app.gitpod.io/api/gitpod.v1.EnvironmentService/DeleteEnvironment",
        {
          environment_id: environmentId,
          organization_id: organizationId
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gitpodToken}`,
          },
        }
      );

      core.debug(`DeleteEnvironment API Response for ${environmentId}: ${JSON.stringify(response.data)}`);
      await sleep(baseDelay);
      core.debug(`Successfully deleted environment: ${environmentId}`);
      return;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        core.debug(`Rate limit hit in DeleteEnvironment, waiting ${delay}ms before retry ${retryCount + 1}...`);
        await sleep(delay);
        retryCount++;
      } else {
        core.error(`Error deleting environment ${environmentId}: ${error}`);
        throw error;
      }
    }
  }
}

/**
 * Main function to run the action.
 */
async function run() {
  try {
    const gitpodToken = core.getInput("GITPOD_TOKEN", { required: true });
    const organizationId = core.getInput("ORGANIZATION_ID", { required: true });
    const olderThanDays = parseInt(core.getInput("OLDER_THAN_DAYS", { required: false }) || "10");
    const printSummary = core.getBooleanInput("PRINT_SUMMARY", { required: false });

    if (!gitpodToken) {
      throw new Error("Gitpod access token is required");
    }

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    if (isNaN(olderThanDays) || olderThanDays < 0) {
      throw new Error("OLDER_THAN_DAYS must be a positive number");
    }

    const environmentsToDelete = await listEnvironments(gitpodToken, organizationId, olderThanDays);

    core.info(`Found ${environmentsToDelete.length} environments to delete`);

    let totalDaysInactive = 0;

    // Track successfully deleted environments
    const deletedEnvironments: DeletedEnvironmentInfo[] = [];

    // Process deletions
    for (const envInfo of environmentsToDelete) {
      let retryCount = 0;
      const maxRetries = 5;
      const baseDelay = 2000;
      while (retryCount <= maxRetries) {
        try {
          await deleteEnvironment(envInfo.id, gitpodToken, organizationId);
          await sleep(baseDelay);
          deletedEnvironments.push(envInfo);
          totalDaysInactive += envInfo.inactiveDays;
          core.debug(`Successfully deleted environment: ${envInfo.id}`);
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 429) {
            // If we hit rate limit, wait 5 seconds before retrying
            core.debug('Rate limit hit, waiting 5 seconds...');
            await sleep(5000);
            // Retry the deletion
            try {
              await deleteEnvironment(envInfo.id, gitpodToken, organizationId);
              deletedEnvironments.push(envInfo);
              totalDaysInactive += envInfo.inactiveDays;
            } catch (retryError) {
              core.warning(`Failed to delete environment ${envInfo.id} after retry: ${retryError}`);
            }
          } else {
            core.warning(`Failed to delete environment ${envInfo.id}: ${error}`);
          }
        }
      }
    }

    if (deletedEnvironments.length > 0 && printSummary) {
      const avgDaysInactive = totalDaysInactive / deletedEnvironments.length;

      const summary = core.summary
        .addHeading(`Environment Cleanup Summary`)
        .addTable([
          [
            { data: 'Metric', header: true },
            { data: 'Value', header: true }
          ],
          ['Total Environments Cleaned', `${deletedEnvironments.length}`],
          ['Average Days Inactive', `${avgDaysInactive.toFixed(1)} days`],
          ['Oldest Last Start', `${Math.max(...deletedEnvironments.map(e => e.inactiveDays))} days ago`],
          ['Newest Last Start', `${Math.min(...deletedEnvironments.map(e => e.inactiveDays))} days ago`]
        ])
        .addHeading('Deleted Environments', 2);

      // Create table header for environments
      const envTableHeader = [
        { data: 'Environment ID', header: true },
        { data: 'Project', header: true },
        { data: 'Last Activity', header: true },
        { data: 'Created', header: true },
        { data: 'Creator', header: true },
        { data: 'Days Inactive', header: true }
      ];

      // Create table rows for environments
      const envTableRows = deletedEnvironments.map(env => [
        env.id,
        env.projectUrl,
        new Date(env.lastStarted).toLocaleDateString(),
        new Date(env.createdAt).toLocaleDateString(),
        env.creator,
        `${env.inactiveDays} days`
      ]);

      // Add environments table
      summary.addTable([
        envTableHeader,
        ...envTableRows
      ]);

      await summary.write();
    }

    // Set outputs
    core.setOutput("success", "true");
    core.setOutput("deleted_count", deletedEnvironments.length);
    core.setOutput("avg_days_inactive", totalDaysInactive / deletedEnvironments.length);

    // Log completion
    core.info(`Successfully deleted ${deletedEnvironments.length} environments`);

  } catch (error) {
    core.error((error as Error).message);
    core.setOutput("success", "false");
    core.setOutput("deleted_count", 0);
    core.setOutput("avg_days_inactive", 0);
  }
}

run();
