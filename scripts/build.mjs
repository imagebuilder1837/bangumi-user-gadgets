import { rollup } from "rollup";
import { readFile, writeFile } from "node:fs/promises";

export async function generate() {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const metadata = await readFile(
    new URL("../src/metadata.txt", import.meta.url),
    "utf8",
  );
  const bundle = await rollup({
    input: new URL("../src/entry.mjs", import.meta.url).pathname,
  });
  try {
    const { output } = await bundle.generate({
      format: "iife",
      banner: metadata.trimEnd().replace("{{VERSION}}", pkg.version),
      indent: "  ",
    });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  await writeFile(
    new URL("../src/index.user.js", import.meta.url),
    await generate(),
  );
