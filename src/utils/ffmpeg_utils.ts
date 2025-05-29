// ffmpeg を扱うユーティリティ関数群
import ffmpeg from "fluent-ffmpeg";
import { GraphAILogger } from "graphai";

export type FfmpegContext = {
  command: ffmpeg.FfmpegCommand;
  inputCount: number;
  filterComplex: string[];
};

// ffmpeg コマンドを初期化して入力管理用のコンテキストを生成
export const FfmpegContextInit = (): FfmpegContext => {
  return {
    command: ffmpeg(),
    inputCount: 0,
    filterComplex: [],
  };
};

// ffmpeg コマンドに入力ファイルを追加し、そのインデックスを返す
export const FfmpegContextAddInput = (context: FfmpegContext, input: string) => {
  context.command.input(input);
  context.inputCount++;
  return context.inputCount - 1; // 現在の入力番号を返す
};

// オーディオを標準フォーマット(44100Hz stereo)に変換し、必要に応じて長さを調整
export const FfmpegContextPushFormattedAudio = (
  context: FfmpegContext,
  sourceId: string,
  outputId: string,
  duration: number | undefined = undefined,
) => {
  if (duration !== undefined) {
    context.filterComplex.push(`${sourceId}atrim=duration=${duration},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${outputId}`);
  } else {
    context.filterComplex.push(`${sourceId}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${outputId}`);
  }
};

// ファイルを入力として登録し、整形済みオーディオを返す
export const FfmpegContextInputFormattedAudio = (
  context: FfmpegContext,
  input: string,
  duration: number | undefined = undefined,
) => {
  const index = FfmpegContextAddInput(context, input);
  const audioId = `[a${index}]`;
  FfmpegContextPushFormattedAudio(context, `[${index}:a]`, audioId, duration);
  return audioId;
};

// FFmpeg コマンドを実行して動画/音声を生成する
export const FfmpegContextGenerateOutput = (
  context: FfmpegContext,
  output: string,
  options: string[] = [],
): Promise<number> => {
  return new Promise((resolve, reject) => {
    context.command
      .complexFilter(context.filterComplex)
      .outputOptions(options)
      .output(output)
      .on("start", (__cmdLine) => {
        GraphAILogger.log("Started FFmpeg ..."); // with command:', cmdLine);
      })
      .on("error", (err, stdout, stderr) => {
        GraphAILogger.error("Error occurred:", err);
        GraphAILogger.error("FFmpeg stdout:", stdout);
        GraphAILogger.error("FFmpeg stderr:", stderr);
        GraphAILogger.info("Video/Audio creation failed. An unexpected error occurred.");
        reject();
      })
      .on("end", () => {
        resolve(0);
      })
      .run();
  });
};

export const ffmpegGetMediaDuration = (filePath: string) => {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        GraphAILogger.info("Error while getting metadata:", err);
        reject(err);
      } else {
        resolve(metadata.format.duration!);
      }
    });
  });
};
