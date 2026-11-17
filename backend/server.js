const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

// Ollama Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.1:latest";

// Load Predefined FAQ / Answers
let predefinedFAQ = [];
const faqPath = path.join(__dirname, "faq.json");
try {
    if (fs.existsSync(faqPath)) {
        predefinedFAQ = JSON.parse(fs.readFileSync(faqPath, "utf-8"));
    }
} catch (err) {
    console.warn("Could not load faq.json:", err.message);
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));

// Serve frontend static assets directly from frontend directory
const frontendPath = fs.existsSync(path.join(__dirname, "../frontend"))
    ? path.join(__dirname, "../frontend")
    : path.join(__dirname, "../Frontend");
app.use(express.static(frontendPath));
app.use("/assets", express.static(path.join(frontendPath, "assets")));

// Root route serves index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// =========================================================================
// Predefined FAQ Matcher
// Checks if the user's message matches any trigger in faq.json
// =========================================================================
function findPredefinedAnswer(message) {
    if (!message || !predefinedFAQ.length) return null;
    const cleanMsg = message.toLowerCase().trim().replace(/[?!.,;:]/g, "");

    for (const item of predefinedFAQ) {
        if (!item.triggers || !item.answer) continue;
        for (const trigger of item.triggers) {
            const cleanTrigger = trigger.toLowerCase().trim();
            // Match exact trigger or contained phrase
            if (cleanMsg === cleanTrigger || cleanMsg.includes(cleanTrigger)) {
                return item.answer;
            }
        }
    }
    return null;
}

// =========================================================================
// Ollama Helper: Call the Ollama REST API
// =========================================================================
async function ollamaChat(model, messages, options = {}) {
    const url = `${OLLAMA_BASE_URL}/api/chat`;
    const body = {
        model: model,
        messages: messages,
        stream: false,
        options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 2048,
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || "";
}

// =========================================================================
// API: Server status & health check
// =========================================================================
app.get("/api/status", async (req, res) => {
    try {
        const tagsRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
        if (!tagsRes.ok) throw new Error("Ollama not reachable");

        const tagsData = await tagsRes.json();
        const models = (tagsData.models || []).map(m => ({
            name: m.name,
            size: m.size,
            modified: m.modified_at
        }));

        res.json({
            status: "ok",
            appName: "Manav A.I.",
            ollamaConnected: true,
            defaultModel: DEFAULT_MODEL,
            availableModels: models,
            hasFaq: predefinedFAQ.length > 0
        });
    } catch (err) {
        res.json({
            status: "ok",
            appName: "Manav A.I.",
            ollamaConnected: false,
            defaultModel: DEFAULT_MODEL,
            availableModels: [],
            error: `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Is Ollama running? Start it with: ollama serve`
        });
    }
});

// =========================================================================
// API: Pull a new model from Ollama library
// =========================================================================
app.post("/api/models/pull", async (req, res) => {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: "Model name is required." });

    try {
        const pullRes = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: model, stream: false })
        });

        if (!pullRes.ok) {
            const errText = await pullRes.text();
            throw new Error(errText);
        }

        const pullData = await pullRes.json();
        res.json({ success: true, status: pullData.status || "success" });
    } catch (err) {
        res.status(500).json({ error: `Failed to pull model '${model}': ${err.message}` });
    }
});

// =========================================================================
// API: Chat endpoint — Predefined answer lookup + Ollama AI generation
// =========================================================================
app.post("/api/chat", async (req, res) => {
    const { message, history, model: clientModel } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "A message is required." });
    }

    const trimmedMsg = message.trim();

    // 1. Check for predefined instant answer first
    const predefinedReply = findPredefinedAnswer(trimmedMsg);
    if (predefinedReply) {
        return res.json({
            response: predefinedReply,
            model: "Predefined Knowledge Base",
            isPredefined: true
        });
    }

    // 2. Fall back to local Ollama AI model
    const activeModel = (clientModel && clientModel.trim()) || DEFAULT_MODEL;

    try {
        const ollamaMessages = [];

        // System prompt establishing Manav A.I.'s identity & capabilities
        ollamaMessages.push({
            role: "system",
            content: `You are Manav A.I., an intelligent, friendly, and highly capable AI assistant engineered by Manav Tyagi.
Important facts about your identity:
- You are running 100% LOCALLY on this device via Ollama (active model: ${activeModel}).
- You are completely private and offline-capable. No user data, messages, or files ever leave this computer.
- You provide clear, well-structured, modern, and insightful answers.
- When generating code, always use clean markdown code blocks with the language identifier specified (e.g., \`\`\`javascript, \`\`\`python).
- Always identify yourself as Manav A.I., developed by Manav Tyagi.`
        });

        // Append conversation history
        if (Array.isArray(history) && history.length > 0) {
            history.forEach(item => {
                if (item && item.text && (item.role === "user" || item.role === "model" || item.role === "assistant")) {
                    ollamaMessages.push({
                        role: item.role === "model" ? "assistant" : item.role,
                        content: item.text
                    });
                }
            });
        }

        // Append current message
        ollamaMessages.push({
            role: "user",
            content: trimmedMsg
        });

        const botResponseText = await ollamaChat(activeModel, ollamaMessages);

        res.json({
            response: botResponseText,
            model: activeModel,
            isPredefined: false
        });
    } catch (error) {
        console.error("Ollama API Error:", error);

        let userFriendlyError = "Sorry, there was an error processing your request. Please try again.";
        const errMsg = error.message || "";

        if (errMsg.includes("ECONNREFUSED") || errMsg.includes("not reachable")) {
            userFriendlyError = `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Please start Ollama with: ollama serve`;
        } else if (errMsg.includes("not found") || errMsg.includes("does not exist")) {
            userFriendlyError = `Model '${activeModel}' is not installed. Download it first with: ollama pull ${activeModel}`;
        } else if (errMsg.includes("out of memory")) {
            userFriendlyError = `Not enough system memory for '${activeModel}'. Try a smaller model like 'llama3.2' or 'gemma2:2b'.`;
        }

        res.status(500).json({
            error: userFriendlyError,
            details: process.env.NODE_ENV === "development" ? errMsg : undefined
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`===============================================`);
    console.log(`🧠 Manav A.I. — Local AI Assistant Server`);
    console.log(`🚀 Running at: http://localhost:${port}`);
    console.log(`🦙 Ollama URL: ${OLLAMA_BASE_URL}`);
    console.log(`📦 Default Model: ${DEFAULT_MODEL}`);
    console.log(`📚 Predefined Q&A Loaded: ${predefinedFAQ.length} topics`);
    console.log(`===============================================`);
});
