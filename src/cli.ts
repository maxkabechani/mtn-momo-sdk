#!/usr/bin/env node

import { program } from "commander";

import * as momo from "./index.js";
import type { Credentials } from "./common.js";

const version = process.env.npm_package_version || "0.0.0";

program
  .version(version)
  .description("Create sandbox credentials")
  .option("-x, --host <n>", "Your webhook host")
  .option("-p, --primary-key <n>", "Primary Key")
  .parse(process.argv);

const options = program.opts<{ host?: string; primaryKey?: string }>();

if (!options.host || !options.primaryKey) {
  program.help({ error: true });
}

const stringify = (obj: object | string) => JSON.stringify(obj, null, 2);

const { Users } = momo.create({ callbackHost: options.host });

const users = Users({ primaryKey: options.primaryKey });

users
  .create(options.host)
  .then((userId: string) => {
    return users.login(userId).then((credentials: Credentials) => {
      console.log(
        "Momo Sandbox Credentials",
        stringify({
          userSecret: credentials.apiKey,
          userId,
        }),
      );
    });
  })
  .catch((error: unknown) => {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : "Request failed";
    console.error(`${name}: ${message}`);
    process.exitCode = 1;
  });
