// DOM Elements
const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const suggestionButtonsContainer = document.getElementById('suggestion-buttons');
const commandSuggestions = document.getElementById('command-suggestions');
const timeModal = document.getElementById('time-modal');
const notificationSound = document.getElementById('notification-sound');

// --- Configuration ---
const apiKey = "AIzaSyAX4FOixoe_aAmlDoeH_m8QUM9RkBXGilo"; // API Key Anda
const ownerNumber = '6285971105030';
const encryptedOwnerNumber = btoa(ownerNumber);

let pendingNotification = null;
let chatHistory = [];

// --- Event Listeners ---
messageForm.addEventListener('submit', handleFormSubmit);
suggestionButtonsContainer.addEventListener('click', handleSuggestionClick);
chatWindow.addEventListener('click', handleChatWindowClick);
messageInput.addEventListener('input', handleInputForCommands);
messageInput.addEventListener('blur', () => setTimeout(() => commandSuggestions.classList.add('hidden'), 150));
commandSuggestions.addEventListener('click', handleCommandSuggestionClick);

// Attempt to play audio on first user interaction to comply with browser policies
document.body.addEventListener('click', () => {
    const audio = document.getElementById('background-audio');
    if (audio.paused) {
        audio.play().catch(e => console.log("Autoplay was prevented."));
    }
}, { once: true });


/**
 * Calls the Gemini API to get a response.
 * @param {string} prompt - The user's prompt.
 * @returns {Promise<string>} - A promise that resolves to the AI's response.
 */
async function callGeminiAPI(prompt) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    const payload = {
        contents: chatHistory,
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            const errorMessage = errorData.error?.message || 'Terjadi kesalahan saat menghubungi API.';
            // Reset history if there's a critical error like invalid API key
            if (response.status === 400) chatHistory = [];
            return `Error ${response.status}: ${errorMessage}`;
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
            return aiResponse;
        } else {
            const blockReason = data.promptFeedback?.blockReason || 'Tidak ada konten';
            return `Maaf, respons diblokir. Alasan: ${blockReason}. Coba ajukan pertanyaan lain.`;
        }

    } catch (error) {
        console.error('Fetch Error:', error);
        return 'Gagal terhubung ke server AI. Silakan periksa koneksi internet Anda.';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    displayMessage(message, 'user');
    hideSuggestions();
    commandSuggestions.classList.add('hidden');

    const command = message.toLowerCase().split(' ')[0];

    if (command === '/ai2') {
        const commandContent = message.substring(4).trim();
        if (!commandContent) {
            displayMessage("Silakan masukkan pesan untuk pengingat.", 'ai', 'error');
        } else {
            pendingNotification = { message: commandContent };
            showTimeModal();
        }
    } else if (command === '/credits') {
        displayMessage('', 'credits');
    } else {
        const commandContent = message.toLowerCase().startsWith('/ai') ? message.substring(3).trim() : message;
        await processAiResponse(commandContent);
    }

    messageInput.value = '';
}

async function processAiResponse(userMessage) {
    if (!userMessage) {
        displayMessage("Silakan ketik pertanyaan Anda setelah perintah /ai.", 'ai', 'error');
        return;
    }

    const thinkingMessageId = `thinking-${Date.now()}`;
    displayMessage('', 'ai-thinking-process', null, thinkingMessageId);

    const finalResponse = await callGeminiAPI(userMessage);
    
    const thinkingMessage = document.getElementById(thinkingMessageId);
    if(thinkingMessage) {
        thinkingMessage.remove();
    }

    displayMessage(finalResponse, 'ai', 'final');
}

// --- Other Functions (UI, Time Modal, etc.) ---
function handleInputForCommands() {
    if (messageInput.value === '/') {
        commandSuggestions.classList.remove('hidden');
    } else {
        commandSuggestions.classList.add('hidden');
    }
}

function handleCommandSuggestionClick(e) {
    const item = e.target.closest('.suggestion-item');
    if (item) {
        messageInput.value = item.dataset.command;
        commandSuggestions.classList.add('hidden');
        messageInput.focus();
    }
}

async function handleSuggestionClick(e) {
    if (e.target.classList.contains('suggestion-btn')) {
        const message = e.target.textContent;
        messageInput.value = `/ai ${message}`;
        await handleFormSubmit(new Event('submit', { cancelable: true }));
    }
}

