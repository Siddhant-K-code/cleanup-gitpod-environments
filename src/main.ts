/* eslint-disable  @typescript-eslint/no-explicit-any */

import axios from "axios";
import * as core from "@actions/core";

interface PaginationResponse {
  next_page_token?: string;
}

interface GitStatus {
  totalChangedFiles?: number;
  totalUnpushedCommits?: number;
}

interface Environment {
  id: string;
  metadata: {
    createdAt: string;
  };
  status: {
    phase: string;
    content?: {
      git?: GitStatus;
    };
  };
}

interface ListEnvironmentsResponse {
  environments: Environment[];
  pagination: PaginationResponse;
}

/**
 * Checks if the given date is older than specified days
 *
 * @param {string} dateString - ISO date string to check
 * @param {number} days - Number of days to compare against
 * @returns {boolean} - True if the date is older than specified days
 */
function isOlderThanDays(dateString: string, days: number): boolean {
  const date = new Date(dateString);
  const daysInMs = days * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - daysInMs);
  return date < cutoffDate;
}

/**
 * Lists the environments from the Gitpod API and identifies those that should be deleted.
 * Environments are selected for deletion if they are stopped, do not have changed files
 * or unpushed commits, and are older than the specified number of days.
 *
 * @param {string} gitpodToken - The access token for Gitpod API.
 * @param {string} organizationId - The organization ID.
 * @param {number} olderThanDays - Delete environments older than these many days
 * @returns {Promise<string[]>} - A promise that resolves to an array of environment IDs to be deleted.
 */
async function listEnvironments(
  gitpodToken: string,
  organizationId: string,
  olderThanDays: number
): Promise<string[]> {
  const toDelete: string[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const response: { data: ListEnvironmentsResponse } = await axios.post<ListEnvironmentsResponse>(
        "https://app.gitpod.io/api/gitpod.v1.EnvironmentService/ListEnvironments",
        {
          organization_id: organizationId,
          pagination: {
            page_size: 100,
            page_token: pageToken
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${gitpodToken}`,
          },
        }
      );

      core.debug("API Response: " + JSON.stringify(response.data));

      const environments = response.data.environments;

      environments.forEach((env) => {
        const isStopped = env.status.phase === "ENVIRONMENT_PHASE_STOPPED";
        const hasNoChangedFiles = !(env.status.content?.git?.totalChangedFiles);
        const hasNoUnpushedCommits = !(env.status.content?.git?.totalUnpushedCommits);
        const isOldEnough = isOlderThanDays(env.metadata.createdAt, olderThanDays);

        if (isStopped && hasNoChangedFiles && hasNoUnpushedCommits && isOldEnough) {
          toDelete.push(env.id);
          core.debug(`Environment ${env.id} created at ${env.metadata.createdAt} is ${olderThanDays} days old and marked for deletion`);
        }
      });

      pageToken = response.data.pagination.next_page_token;
    } while (pageToken); // Continue until no more pages

    return toDelete;
  } catch (error) {
    core.error(`Error in listEnvironments: ${error}`);
    throw error;
  }
}

/**
 * Deletes a specified environment using the Gitpod API.
 *
 * @param {string} environmentId - The ID of the environment to be deleted.
 * @param {string} gitpodToken - The access token for the Gitpod API.
 * @param {string} organizationId - The organization ID.
 */
async function deleteEnvironment(
  environmentId: string,
  gitpodToken: string,
  organizationId: string
) {
  try {
    await axios.post(
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
    core.debug(`Deleted environment: ${environmentId}`);
  } catch (error) {
    core.error(`Error in deleteEnvironment: ${error}`);
    throw error;
  }
}

/**
 * Main function to run the action. It retrieves the Gitpod access token, organization ID,
 * and age threshold, lists environments, deletes the selected environments, and outputs the result.
 */
async function run() {
  try {
    const gitpodToken = core.getInput("GITPOD_TOKEN", { required: true });
    const organizationId = core.getInput("ORGANIZATION_ID", { required: true });
    const olderThanDays = parseInt(core.getInput("OLDER_THAN_DAYS", { required: false }) || "10");
    const printSummary = core.getBooleanInput("PRINT_SUMMARY", { required: false });
    const deletedEnvironments: string[] = [];

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

    core.info(`Found ${environmentsToDelete.length} environments older than ${olderThanDays} days to delete`);

    for (const environmentId of environmentsToDelete) {
      await deleteEnvironment(environmentId, gitpodToken, organizationId);
      printSummary ? deletedEnvironments.push(environmentId) : null;
    }

    if (deletedEnvironments.length > 0 && printSummary) {
      core.summary
        .addHeading(`Environments deleted (older than ${olderThanDays} days)`)
        .addList(deletedEnvironments)
        .write();
    }

    core.setOutput("success", "true");
    core.setOutput("deleted_count", deletedEnvironments.length);
  } catch (error) {
    core.error((error as Error).message);
    core.setOutput("success", "false");
    core.setOutput("deleted_count", 0);
  }
}

run();
