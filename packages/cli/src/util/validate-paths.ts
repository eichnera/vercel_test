import { lstat as lstatRaw } from 'fs';
import { promisify } from 'util';
import { Output } from './output';
import chalk from 'chalk';
import { homedir } from 'os';
import confirm from './input/confirm';
import toHumanPath from './humanize-path';
import Client from './client';

const stat = promisify(lstatRaw);

/**
 * A helper function to validate the `rootDirectory` input.
 */
export async function validateRootDirectory(
  output: Output,
  cwd: string,
  path: string,
  errorSuffix: string
) {
  const pathStat = await stat(path).catch(() => null);
  const suffix = errorSuffix ? ` ${errorSuffix}` : '';

  if (!pathStat) {
    output.print(
      `${chalk.red('Error!')} The provided path ${chalk.cyan(
        `“${toHumanPath(path)}”`
      )} does not exist.${suffix}\n`
    );
    return false;
  }

  if (!pathStat.isDirectory()) {
    output.print(
      `${chalk.red('Error!')} The provided path ${chalk.cyan(
        `“${toHumanPath(path)}”`
      )} is a file, but expected a directory.${suffix}\n`
    );
    return false;
  }

  if (!path.startsWith(cwd)) {
    output.print(
      `${chalk.red('Error!')} The provided path ${chalk.cyan(
        `“${toHumanPath(path)}”`
      )} is outside of the project.${suffix}\n`
    );
    return false;
  }

  return true;
}

export default async function validatePaths(
  client: Client,
  paths: string[]
): Promise<{ valid: true; path: string } | { valid: false; exitCode: number }> {
  const { output } = client;

  // can't deploy more than 1 path
  if (paths.length > 1) {
    output.print(`${chalk.red('Error!')} Can't deploy more than one path.\n`);
    return { valid: false, exitCode: 1 };
  }

  const path = paths[0];

  // can only deploy a directory
  const pathStat = await stat(path).catch(() => null);

  if (!pathStat) {
    output.print(
      `${chalk.red('Error!')} Could not find ${chalk.cyan(
        `“${toHumanPath(path)}”`
      )}\n`
    );
    return { valid: false, exitCode: 1 };
  }

  if (!pathStat.isDirectory()) {
    output.prettyError({
      message: 'Support for single file deployments has been removed.',
      link: 'https://vercel.link/no-single-file-deployments',
    });
    return { valid: false, exitCode: 1 };
  }

  // ask confirmation if the directory is home
  if (path === homedir()) {
    const shouldDeployHomeDirectory = await confirm(
      client,
      `You are deploying your home directory. Do you want to continue?`,
      false
    );

    if (!shouldDeployHomeDirectory) {
      output.print(`Aborted\n`);
      return { valid: false, exitCode: 0 };
    }
  }

  return { valid: true, path };
}