function showTimeModal() {
    timeModal.innerHTML = `
        <div class="bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl p-6 w-full max-w-sm border border-gray-700">
            <h3 class="text-lg font-bold mb-4 text-center text-cyan-400">Atur Waktu Notifikasi</h3>
            <p class="text-center text-gray-300 mb-4 text-sm bg-gray-700/80 p-2 rounded-md">Pesan: "${pendingNotification.message}"</p>
            <div class="flex justify-center items-center gap-2">
                <input type="number" id="hour-input" min="0" max="23" placeholder="JJ" class="w-16 bg-gray-700 text-center p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                <span class="font-bold text-lg">:</span>
                <input type="number" id="minute-input" min="0" max="59" placeholder="MM" class="w-16 bg-gray-700 text-center p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
                <span class="font-bold text-lg">:</span>
                <input type="number" id="second-input" min="0" max="59" placeholder="DD" class="w-16 bg-gray-700 text-center p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500" required>
            </div>
            <div class="mt-6 flex gap-3">
                <button id="cancel-time-btn" type="button" class="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">Batal</button>
                <button id="set-time-btn" type="button" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Atur Pengingat</button>
            </div>
        </div>`;
    timeModal.classList.remove('hidden');
    
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    document.getElementById('hour-input').value = String(now.getHours()).padStart(2, '0');
    document.getElementById('minute-input').value = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('second-input').value = String(now.getSeconds()).padStart(2, '0');

    document.getElementById('set-time-btn').addEventListener('click', handleSetTime);
    document.getElementById('cancel-time-btn').addEventListener('click', () => timeModal.classList.add('hidden'));
}

function handleSetTime() {
    const h = parseInt(document.getElementById('hour-input').value);
    const m = parseInt(document.getElementById('minute-input').value);
    const s = parseInt(document.getElementById('second-input').value);

    if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
        alert("Waktu tidak valid.");
        return;
    }

    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(h, m, s, 0);

    let delay = targetTime.getTime() - now.getTime();
    if (delay < 0) { delay += 24 * 60 * 60 * 1000; }
    
    const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    displayMessage(`Baik! Pengingat untuk "${pendingNotification.message}" telah diatur pada pukul ${timeString}.`, 'ai', 'info');

    setTimeout(() => {
        displayMessage(pendingNotification.message, 'ai', 'notification');
        notificationSound.play();
    }, delay);

    timeModal.classList.add('hidden');
    pendingNotification = null;
}

