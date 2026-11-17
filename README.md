# Manav A.I. — Private & Local Conversational Assistant

**Manav A.I.** is a modern, ChatGPT-style conversational assistant engineered by **Manav Tyagi**. Designed from the ground up to run **100% locally** on your machine using [Ollama](https://ollama.com) and open-source large language models (such as `llama3.1:latest`). 

No cloud subscriptions, no API keys, and zero external network tracking — all processing, reasoning, and conversations stay private on your hardware.

---

## ✨ Core Features

- 🔒 **100% Private & Local Execution:** Powered by Ollama. Your prompts, code, and documents never leave your machine.
- ⚡ **Predefined Q&A Knowledge Base (`faq.json`):** Matches common questions with zero latency and 100% precision before querying the local LLM.
- 🦙 **Live Model Selector:** Switch between locally downloaded models (`llama3.1:latest`, `llama3.2`, `mistral`, `gemma2`, etc.) directly from the header dropdown without restarting.
- 📥 **In-App Model Puller:** Download new models from the Ollama library directly inside the web UI Settings dialog.
- 💓 **Real-Time Heartbeat & Connection Guard:** Live health-check polls the backend every 2.5 seconds. If the server goes offline, the UI alerts you with a pulsing red status dot and a slide-down banner, then automatically reconnects when the server returns.
- 🧠 **Multi-Turn Conversational Memory:** Preserves message history across turns for natural multi-step conversations.
- 💻 **Syntax-Highlighted Code Blocks:** Formats code snippets with language badges and one-click **"Copy code"** buttons.
- 🎨 **Modern Responsive UI:** Features light/dark theme toggling, auto-expanding message composer, and IME-safe submit (`Enter` to send, `Shift + Enter` for new lines).

---

## 🚀 Quick Start Guide

### 1. Install & Run Ollama
Download and install Ollama from [ollama.com/download](https://ollama.com/download).

Download the recommended model:
```bash
ollama pull llama3.1:latest
```

### 2. Install Project Dependencies
From the project root:
```bash
cd backend
npm install
cd ..
```

### 3. Launch Manav A.I.
From the project root:
```bash
npm start
```

### 4. Open in Your Browser
Navigate to:
```text
http://localhost:3000
```

---

## 📁 Project Structure

```text
.
├── package.json              # Root project scripts (npm start, npm run dev)
├── .gitignore                # Git exclusions (node_modules, .env, OS files)
├── LICENSE                   # MIT License
├── README.md                 # Project documentation
│
├── backend/                  # Server & AI Layer
│   ├── package.json          # Express, cors, dotenv, body-parser
│   ├── .env.example          # Environment variables template
│   ├── faq.json              # Instant predefined answers / Knowledge Base
│   └── server.js             # Express API server with Ollama proxy & static file serving
│
└── Frontend/                 # Clean Client-Side Web Application
    ├── index.html            # Main application interface
    ├── style.css             # Modern CSS tokens, responsive layout, animations
    ├── app.js                # Client controller: heartbeat, model selection, chat logic
    └── assets/
        └── bot-icon.png      # Manav A.I. avatar
```

---

## 📚 Customizing Predefined Answers (`faq.json`)

You can add instant answers for common questions in `backend/faq.json`:

```json
[
  {
    "id": "pricing",
    "triggers": ["how much does this cost", "is this free", "pricing"],
    "answer": "Manav A.I. is 100% free and open-source, running locally on your hardware."
  }
]
```

When a user's prompt matches any trigger in `triggers`, Manav A.I. responds instantly without waiting for the local model. All other prompts seamlessly fall back to the local Llama model.

---

## 🛠 Configuration

Create a `backend/.env` file to customize settings:

```env
# Ollama endpoint (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Default Model (default: llama3.1:latest)
OLLAMA_MODEL=llama3.1:latest

# Server Port (default: 3000)
PORT=3000
```

---

## 👨‍💻 Author & License
- **Created by:** Manav Tyagi
- **License:** MIT License
