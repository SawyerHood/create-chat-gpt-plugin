# make-chat-gpt-plugin
A script that uses GPT to generate a chat-gpt-plugin for you.

To get started clone this repo and set your Open AI key as an environment variable ex:

```bash
npm install
export OPENAI_API_KEY=your_key; npm start
```

The set up directory is relative to your current working directory. From there you will have to wait a minute
or so for GPT to work its magic. Once it is done cd into the directory, install the dependencies that are output and run:

```bash
npm i 
npm run build
npm run start
```
