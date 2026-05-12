import { supabase } from './supabase.js';
import type { Repo, Issue, Assignment } from '../types/index.js';

/**
 * Checks if a GitHub user ID is a maintainer for a repository.
 */
export async function isMaintainer(githubUserId: number, repoId: string): Promise<boolean> {
  const { data: repo, error } = await supabase
    .from('repos')
    .select('owner_github_id, installer_github_id')
    .eq('id', repoId)
    .single<Repo>();

  if (error || !repo) return false;

  return (
    Number(repo.owner_github_id) === githubUserId ||
    Number(repo.installer_github_id) === githubUserId
  );
}

/**
 * Checks if a GitHub user ID is the assigned contributor for a specific issue.
 */
export async function isAssignedContributor(githubUserId: number, repoId: string, githubIssueId: number): Promise<boolean> {
  // 1. Get the issue internal ID
  const { data: issue, error: issueError } = await supabase
    .from('issues')
    .select('id')
    .eq('repo_id', repoId)
    .eq('github_issue_id', githubIssueId)
    .single<Issue>();

  if (issueError || !issue) return false;

  // 2. Check assignment
  const { data: assignment, error: assignError } = await supabase
    .from('assignments')
    .select('contributor_id, contributors(github_user_id)')
    .eq('issue_id', issue.id)
    .single<any>();

  if (assignError || !assignment || !assignment.contributors) return false;

  return Number(assignment.contributors.github_user_id) === githubUserId;
}

/**
 * Checks if a GitHub user ID is the assigned contributor by internal issue ID.
 */
export async function isAssignedContributorById(githubUserId: number, issueId: string): Promise<boolean> {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('contributor_id, contributors(github_user_id)')
    .eq('issue_id', issueId)
    .single<any>();

  if (error || !assignment || !assignment.contributors) return false;

  return Number(assignment.contributors.github_user_id) === githubUserId;
}
