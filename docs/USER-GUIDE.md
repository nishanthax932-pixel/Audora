# Audora user guide

Audora is an AI workspace. The interface is designed for everyday users, while the AI engine and optional services run on infrastructure configured by the workspace operator.

## Start using the workspace

1. Open the Audora web app.
2. Look at the engine status beside the model selector. If it says **AI engine setup required**, the website is available but the operator has not configured a model connection yet.
3. Choose a task starter on the welcome screen, or type your own request.
4. Press Enter to send. Use Shift+Enter for a new line.
5. Use the stop button to cancel a response.

The status badge reports configuration only. It deliberately does not claim that a model is online or that a live inference request has succeeded.

## Everyday tools

- **New chat:** start a separate conversation.
- **Search chats:** find text in locally saved conversation history.
- **Export conversations:** download a JSON backup of the browser's saved chats.
- **Profile:** save a display name and optional personal context in this browser.
- **Attachments:** attach up to four text/code files, each no larger than 200 KB. Combined extracted text is limited to 10,000 characters.
- **Detailed explanation:** ask the model for structured steps, assumptions, checks, and a conclusion. This is not a request to reveal private internal chain-of-thought.
- **Web search:** available only when the operator configures a SearXNG JSON endpoint.
- **Image generation:** available only when the operator configures the private image service and its model.

## Privacy and storage

Conversation history and profile memory are stored in this browser's local storage. They do not automatically follow you to another device or browser. Clearing browser data can remove them, so export important conversations. The current starter does not provide account login, password recovery, cloud chat history, or cross-device synchronization.

The operator controls the model and optional services. Review the operator's privacy notice before entering sensitive information.

## If Audora cannot answer

- **AI engine setup required:** ask the operator to configure the local model endpoint and server-side API key.
- **API connection unavailable:** the browser cannot reach the Audora app API; check the app URL and deployment.
- **Model request failed:** the model service may be stopped, overloaded, or incorrectly configured.
- **Search unavailable:** SearXNG has not been configured or cannot be reached.
- **Image generation unavailable:** the private image service, checkpoint, GPU, or server key is missing.

## Operator requirements

A working UI is not a working AI deployment. Operators must supply a compatible inference server and licensed model checkpoint. Image generation and search are optional services. Before a public launch, add real authentication, durable storage, shared rate limiting, HTTPS, monitoring, backups, abuse controls, and published terms/privacy information. Follow [the deployment guide](DEPLOYMENT.md) and [release checklist](RELEASE-CHECKLIST.md).
