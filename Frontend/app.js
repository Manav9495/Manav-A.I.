/**
 * Manav A.I. — Ollama-Powered Client Controller
 * Runs entirely locally via Ollama. No API keys needed.
 * Compliant with modern-web-guidance for IME-safe enter-to-submit,
 * dark-mode color-scheme, and field-sizing: content.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const messagesViewport = document.getElementById('messagesViewport');
    const chatThread = document.getElementById('chatThread');
    const welcomeContainer = document.getElementById('welcomeContainer');
    const historyList = document.getElementById('history-list');
    const emptyHistoryNotice = document.getElementById('emptyHistoryNotice');
    const newChatBtn = document.getElementById('newChatBtn');
    const chatTitle = document.getElementById('chatTitle');
    const modelBadgeText = document.getElementById('modelBadgeText');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');

    // Ollama status elements
    const ollamaStatusBtn = document.getElementById('ollamaStatusBtn');
    const ollamaStatusDot = document.getElementById('ollamaStatusDot');
    const ollamaStatusText = document.getElementById('ollamaStatusText');

    // Model selector in header
    const modelSelect = document.getElementById('modelSelect');

    // Settings Dialog Elements
    const settingsDialog = document.getElementById('settingsDialog');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeSettingsDialogBtn = document.getElementById('closeSettingsDialogBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsModelSelect = document.getElementById('settingsModelSelect');
    const pullModelInput = document.getElementById('pullModelInput');
    const pullModelBtn = document.getElementById('pullModelBtn');
    const pullModelStatus = document.getElementById('pullModelStatus');
    const themeSelect = document.getElementById('themeSelect');
    const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');

    // --- State ---
    // Auto-detect backend port: if served on port 3000 use relative path, otherwise target localhost:3000 (e.g. VS Code Live Server on :5500)
    const API_BASE = (window.location.port === '3000') ? '' : 'http://localhost:3000';
    let conversations = [];
    let activeConversationId = null;
    let isGenerating = false;
    let availableModels = [];
    let selectedModel = localStorage.getItem('manav_ai_selected_model') || 'llama3.1:latest';
    let ollamaConnected = false;
    let serverOnline = false;
    let wasOffline = false;
    let heartbeatTimer = null;

    // Alert Banner Elements
    const connectionAlertBanner = document.getElementById('connectionAlertBanner');
    const connectionAlertText = document.getElementById('connectionAlertText');

    // --- Initialization ---
    initTheme();
    loadStoredData();
    checkOllamaStatus();
    // Heartbeat: Check connection every 2.5 seconds in real time
    heartbeatTimer = setInterval(checkOllamaStatus, 2500);
    initFallbackTextareaAutoGrow();
    setupEventListeners();

    // =========================================================================
    // Theme Management
    // =========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('manav_ai_theme') || 'system';
        applyTheme(savedTheme);
        if (themeSelect) themeSelect.value = savedTheme;

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const currentPref = localStorage.getItem('manav_ai_theme') || 'system';
            if (currentPref === 'system') applyTheme('system');
        });
    }

    function applyTheme(theme) {
        let effective = theme;
        if (theme === 'system') {
            effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', effective);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('manav_ai_theme', nextTheme);
        applyTheme(nextTheme);
        if (themeSelect) themeSelect.value = nextTheme;
    }

    // =========================================================================
    // Fallback for field-sizing: content (Modern Web Guidance)
    // =========================================================================
    function initFallbackTextareaAutoGrow() {
        if (!window.CSS || !CSS.supports('field-sizing', 'content')) {
            const resizeTextarea = () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
            };
            chatInput.addEventListener('input', resizeTextarea);
        }
    }

    // =========================================================================
    // Alert Banner Helpers
    // =========================================================================
    function showAlertBanner(htmlMessage, type = 'offline') {
        if (!connectionAlertBanner || !connectionAlertText) return;
        connectionAlertBanner.className = `connection-alert-banner ${type}`;
        connectionAlertText.innerHTML = htmlMessage;
        connectionAlertBanner.style.display = 'flex';
    }

    function hideAlertBanner() {
        if (!connectionAlertBanner) return;
        if (!connectionAlertBanner.classList.contains('reconnected')) {
            connectionAlertBanner.style.display = 'none';
        }
    }

    function showReconnectedBanner() {
        if (!connectionAlertBanner || !connectionAlertText) return;
        connectionAlertBanner.className = 'connection-alert-banner reconnected';
        connectionAlertText.innerHTML = '✅ Backend Server Reconnected!';
        connectionAlertBanner.style.display = 'flex';
        setTimeout(() => {
            connectionAlertBanner.style.display = 'none';
        }, 3000);
    }

    // =========================================================================
    // Ollama Status & Real-Time Connection Monitoring
    // =========================================================================
    async function checkOllamaStatus() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
            const res = await fetch(`${API_BASE}/api/status`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('Server returned ' + res.status);
            const data = await res.json();

            serverOnline = true;
            ollamaConnected = Boolean(data.ollamaConnected);
            availableModels = data.availableModels || [];

            const badgeDot = document.querySelector('.badge-dot');

            if (ollamaConnected) {
                // Online & Ollama Connected: GREEN
                ollamaStatusDot.className = 'key-dot connected';
                ollamaStatusText.textContent = 'Ollama Online';
                if (badgeDot) badgeDot.className = 'badge-dot';

                if (wasOffline) {
                    showReconnectedBanner();
                    wasOffline = false;
                } else {
                    hideAlertBanner();
                }

                populateModelDropdowns();
            } else {
                // Server running, but Ollama stopped: YELLOW
                ollamaStatusDot.className = 'key-dot warning';
                ollamaStatusText.textContent = 'Ollama Stopped';
                if (badgeDot) badgeDot.className = 'badge-dot warning';

                showAlertBanner('⚠️ Ollama is not running on your machine. Start it with <code>ollama serve</code> in your terminal.', 'warning');
            }

            modelBadgeText.textContent = selectedModel;

        } catch (e) {
            clearTimeout(timeoutId);
            serverOnline = false;
            wasOffline = true;

            // Server is killed or down: RED with pulse
            ollamaStatusDot.className = 'key-dot offline';
            ollamaStatusText.textContent = 'Server Offline';
            const badgeDot = document.querySelector('.badge-dot');
            if (badgeDot) badgeDot.className = 'badge-dot offline';

            showAlertBanner('🔌 Backend Server is Offline — Start it by running <code>npm start</code> in your terminal.', 'offline');
        }
    }

    function populateModelDropdowns() {
        // Header model selector
        modelSelect.innerHTML = '';
        // Settings model selector
        settingsModelSelect.innerHTML = '';

        if (availableModels.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No models installed';
            modelSelect.appendChild(opt);
            settingsModelSelect.appendChild(opt.cloneNode(true));
            return;
        }

        availableModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name;
            if (m.name === selectedModel) opt.selected = true;
            modelSelect.appendChild(opt);
            settingsModelSelect.appendChild(opt.cloneNode(true));
        });

        // If the saved model isn't in the list, default to the first available
        if (!availableModels.some(m => m.name === selectedModel) && availableModels.length > 0) {
            selectedModel = availableModels[0].name;
            localStorage.setItem('manav_ai_selected_model', selectedModel);
            modelSelect.value = selectedModel;
            settingsModelSelect.value = selectedModel;
        }

        modelBadgeText.textContent = selectedModel;
    }

    // =========================================================================
    // Conversation & History Persistence
    // =========================================================================
    function loadStoredData() {
        try {
            const savedConversations = localStorage.getItem('manav_ai_conversations');
            conversations = savedConversations ? JSON.parse(savedConversations) : [];
        } catch (e) {
            console.error('Error parsing stored conversations:', e);
            conversations = [];
        }

        const lastActiveId = localStorage.getItem('manav_ai_active_conversation_id');
        if (lastActiveId && conversations.some(c => c.id === lastActiveId)) {
            setActiveConversation(lastActiveId);
        } else if (conversations.length > 0) {
            setActiveConversation(conversations[0].id);
        } else {
            createNewConversation(false);
        }

        renderHistorySidebar();
    }

    function saveConversations() {
        localStorage.setItem('manav_ai_conversations', JSON.stringify(conversations));
        if (activeConversationId) {
            localStorage.setItem('manav_ai_active_conversation_id', activeConversationId);
        }
    }

    function createNewConversation(focusInput = true) {
        const newId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newConv = {
            id: newId,
            title: 'New Conversation',
            createdAt: new Date().toISOString(),
            messages: []
        };

        conversations.unshift(newConv);
        saveConversations();
        setActiveConversation(newId);
        renderHistorySidebar();

        if (focusInput) chatInput.focus();
    }

    function setActiveConversation(id) {
        activeConversationId = id;
        saveConversations();
        renderHistorySidebar();
        renderActiveChat();
    }

    function deleteConversation(id, event) {
        if (event) event.stopPropagation();
        conversations = conversations.filter(c => c.id !== id);
        saveConversations();

        if (activeConversationId === id) {
            if (conversations.length > 0) {
                setActiveConversation(conversations[0].id);
            } else {
                createNewConversation(false);
            }
        } else {
            renderHistorySidebar();
        }
    }

    function renderHistorySidebar() {
        historyList.innerHTML = '';

        if (conversations.length === 0) {
            emptyHistoryNotice.style.display = 'block';
            return;
        }

        emptyHistoryNotice.style.display = 'none';

        conversations.forEach(conv => {
            const li = document.createElement('li');
            li.className = `history-item ${conv.id === activeConversationId ? 'active' : ''}`;
            li.setAttribute('role', 'button');
            li.tabIndex = 0;

            const itemLeft = document.createElement('div');
            itemLeft.className = 'history-item-left';

            const iconSpan = document.createElement('span');
            iconSpan.className = 'history-item-icon';
            iconSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

            const titleSpan = document.createElement('span');
            titleSpan.className = 'history-title-wrap';
            titleSpan.textContent = conv.title || 'Untitled Chat';

            itemLeft.appendChild(iconSpan);
            itemLeft.appendChild(titleSpan);

            const delBtn = document.createElement('button');
            delBtn.className = 'history-delete-btn';
            delBtn.setAttribute('aria-label', `Delete ${conv.title}`);
            delBtn.title = 'Delete chat';
            delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
            delBtn.addEventListener('click', (e) => deleteConversation(conv.id, e));

            li.addEventListener('click', () => {
                setActiveConversation(conv.id);
                if (window.innerWidth <= 768) closeSidebar();
            });

            li.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveConversation(conv.id);
                }
            });

            li.appendChild(itemLeft);
            li.appendChild(delBtn);
            historyList.appendChild(li);
        });
    }

    function getActiveConversation() {
        return conversations.find(c => c.id === activeConversationId);
    }

    // =========================================================================
    // Chat Rendering
    // =========================================================================
    function renderActiveChat() {
        const conv = getActiveConversation();
        chatThread.innerHTML = '';

        if (!conv || conv.messages.length === 0) {
            welcomeContainer.style.display = 'flex';
            chatTitle.textContent = 'New Conversation';
            return;
        }

        welcomeContainer.style.display = 'none';
        chatTitle.textContent = conv.title || 'Conversation';

        conv.messages.forEach(msg => {
            appendMessageToDOM(msg.text, msg.role, false);
        });

        scrollToBottom();
    }

    function appendMessageToDOM(text, role, animate = true) {
        const isUser = role === 'user';
        const row = document.createElement('div');
        row.className = `message-row ${isUser ? 'user-row' : 'bot-row'}`;
        if (!animate) row.style.animation = 'none';

        if (!isUser) {
            const avatar = document.createElement('div');
            avatar.className = 'message-avatar bot-avatar';
            avatar.innerHTML = `<img src="./assets/bot-icon.png" alt="Manav A.I.">`;
            row.appendChild(avatar);
        }

        const bubbleContainer = document.createElement('div');
        bubbleContainer.className = 'bubble-container';

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`;

        if (isUser) {
            bubble.textContent = text;
        } else {
            bubble.innerHTML = renderMarkdown(text);
            attachCodeBlockCopyEvents(bubble);
        }
        bubbleContainer.appendChild(bubble);

        if (!isUser) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn-msg-action';
            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span style="color:#10b981">Copied!</span>`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>`;
                    }, 2000);
                });
            });

            actions.appendChild(copyBtn);
            bubbleContainer.appendChild(actions);
        }

        row.appendChild(bubbleContainer);
        chatThread.appendChild(row);
        scrollToBottom();
        return row;
    }

    function showTypingIndicator() {
        const row = document.createElement('div');
        row.className = 'message-row bot-row typing-row';
        row.id = 'typingIndicatorRow';

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar bot-avatar';
        avatar.innerHTML = `<img src="./assets/bot-icon.png" alt="Manav A.I.">`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble bot-bubble typing-bubble';
        bubble.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;

        row.appendChild(avatar);
        row.appendChild(bubble);
        chatThread.appendChild(row);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicatorRow');
        if (indicator) indicator.remove();
    }

    function scrollToBottom() {
        messagesViewport.scrollTo({ top: messagesViewport.scrollHeight, behavior: 'smooth' });
    }

    // =========================================================================
    // Markdown & Code Highlighting Parser
    // =========================================================================
    function escapeHtml(string) {
        const div = document.createElement('div');
        div.textContent = string;
        return div.innerHTML;
    }

    function renderMarkdown(rawText) {
        if (!rawText) return '';

        const codeBlocks = [];
        let parsed = rawText.replace(/```([a-zA-Z0-9_\-#+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const index = codeBlocks.length;
            const languageLabel = (lang || 'code').toLowerCase();
            codeBlocks.push({ lang: languageLabel, code: code.replace(/\n$/, '') });
            return `__MANAV_AI_CODE_BLOCK_${index}__`;
        });

        parsed = parsed.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        parsed = parsed.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        parsed = parsed.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        parsed = parsed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        parsed = parsed.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
        parsed = parsed.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
        parsed = parsed.replace(/<\/ul>\s*<ul>/g, '');

        const paragraphs = parsed.split(/\n{2,}/);
        parsed = paragraphs
            .map(p => {
                p = p.trim();
                if (!p) return '';
                if (p.startsWith('<h') || p.startsWith('<ul>') || p.startsWith('__MANAV_AI_CODE_BLOCK_')) return p;
                return `<p>${p.replace(/\n/g, '<br>')}</p>`;
            })
            .join('');

        codeBlocks.forEach((item, index) => {
            const escapedCode = escapeHtml(item.code);
            const blockHtml = `
                <div class="code-block-container">
                    <div class="code-block-header">
                        <span>${item.lang}</span>
                        <button type="button" class="copy-code-btn" data-code="${encodeURIComponent(item.code)}">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            <span>Copy code</span>
                        </button>
                    </div>
                    <pre><code>${escapedCode}</code></pre>
                </div>
            `;
            parsed = parsed.replace(`__MANAV_AI_CODE_BLOCK_${index}__`, blockHtml);
        });

        return parsed;
    }

    function attachCodeBlockCopyEvents(container) {
        const copyBtns = container.querySelectorAll('.copy-code-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const rawCode = decodeURIComponent(btn.getAttribute('data-code'));
                navigator.clipboard.writeText(rawCode).then(() => {
                    const originalHtml = btn.innerHTML;
                    btn.innerHTML = `<span style="color:#10b981">✓ Copied</span>`;
                    setTimeout(() => { btn.innerHTML = originalHtml; }, 2000);
                });
            });
        });
    }

    // =========================================================================
    // Message Dispatching & Ollama Integration
    // =========================================================================
    async function handleSendMessage(messageText) {
        if (!messageText || isGenerating) return;

        // Block if server is offline
        if (!serverOnline) {
            appendMessageToDOM('⚠️ **Cannot send message:** The backend server is currently offline. Please run `npm start` in your terminal to reconnect.', 'model', true);
            showAlertBanner('🔌 Backend Server is Offline — Start it by running <code>npm start</code> in your terminal.', 'offline');
            return;
        }

        let conv = getActiveConversation();
        if (!conv) {
            createNewConversation(false);
            conv = getActiveConversation();
        }

        welcomeContainer.style.display = 'none';

        // Auto-title from first prompt
        if (conv.messages.length === 0) {
            const trimmedTitle = messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText;
            conv.title = trimmedTitle;
            chatTitle.textContent = trimmedTitle;
            renderHistorySidebar();
        }

        // Record User Message
        const userMsgObj = { role: 'user', text: messageText, timestamp: new Date().toISOString() };
        conv.messages.push(userMsgObj);
        saveConversations();
        appendMessageToDOM(messageText, 'user', true);

        // Reset input
        chatInput.value = '';
        if (!window.CSS || !CSS.supports('field-sizing', 'content')) {
            chatInput.style.height = 'auto';
        }
        setGeneratingState(true);
        showTypingIndicator();

        try {
            // Build history payload
            const historyPayload = conv.messages
                .slice(0, -1)
                .map(m => ({ role: m.role, text: m.text }));

            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageText,
                    history: historyPayload,
                    model: selectedModel
                })
            });

            const data = await response.json();
            removeTypingIndicator();

            if (!response.ok) {
                const errorMsg = data.error || 'Server returned an error.';
                appendMessageToDOM(`⚠️ **Error:** ${errorMsg}`, 'model', true);
                return;
            }

            const botReply = data.response;
            const botMsgObj = { role: 'model', text: botReply, timestamp: new Date().toISOString() };

            conv.messages.push(botMsgObj);
            saveConversations();
            appendMessageToDOM(botReply, 'model', true);

        } catch (err) {
            removeTypingIndicator();
            console.error('Fetch error:', err);
            serverOnline = false;
            wasOffline = true;
            ollamaStatusDot.className = 'key-dot offline';
            ollamaStatusText.textContent = 'Server Offline';
            const badgeDot = document.querySelector('.badge-dot');
            if (badgeDot) badgeDot.className = 'badge-dot offline';
            showAlertBanner('🔌 Backend Server is Offline — Start it by running <code>npm start</code> in your terminal.', 'offline');
            appendMessageToDOM('⚠️ **Connection Lost:** The backend server stopped responding. Please start it with `npm start` in your terminal.', 'model', true);
        } finally {
            setGeneratingState(false);
            chatInput.focus();
        }
    }

    function setGeneratingState(generating) {
        isGenerating = generating;
        sendButton.disabled = generating;
        chatInput.disabled = generating;
    }

    // =========================================================================
    // Model Pull (Download New Models)
    // =========================================================================
    async function pullModel(modelName) {
        pullModelBtn.disabled = true;
        pullModelStatus.textContent = `⏳ Pulling "${modelName}"... This may take a few minutes.`;
        pullModelStatus.style.color = 'var(--accent)';

        try {
            const res = await fetch(`${API_BASE}/api/models/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                pullModelStatus.textContent = `✅ "${modelName}" pulled successfully!`;
                pullModelStatus.style.color = '#10b981';
                pullModelInput.value = '';
                // Refresh model list
                await checkOllamaStatus();
                populateModelDropdowns();
            } else {
                pullModelStatus.textContent = `❌ ${data.error || 'Failed to pull model.'}`;
                pullModelStatus.style.color = '#ef4444';
            }
        } catch (err) {
            pullModelStatus.textContent = `❌ Network error: ${err.message}`;
            pullModelStatus.style.color = '#ef4444';
        } finally {
            pullModelBtn.disabled = false;
        }
    }

    // =========================================================================
    // Event Listeners & IME-Safe Submit
    // =========================================================================
    function setupEventListeners() {
        // Form submit
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (text) handleSendMessage(text);
        });

        // IME-safe enter-to-submit (Modern Web Guidance)
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (event.isComposing || event.keyCode === 229) return;
                chatForm.requestSubmit();
            }
        });

        // Suggestion card clicks
        document.querySelectorAll('.suggestion-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    chatInput.value = prompt;
                    handleSendMessage(prompt);
                }
            });
        });

        // New Chat & Keyboard Shortcut (Cmd+K / Ctrl+K)
        newChatBtn.addEventListener('click', () => {
            createNewConversation(true);
            if (window.innerWidth <= 768) closeSidebar();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                createNewConversation(true);
                if (window.innerWidth <= 768) closeSidebar();
            }
        });

        // Header model selector — live switch
        modelSelect.addEventListener('change', () => {
            selectedModel = modelSelect.value;
            localStorage.setItem('manav_ai_selected_model', selectedModel);
            modelBadgeText.textContent = selectedModel;
            if (settingsModelSelect) settingsModelSelect.value = selectedModel;
        });

        // Sidebar Toggle
        toggleSidebarBtn.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('open');
            } else {
                sidebar.classList.toggle('collapsed');
            }
        });

        closeSidebarBtn.addEventListener('click', closeSidebar);
        sidebarBackdrop.addEventListener('click', closeSidebar);

        function closeSidebar() {
            sidebar.classList.remove('open');
        }

        // Theme Toggle
        themeToggleBtn.addEventListener('click', toggleTheme);

        // Ollama status pill -> open settings
        ollamaStatusBtn.addEventListener('click', openSettings);
        openSettingsBtn.addEventListener('click', openSettings);

        // Settings Dialog
        function openSettings() {
            themeSelect.value = localStorage.getItem('manav_ai_theme') || 'system';
            if (settingsModelSelect) settingsModelSelect.value = selectedModel;
            pullModelStatus.innerHTML = 'Browse models at <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer">ollama.com/library &rarr;</a>';
            pullModelStatus.style.color = '';
            settingsDialog.showModal();
        }

        function closeSettings() {
            settingsDialog.close();
        }

        closeSettingsDialogBtn.addEventListener('click', closeSettings);
        cancelSettingsBtn.addEventListener('click', closeSettings);

        // Pull Model
        pullModelBtn.addEventListener('click', () => {
            const modelName = pullModelInput.value.trim();
            if (modelName) pullModel(modelName);
        });

        pullModelInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const modelName = pullModelInput.value.trim();
                if (modelName) pullModel(modelName);
            }
        });

        // Save Settings
        saveSettingsBtn.addEventListener('click', () => {
            // Model
            if (settingsModelSelect) {
                selectedModel = settingsModelSelect.value;
                localStorage.setItem('manav_ai_selected_model', selectedModel);
                modelSelect.value = selectedModel;
                modelBadgeText.textContent = selectedModel;
            }

            // Theme
            const chosenTheme = themeSelect.value;
            localStorage.setItem('manav_ai_theme', chosenTheme);
            applyTheme(chosenTheme);

            closeSettings();
        });

        // Clear All History
        clearAllHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all saved conversations? This cannot be undone.')) {
                conversations = [];
                localStorage.removeItem('manav_ai_conversations');
                localStorage.removeItem('manav_ai_active_conversation_id');
                createNewConversation(false);
                closeSettings();
            }
        });
    }
});