function displayMessage(text, sender, type = null, id = null) {
    const messageContainer = document.createElement('div');
    if (id) messageContainer.id = id;

    messageContainer.className = 'ai-message-container flex items-end gap-3';
    let contentHTML = '';
    let iconClass = 'fas fa-robot';
    let iconBg = 'bg-gradient-to-br from-cyan-500 to-blue-600';
    let messageBg = 'bg-gray-800/80 backdrop-blur-sm';

    if (sender === 'user') {
        messageContainer.className = 'user-message-container flex justify-end';
        messageContainer.innerHTML = `<div class="bg-blue-600 p-3 rounded-lg rounded-br-none max-w-lg"><p class="text-sm">${text}</p></div>`;
    } else {
         switch(sender) {
            case 'ai-thinking-process':
                iconClass = 'fas fa-spinner fa-spin';
                contentHTML = `<p class="text-sm">AI sedang memproses...</p>`;
                break;
            case 'credits':
                iconClass = 'fas fa-trophy';
                iconBg = 'bg-gradient-to-br from-amber-400 to-orange-500';
                const creditsText = `╭───『 🧠 𝙏𝙌𝙏𝙊 : 𝘾𝙔𝘽𝙀𝙍 𝘾𝙍𝙀𝘿𝙄𝙏𝙎 』───╮\n│ ╭─────────────⌬\n│ │ 👤 *Main Developer*:\n│ │     ꒒ꍏꈤꍏꃴꌩꈤ 🜲\n│ │ \n│ │ 💡 *Special Thanks*:\n│ │     ⦿ Agus // Core Architect ⚙️\n│ │     ⦿ LANA (Private Brain AI) 🧬\n│ │     ⦿ AllRes // System Backup ☁️\n│ │ \n│ │ 🛠️ *Support Team*:\n│ │     ⦿ CodePhantomX // Debugging Ops\n│ │     ⦿ ZeroTrace // Log Scanner\n│ │     ⦿ NoSignal404 // Data Ghost\n│ ╰─────────────⌬\n╰───────────────────────────────╯`;
                contentHTML = `<div class="markdown-box"><button data-action="copy-credits" class="copy-btn"><i class="fas fa-copy mr-1"></i> Salin</button><pre>${creditsText}</pre></div><div class="mt-3 pt-2 border-t border-gray-700/50 flex gap-2"><button data-action="show-decrypt" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-3 rounded-md transition-colors flex items-center gap-2"><i class="fas fa-user-secret"></i> Akses Kontak Rahasia</button></div>`;
                break;
            case 'decrypt-prompt':
                iconClass = 'fas fa-lock';
                iconBg = 'bg-gradient-to-br from-indigo-500 to-purple-600';
                contentHTML = `<p class="text-sm font-mono break-all">Data Terenkripsi:<br>${text}</p><div class="mt-3 pt-2 border-t border-gray-700/50 flex gap-2"><button data-action="decrypt-number" data-encrypted="${text}" class="text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded-md transition-colors flex items-center gap-2"><i class="fas fa-key"></i> Decrypt</button></div>`;
                break;
            case 'decrypt-result':
                 iconClass = 'fas fa-lock-open';
                iconBg = 'bg-gradient-to-br from-green-500 to-emerald-600';
                contentHTML = `<p class="text-sm">Dekripsi Berhasil. Kontak Owner:</p><p class="text-lg font-bold font-mono">${text}</p><div class="mt-3 pt-2 border-t border-gray-700/50 flex gap-2"><button data-action="contact-owner" data-number="${text}" class="text-xs bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md transition-colors flex items-center gap-2"><i class="fab fa-whatsapp"></i> Hubungi Sekarang</button></div>`;
                break;
            case 'error':
                iconClass = 'fas fa-exclamation-triangle'; iconBg = 'bg-red-500'; contentHTML = `<p class="text-sm text-red-300">${text}</p>`; break;
            case 'info':
                iconClass = 'fas fa-info-circle'; iconBg = 'bg-green-500'; contentHTML = `<p class="text-sm text-green-300">${text}</p>`; break;
            case 'ai': 
            default:
                const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                contentHTML = `<p class="text-sm">${formattedText}</p><div class="mt-3 pt-2 border-t border-gray-700/50 flex gap-2"><button data-action="translate" class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"><i class="fas fa-language mr-1"></i> Terjemahkan</button></div>`;
                break;
        }
        if (type === 'notification') {
            iconClass = 'fas fa-bell'; iconBg = 'bg-yellow-500 animate-pulse'; contentHTML = `<p class="font-bold text-yellow-300">PENGINGAT!</p><p class="text-sm mt-1">${text}</p>`;
        }
        messageContainer.innerHTML = `<div class="flex-shrink-0 w-8 h-8 rounded-full ${iconBg} flex items-center justify-center"><i class="${iconClass} text-white"></i></div><div class="${messageBg} p-3 rounded-lg rounded-bl-none max-w-lg">${contentHTML}</div>`;
    }

    chatWindow.appendChild(messageContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function handleChatWindowClick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    switch(action) {
        case 'translate':
            const p = button.closest('.p-3').querySelector('p');
            processAiResponse(`Terjemahkan teks berikut ke dalam Bahasa Inggris: "${p.innerText}"`);
            break;
        case 'copy-credits':
            const pre = button.nextElementSibling;
            const textarea = document.createElement('textarea');
            textarea.value = pre.textContent;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            button.innerHTML = '<i class="fas fa-check mr-1"></i> Disalin!';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy mr-1"></i> Salin';
                button.classList.remove('copied');
            }, 2000);
            break;
        case 'show-decrypt':
            displayMessage(encryptedOwnerNumber, 'decrypt-prompt');
            break;
        case 'decrypt-number':
            const decrypted = atob(button.dataset.encrypted);
            displayMessage(decrypted, 'decrypt-result');
            break;
        case 'contact-owner':
            window.open(`https://wa.me/${button.dataset.number}`, '_blank');
            break;
    }
}

function hideSuggestions() {
    if (!suggestionButtonsContainer.classList.contains('hidden')) {
        suggestionButtonsContainer.classList.add('hidden');
    }
}
