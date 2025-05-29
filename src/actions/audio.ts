// テキストから音声を生成しBGMを合成する処理を行うモジュール
import "dotenv/config";

import { GraphAI } from "graphai";
import type { GraphData } from "graphai";
import * as agents from "@graphai/vanilla";
import ttsNijivoiceAgent from "../agents/tts_nijivoice_agent.js";
import addBGMAgent from "../agents/add_bgm_agent.js";
import combineAudioFilesAgent from "../agents/combine_audio_files_agent.js";
import ttsOpenaiAgent from "../agents/tts_openai_agent.js";
import ttsGoogleAgent from "../agents/tts_google_agent.js";
import { fileWriteAgent } from "@graphai/vanilla_node_agents";
import { MulmoScriptMethods } from "../methods/index.js";

import { MulmoStudioContext, MulmoBeat, MulmoStudioBeat, MulmoStudioMultiLingualData } from "../types/index.js";
import { fileCacheAgentFilter } from "../utils/filters.js";
import {
  getAudioArtifactFilePath,
  getAudioSegmentDirPath,
  getAudioCombinedFilePath,
  getOutputStudioFilePath,
  defaultBGMPath,
  mkdir,
  writingMessage,
  getAudioSegmentFilePath,
  resolveMediaSource,
} from "../utils/file.js";
import { text2hash, localizedText } from "../utils/utils.js";
import { MulmoStudioMethods } from "../methods/mulmo_studio.js";

const { default: __, ...vanillaAgents } = agents;

// const rion_takanashi_voice = "b9277ce3-ba1c-4f6f-9a65-c05ca102ded0"; // たかなし りおん
// const ben_carter_voice = "bc06c63f-fef6-43b6-92f7-67f919bd5dae"; // ベン・カーター
// 各TTSプロバイダー名を対応するエージェントにマッピング
const provider_to_agent = {
  nijivoice: "ttsNijivoiceAgent",
  openai: "ttsOpenaiAgent",
  google: "ttsGoogleAgent",
};

// 与えられたBeatから実際の音声ファイルのパスを取得する
// - 既に音声ファイルが指定されている場合はそのパスを返す
// - テキストが空なら音声は不要として undefined を返す
// - それ以外は出力先のファイルパスを生成する
const getAudioPath = (
  context: MulmoStudioContext,
  beat: MulmoBeat,
  audioFile: string,
  audioDirPath: string,
): string | undefined => {
  if (beat.audio?.type === "audio") {
    const path = resolveMediaSource(beat.audio.source, context);
    if (path) {
      return path;
    }
    throw new Error("Invalid audio source");
  }
  if (beat.text === "") {
    return undefined; // 音声生成の必要がない
  }
  return getAudioSegmentFilePath(audioDirPath, context.studio.filename, audioFile);
};

// 各Beatごとの音声生成に必要な情報を整理する前処理
// 生成する音声ファイル名やTTSのパラメータを計算して返す
const preprocessor = (namedInputs: {
  beat: MulmoBeat;
  studioBeat: MulmoStudioBeat;
  multiLingual: MulmoStudioMultiLingualData;
  index: number;
  context: MulmoStudioContext;
  audioDirPath: string;
}) => {
  const { beat, studioBeat, multiLingual, index, context, audioDirPath } = namedInputs;
  const { lang } = context;
  const voiceId = context.studio.script.speechParams.speakers[beat.speaker].voiceId;
  const speechOptions = MulmoScriptMethods.getSpeechOptions(context.studio.script, beat);
  const text = localizedText(beat, multiLingual, lang);
  const hash_string = `${text}${voiceId}${speechOptions?.instruction ?? ""}${speechOptions?.speed ?? 1.0}`;
  const audioFile = `${context.studio.filename}_${index}_${text2hash(hash_string)}` + (lang ? `_${lang}` : "");
  const audioPath = getAudioPath(context, beat, audioFile, audioDirPath);
  studioBeat.audioFile = audioPath;
  const needsTTS = !beat.audio && audioPath !== undefined;

  return {
    ttsAgent: provider_to_agent[context.studio.script.speechParams.provider],
    studioBeat,
    voiceId,
    speechOptions,
    audioPath,
    text,
    needsTTS,
  };
};

