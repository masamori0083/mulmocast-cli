import { translate } from "../../../actions/index.js";
import { initializeContext } from "../../../cli/helpers.js";
import { CliArgs } from "../../../types/cli_types.js";

export const handler = async (argv: CliArgs<{ i?: string }>) => {
  const context = await initializeContext(argv);
  await translate(context);
};
