import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "mtn-momo-package-smoke-"));

try {
  run("npm", ["pack", "--pack-destination", temp, "--ignore-scripts"], root);
  const tarball = (await readdir(temp)).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack did not produce a tarball");

  const packageRoot = join(
    temp,
    "node_modules",
    "@maxkabechani",
    "mtn-momo-sdk",
  );
  await mkdir(packageRoot, { recursive: true });
  run(
    "tar",
    [
      "-xf",
      join(temp, tarball),
      "-C",
      packageRoot,
      "--strip-components=1",
    ],
    root,
  );

  for (const dependency of ["commander", "uuid"]) {
    await cp(
      join(root, "node_modules", dependency),
      join(temp, "node_modules", dependency),
      { recursive: true },
    );
  }

  run(
    "node",
    [
      "--input-type=module",
      "-e",
      "import { create, generateReferenceId } from '@maxkabechani/mtn-momo-sdk'; if (typeof create !== 'function' || generateReferenceId().length !== 36) process.exit(1)",
    ],
    temp,
  );
  run(
    "node",
    [
      "-e",
      "const sdk = require('@maxkabechani/mtn-momo-sdk'); if (typeof sdk.create !== 'function' || sdk.generateReferenceId().length !== 36) process.exit(1)",
    ],
    temp,
  );
  run(
    "bun",
    [
      "-e",
      "import { create, generateReferenceId } from '@maxkabechani/mtn-momo-sdk'; if (typeof create !== 'function' || generateReferenceId().length !== 36) process.exit(1)",
    ],
    temp,
  );

  await writeFile(
    join(temp, "consumer.ts"),
    [
      "import { create, generateReferenceId } from '@maxkabechani/mtn-momo-sdk';",
      "import type { PaymentRequest } from '@maxkabechani/mtn-momo-sdk';",
      "const request: PaymentRequest = {",
      "  referenceId: generateReferenceId(),",
      "  amount: '1.00',",
      "  currency: 'EUR',",
      "  payer: { partyIdType: 'MSISDN' as never, partyId: '256772000000' },",
      "};",
      "void create;",
      "void request;",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(temp, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2020",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer.ts"],
      },
      null,
      2,
    ),
  );
  run(
    "node",
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      join(temp, "tsconfig.json"),
    ],
    temp,
  );

  console.log("Packed package smoke tests passed: Node ESM, Node CJS, Bun, TypeScript.");
} finally {
  await rm(temp, { recursive: true, force: true });
}

function run(command, args, cwd) {
  let executable = command;
  let commandArgs = args;
  if (process.platform === "win32") {
    if (command === "npm") {
      executable = process.execPath;
      commandArgs = [
        join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
        ...args,
      ];
    } else {
      executable =
        {
          node: process.execPath,
          bun: join(process.env.USERPROFILE, ".bun", "bin", "bun.exe"),
          tar: join(process.env.SystemRoot, "System32", "tar.exe"),
        }[command] ?? command;
    }
  }
  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.error ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
}
