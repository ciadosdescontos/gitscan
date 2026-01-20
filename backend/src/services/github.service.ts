import { config } from '../config/index.js';
import { GitHubRepository } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';

const GITHUB_API_BASE = 'https://api.github.com';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
  name: string | null;
}

export class GitHubService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${GITHUB_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitScan-Security-Scanner',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logger.error('GitHub API error', {
        status: response.status,
        endpoint,
        error,
      });

      if (response.status === 401) {
        throw new AppError(
          'GitHub authentication failed',
          401,
          ErrorCode.GITHUB_AUTH_FAILED
        );
      }

      if (response.status === 403) {
        throw new AppError(
          'GitHub API rate limit exceeded or access denied',
          403,
          ErrorCode.RATE_LIMITED
        );
      }

      throw new AppError(
        error.message || 'GitHub API request failed',
        response.status,
        ErrorCode.INTERNAL_ERROR
      );
    }

    return response.json();
  }

  // Get authenticated user
  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  // Get user's repositories
  async getRepositories(
    page: number = 1,
    perPage: number = 30,
    sort: 'created' | 'updated' | 'pushed' | 'full_name' = 'updated'
  ): Promise<GitHubRepository[]> {
    return this.request<GitHubRepository[]>(
      `/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&affiliation=owner,collaborator`
    );
  }

  // Get a specific repository
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  // Get repository contents
  async getContents(
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<any> {
    const endpoint = `/repos/${owner}/${repo}/contents/${path}${
      ref ? `?ref=${ref}` : ''
    }`;
    return this.request(endpoint);
  }

  // Get file content as raw text
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string> {
    const content = await this.getContents(owner, repo, path, ref);

    if (content.encoding === 'base64') {
      return Buffer.from(content.content, 'base64').toString('utf-8');
    }

    return content.content;
  }

  // Get repository branches
  async getBranches(
    owner: string,
    repo: string
  ): Promise<Array<{ name: string; protected: boolean }>> {
    return this.request(`/repos/${owner}/${repo}/branches`);
  }

  // Get repository tree (all files)
  async getTree(
    owner: string,
    repo: string,
    sha: string,
    recursive: boolean = true
  ): Promise<{
    sha: string;
    tree: Array<{
      path: string;
      mode: string;
      type: 'blob' | 'tree';
      sha: string;
      size?: number;
    }>;
  }> {
    return this.request(
      `/repos/${owner}/${repo}/git/trees/${sha}${recursive ? '?recursive=1' : ''}`
    );
  }

  // Create a pull request
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string
  ): Promise<{
    number: number;
    html_url: string;
    state: string;
  }> {
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base }),
    });
  }

  // Create or update file content
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string,
    sha?: string
  ): Promise<any> {
    const encodedContent = Buffer.from(content).toString('base64');

    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: encodedContent,
        branch,
        sha,
      }),
    });
  }

  // Create a new branch
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    sourceSha: string
  ): Promise<any> {
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: sourceSha,
      }),
    });
  }

  // Get commit SHA
  async getCommitSha(
    owner: string,
    repo: string,
    ref: string
  ): Promise<string> {
    const response = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/commits/${ref}`
    );
    return response.sha;
  }
}

// Factory function
export function createGitHubService(accessToken: string): GitHubService {
  return new GitHubService(accessToken);
}
