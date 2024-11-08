"use strict";
/* eslint-disable  @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const core = __importStar(require("@actions/core"));
/**
 * Checks if the given date is older than specified days
 *
 * @param {string} dateString - ISO date string to check
 * @param {number} days - Number of days to compare against
 * @returns {boolean} - True if the date is older than specified days
 */
function isOlderThanDays(dateString, days) {
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
function listEnvironments(gitpodToken, organizationId, olderThanDays) {
    return __awaiter(this, void 0, void 0, function* () {
        const toDelete = [];
        let pageToken = undefined;
        try {
            do {
                const response = yield axios_1.default.post("https://app.gitpod.io/api/gitpod.v1.EnvironmentService/ListEnvironments", {
                    organization_id: organizationId,
                    pagination: {
                        page_size: 100,
                        page_token: pageToken
                    }
                }, {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${gitpodToken}`,
                    },
                });
                core.debug("API Response: " + JSON.stringify(response.data));
                const environments = response.data.environments;
                environments.forEach((env) => {
                    var _a, _b, _c, _d;
                    const isStopped = env.status.phase === "ENVIRONMENT_PHASE_STOPPED";
                    const hasNoChangedFiles = !((_b = (_a = env.status.content) === null || _a === void 0 ? void 0 : _a.git) === null || _b === void 0 ? void 0 : _b.totalChangedFiles);
                    const hasNoUnpushedCommits = !((_d = (_c = env.status.content) === null || _c === void 0 ? void 0 : _c.git) === null || _d === void 0 ? void 0 : _d.totalUnpushedCommits);
                    const isOldEnough = isOlderThanDays(env.metadata.createdAt, olderThanDays);
                    if (isStopped && hasNoChangedFiles && hasNoUnpushedCommits && isOldEnough) {
                        toDelete.push(env.id);
                        core.debug(`Environment ${env.id} created at ${env.metadata.createdAt} is ${olderThanDays} days old and marked for deletion`);
                    }
                });
                pageToken = response.data.pagination.next_page_token;
            } while (pageToken); // Continue until no more pages
            return toDelete;
        }
        catch (error) {
            core.error(`Error in listEnvironments: ${error}`);
            throw error;
        }
    });
}
/**
 * Deletes a specified environment using the Gitpod API.
 *
 * @param {string} environmentId - The ID of the environment to be deleted.
 * @param {string} gitpodToken - The access token for the Gitpod API.
 * @param {string} organizationId - The organization ID.
 */
function deleteEnvironment(environmentId, gitpodToken, organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield axios_1.default.post("https://app.gitpod.io/api/gitpod.v1.EnvironmentService/DeleteEnvironment", {
                environment_id: environmentId,
                organization_id: organizationId
            }, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${gitpodToken}`,
                },
            });
            core.debug(`Deleted environment: ${environmentId}`);
        }
        catch (error) {
            core.error(`Error in deleteEnvironment: ${error}`);
            throw error;
        }
    });
}
/**
 * Main function to run the action. It retrieves the Gitpod access token, organization ID,
 * and age threshold, lists environments, deletes the selected environments, and outputs the result.
 */
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const gitpodToken = core.getInput("GITPOD_TOKEN", { required: true });
            const organizationId = core.getInput("ORGANIZATION_ID", { required: true });
            const olderThanDays = parseInt(core.getInput("OLDER_THAN_DAYS", { required: false }) || "10");
            const printSummary = core.getBooleanInput("PRINT_SUMMARY", { required: false });
            const deletedEnvironments = [];
            if (!gitpodToken) {
                throw new Error("Gitpod access token is required");
            }
            if (!organizationId) {
                throw new Error("Organization ID is required");
            }
            if (isNaN(olderThanDays) || olderThanDays < 0) {
                throw new Error("OLDER_THAN_DAYS must be a positive number");
            }
            const environmentsToDelete = yield listEnvironments(gitpodToken, organizationId, olderThanDays);
            core.info(`Found ${environmentsToDelete.length} environments older than ${olderThanDays} days to delete`);
            for (const environmentId of environmentsToDelete) {
                yield deleteEnvironment(environmentId, gitpodToken, organizationId);
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
        }
        catch (error) {
            core.error(error.message);
            core.setOutput("success", "false");
            core.setOutput("deleted_count", 0);
        }
    });
}
run();