const graph_tts: GraphData = {
  nodes: {
    preprocessor: {
      agent: preprocessor,
      inputs: {
        beat: ":beat",
        studioBeat: ":studioBeat",
        multiLingual: ":multiLingual",
        index: ":__mapIndex",
        context: ":context",
        audioDirPath: ":audioDirPath",
      },
    },
    tts: {
      if: ":preprocessor.needsTTS",
      agent: ":preprocessor.ttsAgent",
      inputs: {
        text: ":preprocessor.text",
        file: ":preprocessor.audioPath",
        force: ":context.force",
        studio: ":context.studio", // for cache
        index: ":__mapIndex", // for cache
        sessionType: "audio", // for cache
        params: {
          voice: ":preprocessor.voiceId",
          speed: ":preprocessor.speechOptions.speed",
          instructions: ":preprocessor.speechOptions.instruction",
        },
      },
    },
  },
};

// Audio 作成用の GraphAI 定義
// 各ノードで TTS 実行やファイル結合を行う
const graph_data: GraphData = {
  version: 0.5,
  concurrency: 8,
  nodes: {
    context: {},
    audioArtifactFilePath: {},
    audioCombinedFilePath: {},
    outputStudioFilePath: {},
    audioDirPath: {},
    audioSegmentDirPath: {},
    map: {
      agent: "mapAgent",
      inputs: {
        rows: ":context.studio.script.beats",
        studioBeat: ":context.studio.beats",
        multiLingual: ":context.studio.multiLingual",
        audioDirPath: ":audioDirPath",
        audioSegmentDirPath: ":audioSegmentDirPath",
        context: ":context",
      },
      params: {
        rowKey: "beat",
        expandKeys: ["studioBeat", "multiLingual"],
      },
      graph: graph_tts,
    },
    combineFiles: {
      agent: "combineAudioFilesAgent",
      inputs: {
        map: ":map",
        context: ":context",
        combinedFileName: ":audioCombinedFilePath",
      },
      isResult: true,
    },
    fileWrite: {
      agent: "fileWriteAgent",
      inputs: {
        file: ":outputStudioFilePath",
        text: ":combineFiles.studio.toJSON()",
      },
    },
    addBGM: {
      agent: "addBGMAgent",
      params: {
        musicFile: process.env.PATH_BGM ?? defaultBGMPath,
      },
      inputs: {
        wait: ":combineFiles",
        voiceFile: ":audioCombinedFilePath",
        outputFile: ":audioArtifactFilePath",
        script: ":context.studio.script",
      },
      isResult: true,
    },
    title: {
      agent: "copyAgent",
      params: {
        namedKey: "title",
      },
      inputs: {
        title: "\n${:context.studio.script.title}\n\n${:context.studio.script.description}\nReference: ${:context.studio.script.reference}\n",
        waitFor: ":addBGM",
      },
    },
  },
};

const agentFilters = [
  {
    name: "fileCacheAgentFilter",
    agent: fileCacheAgentFilter,
    nodeIds: ["tts"],
  },
];

// スクリプトから音声ファイル一式を生成するメイン処理
// GraphAI に値を注入し、各BeatのTTSやBGM合成を実行する
export const audio = async (context: MulmoStudioContext) => {
  try {
    MulmoStudioMethods.setSessionState(context.studio, "audio", true);
    const { studio, fileDirs, lang } = context;
    const { outDirPath, audioDirPath } = fileDirs;
    const audioArtifactFilePath = getAudioArtifactFilePath(outDirPath, studio.filename);
    const audioSegmentDirPath = getAudioSegmentDirPath(audioDirPath, studio.filename);
    const audioCombinedFilePath = getAudioCombinedFilePath(audioDirPath, studio.filename, lang);
    const outputStudioFilePath = getOutputStudioFilePath(outDirPath, studio.filename);

    mkdir(outDirPath);
    mkdir(audioSegmentDirPath);

    graph_data.concurrency = MulmoScriptMethods.getSpeechProvider(studio.script) === "nijivoice" ? 1 : 8;
    const graph = new GraphAI(
      graph_data,
      {
        ...vanillaAgents,
        fileWriteAgent,
        ttsOpenaiAgent,
        ttsNijivoiceAgent,
        ttsGoogleAgent,
        addBGMAgent,
        combineAudioFilesAgent,
      },
      { agentFilters },
    );
    graph.injectValue("context", context);
    graph.injectValue("audioArtifactFilePath", audioArtifactFilePath);
    graph.injectValue("audioCombinedFilePath", audioCombinedFilePath);
    graph.injectValue("outputStudioFilePath", outputStudioFilePath);
    graph.injectValue("audioSegmentDirPath", audioSegmentDirPath);
    graph.injectValue("audioDirPath", audioDirPath);
    await graph.run();

    writingMessage(audioCombinedFilePath);
  } finally {
    MulmoStudioMethods.setSessionState(context.studio, "audio", false);
  }
};
