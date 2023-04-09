import { ChatOpenAI } from "langchain/chat_models";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "langchain/prompts";

import { ConversationChain } from "langchain/chains";
import { BufferMemory } from "langchain/memory";
import fs from "fs/promises";

import dotenv from "dotenv";
import readline from "readline";
import path from "path";
import process from "process";

dotenv.config();

async function run() {
  const chain = await makeChain();

  const directory = (await askQuestion(
    "Where should we put your plugin?: "
  )) as string;
  const topic = await askQuestion("What is the topic of your plugin: ");

  console.log("creating template...");

  const dir = path.resolve(process.cwd(), directory);

  try {
    await fs.rm(dir);
  } catch {}

  await fs.cp(".template", dir, { recursive: true });

  // const steps = await chain.call({
  //   input: `What are your high level thoughts on creating a plugin to ${topic}:
  //   `,
  // });

  // console.log(steps.response);

  console.log("Writing index.ts file...");
  const indexResult = await chain.call({
    input: `You should create a plugin that ${topic}. Return only the index.ts file with no commentary:
    
    `,
  });

  await fs.writeFile(
    path.join(dir, "index.ts"),
    stripMarkdown(indexResult.response)
  );

  console.log("Writing openapi.yaml file...");
  const openapiResult = await chain.call({
    input: "Return only the openapi.yaml file with no commentary: \n\n",
  });

  await fs.writeFile(
    path.join(dir, "public", "openapi.yaml"),
    stripMarkdown(openapiResult.response)
  );

  console.log("Writing ai-plugin.json file...");
  const aiPluginResult = await chain.call({
    input:
      "Return only the ai-plugin.json file with no commentary make sure auth is set to none: \n\n",
  });

  await fs.writeFile(
    path.join(dir, "public", ".well-known", "ai-plugin.json"),
    stripMarkdown(aiPluginResult.response)
  );

  const packagesToInstall = await chain.call({
    input: "What packages should we install?: \n\n  npm install ",
  });

  console.log("Packages to install: ", packagesToInstall.response);
}

async function makeChain() {
  const { ts, openapi, aiPlugin } = await readTemplates();

  const chat = new ChatOpenAI({ temperature: 0, modelName: "gpt-4" });

  const prompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are creating a Chat GPT plugin. You will generate the code for a Typescript and Express 
        server that will be called by a chatbot. You should make the api as simple as possible and only return the minimally required information. Assume that there is no auth required and the developer will hardcode any keys. The plugin consists of 3 parts an \`index.ts\` a \`openapi.yaml\` file, and an \`ai-plugin.json\` file. Here is an example of each:
        
        index.ts:
        \`\`\`
        ${ts}
        \`\`\`
        
        openapi.yaml:
        \`\`\`
        ${openapi}
        \`\`\`
        
        ai-plugin.json:
        \`\`\`
        ${aiPlugin}
        \`\`\`
        `
    ),
    new MessagesPlaceholder("history"),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);

  return new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
    prompt,
    llm: chat,
  });
}

async function readTemplates(): Promise<{
  ts: string;
  openapi: string;
  aiPlugin: string;
}> {
  const ts = (
    await fs.readFile(
      path.join(process.cwd(), ".template", "index.ts"),
      "utf-8"
    )
  )
    .replace(/\{/g, `{{`)
    .replace(/\}/g, `}}`);

  const openapi = (
    await fs.readFile(
      path.join(process.cwd(), ".template", "public", "openapi.yaml"),
      "utf-8"
    )
  )
    .replace(/\{/g, `{{`)
    .replace(/\}/g, `}}`);

  const aiPlugin = (
    await fs.readFile(
      path.join(
        process.cwd(),
        ".template",
        "public",
        ".well-known",
        "ai-plugin.json"
      ),
      "utf-8"
    )
  )
    .replace(/\{/g, `{{`)
    .replace(/\}/g, `}}`);

  return { ts, openapi, aiPlugin };
}

function askQuestion(question: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
}

function stripMarkdown(input: string): string {
  // Define the patterns for the beginning and ending markdown code wrappers.
  const startPattern = /^```[a-z]*\r?\n/;
  const endPattern = /\r?\n```.*/;

  // Remove the code wrappers from the input string.
  const stripped = input.replace(startPattern, "").replace(endPattern, "");

  return stripped;
}

run();
