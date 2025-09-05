# AI Assistant for VS Code

A local LLM-powered AI assistant that integrates with Ollama to provide intelligent code completion, chat assistance, and project context analysis.

## Features

- **🤖 AI Chat Interface** - Interactive chat panel with syntax-highlighted responses
- **⚡ Code Completion** - Context-aware suggestions for 13+ programming languages
- **💬 Inline Chat** - Quick code assistance without leaving your editor
- **📁 Project Context** - Automatic project analysis and reference file management
- **🛡️ Error Handling** - Robust error management with automatic retry mechanisms
- **🔧 Connection Management** - Visual status indicators and health monitoring

## Quick Start

### Prerequisites
1. Install [Ollama](https://ollama.ai)
2. Start Ollama: `ollama serve`
3. Install a model: `ollama pull llama2` (or `tinyllama` for smaller models)

### Installation

Since the extension is not on the Marketplace yet, use one of the following methods:

- Run from source (recommended for development):
  1. Clone this repo
  2. Install deps: `npm install`
  3. Build (or watch): `npm run compile`
  4. Press `F5` in VS Code to launch an Extension Development Host
  5. In the dev host, open the command palette and run "AI Assistant: Check Ollama Connection"

## Usage

### Chat Interface
- Click the **robot icon** in the activity bar
- Type questions or requests
- Get intelligent responses with code examples

### Code Completion
- Start typing in any supported language
- AI suggestions appear automatically
- Press `Tab` to accept suggestions
- Toggle with status bar item

### Inline Chat
- Select code or place cursor
- Use `Ctrl+I` → "Show Inline Chat"
- Get explanations and improvements

## Key Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Show Inline Chat | `Ctrl+I` | Open inline chat |
| Toggle Code Completion | `Ctrl+Alt+C` | Enable/disable completion |
| Send to Assistant | `Ctrl+Shift+A` | Send selected code to chat |
| Check Connection | - | Test Ollama connection |

## Status Bar

- ✅ **"$(check) Ollama Connected"** - Service running
- ⚠️ **"$(warning) Ollama Disconnected"** - Service unavailable
- 🤖 **"$(robot) AI Assistant"** - Open chat interface
- 💡 **"$(lightbulb) AI Completion"** - Toggle completion

## Troubleshooting

### Common Issues

**"Ollama Disconnected" Error:**
1. Check if Ollama is running: `ollama --version`
2. Start the service: `ollama serve`
3. Verify models: `ollama list`

**Code Completion Not Working:**
1. Check if enabled in settings or status bar
2. Verify model availability in chat interface
3. Check file language is supported

**Slow Responses:**
1. Use smaller models (tinyllama, phi3)
2. Reduce max tokens in settings
3. Check system resources


---
