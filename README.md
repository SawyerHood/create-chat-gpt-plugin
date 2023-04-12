# create-chat-gpt-plugin

> What is this?

This is a script that uses GPT to generate a chat-gpt-plugin using node, typescript, and express for you. It generates an `index.ts` file, an `ai-plugin.json` file, and an `openapi.yaml` file for you. It has a pretty good chance of being able to create a working ChatGPT plugin for simple well documented apis off the bat.

To get started run:

```bash
npx create-chat-gpt-plugin@latest
```

You will be prompted for a name, wether to use gpt-4 or gpt-3.5 to generate the plugin, and a short description (a.k.a. the prompt) that the LLM will use to generate the ChatGPT plugin.

The set up directory is relative to your current working directory. From there you will have to wait a minute
or so for Open to work its magic. Once it is done cd into the directory and run `npm run start`and it should work.
