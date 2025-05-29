#!/usr/bin/env node
// MulmoCast CLI のエントリポイント。各コマンドを yargs で登録する

import "dotenv/config";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import * as translateCmd from "./commands/translate/index.js";
import * as audioCmd from "./commands/audio/index.js";
import * as imagesCmd from "./commands/image/index.js";
import * as movieCmd from "./commands/movie/index.js";
import * as pdfCmd from "./commands/pdf/index.js";
import * as toolCmd from "./commands/tool/index.js";
import { GraphAILogger } from "graphai";

// yargs を用いて各サブコマンドを構築する
export const main = async () => {
  const cli = yargs(hideBin(process.argv))
    .scriptName("mulmo")
    .usage("$0 <command> [options]")
    .option("v", {
      alias: "verbose",
      describe: "verbose log",
      demandOption: true,
      default: false,
      type: "boolean",
    })
    .command(translateCmd)
    .command(audioCmd)
    .command(imagesCmd)
    .command(movieCmd)
    .command(pdfCmd)
    .command(toolCmd)
    .demandCommand()
    .strict()
    .help()
    .alias("help", "h");

  await cli.parseAsync();
};

// 予期せぬエラーが発生した場合はログを出力して終了
main().catch((error) => {
  GraphAILogger.info("An unexpected error occurred:", error);
  process.exit(1);
});
