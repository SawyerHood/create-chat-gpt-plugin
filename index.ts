#!/usr/bin/env node

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
import path from "path";
import process from "process";
import prompts from "prompts";
import promiseSpawn from "@npmcli/promise-spawn";

dotenv.config();

async function run() {
  const result = await prompts({
    type: "text",
    name: "name",
    message: "What is your project named?",
    initial: "my-plugin",
  });
  const projectName = result.name.trim();

  const dir = path.resolve(projectName);

  const { model } = await prompts({
    type: "select",
    name: "model",
    message: "Which model would you like to use?",
    choices: [
      { title: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
      { title: "gpt-4", value: "gpt-4" },
    ],
    initial: 0,
  });

  let key = process.env.OPENAI_API_KEY ?? "";

  if (!key) {
    ({ key } = await prompts({
      type: "password",
      name: "key",
      message: "What is your OpenAI API key?",
    }));
  }

  const { topic } = await prompts({
    type: "text",
    name: "topic",
    message: "What is the topic of your plugin for GPT to use for generation?",
    initial:
      "an endpoint that takes a github PR link and returns the title of the PR",
  });

  const chain = await makeChain({
    key,
    model,
  });

  try {
    await fs.rm(dir);
  } catch {}

  await fs.cp(path.resolve(__dirname, ".template"), dir, { recursive: true });

  // const steps = await chain.call({
  //   input: `What are your high level thoughts on creating a plugin to ${topic}:
  //   `,
  // });

  // console.log(steps.response);
  console.log("Generating project, this may take a few minutes...");
  console.log("Generating index.ts file...");
  const indexResult = await chain.call({
    input: `You should create a plugin that ${topic}. Return only the index.ts file with no commentary:
    
    `,
  });

  await fs.writeFile(
    path.join(dir, "index.ts"),
    stripMarkdown(indexResult.response)
  );

  console.log("Generating openapi.yaml file...");
  const openapiResult = await chain.call({
    input: "Return only the openapi.yaml file with no commentary: \n\n",
  });

  await fs.writeFile(
    path.join(dir, "public", "openapi.yaml"),
    stripMarkdown(openapiResult.response)
  );

  console.log("Generating ai-plugin.json file...");
  const aiPluginResult = await chain.call({
    input:
      "Return only the ai-plugin.json file with no commentary make sure auth is set to none: \n\n",
  });

  await fs.writeFile(
    path.join(dir, "public", ".well-known", "ai-plugin.json"),
    stripMarkdown(aiPluginResult.response)
  );

  const packagesToInstall = await chain.call({
    input:
      "What packages should we install? Give the command to install them: \n\n ",
  });

  // regex that matches the npm install command
  const regex = /npm install (.*)\n/g;
  const matches = regex.exec(packagesToInstall.response);

  if (matches) {
    const packages = matches[1].split(" ");
    const { value } = await prompts({
      type: "confirm",
      name: "value",
      message: `GPT wants to install ${packages.join(", ")}, is this ok?`,
      initial: true,
    });

    if (value) {
      await promiseSpawn("npm", ["install", ...packages], {
        cwd: dir,
      });
    }
  }

  await promiseSpawn("npm", ["install"], {
    cwd: dir,
  });

  await promiseSpawn("npm", ["run", "build"], {
    cwd: dir,
  });

  console.log("Done! Run `npm start` to start the plugin.");
}

async function makeChain({ model, key }: { model: string; key: string }) {
  const { ts, openapi, aiPlugin } = await readTemplates();

  const chat = new ChatOpenAI({
    temperature: 0,
    modelName: model,
    openAIApiKey: key,
  });

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
    await fs.readFile(path.resolve(__dirname, ".template", "index.ts"), "utf-8")
  )
    .replace(/\{/g, `{{`)
    .replace(/\}/g, `}}`);

  const openapi = (
    await fs.readFile(
      path.resolve(__dirname, ".template", "public", "openapi.yaml"),
      "utf-8"
    )
  )
    .replace(/\{/g, `{{`)
    .replace(/\}/g, `}}`);

  const aiPlugin = (
    await fs.readFile(
      path.resolve(
        __dirname,
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

function stripMarkdown(input: string): string {
  // Define the patterns for the beginning and ending markdown code wrappers.
  const startPattern = /^```[a-z]*\r?\n/;
  const endPattern = /\r?\n```.*/;

  // Remove the code wrappers from the input string.
  const stripped = input.replace(startPattern, "").replace(endPattern, "");

  return stripped;
}

function setupDir(path: string) {}

run();
