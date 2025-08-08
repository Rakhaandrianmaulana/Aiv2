// --- DOM Elements ---
const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const suggestionButtonsContainer = document.getElementById('suggestion-buttons');
const commandSuggestions = document.getElementById('command-suggestions');
const timeModal = document.getElementById('time-modal');
const notificationSound = document.getElementById('notification-sound');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const removeFileBtn = document.getElementById('remove-file-btn');

// --- Configuration ---
const apiKey = "AIzaSyBOT0SudOG4eADrZ23XOwcql8STHZFsHug"; // API Key updated
const ownerNumber = '6285971105030';
const encryptedOwnerNumber = btoa(ownerNumber);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// --- State ---
let pendingNotification = null;
let chatHistory = []; // This will now store the full conversation history
let uploadedFile = null; // To store { base64, mimeType, fileObject }

// --- Event Listeners ---
messageForm.addEventListener('submit', handleFormSubmit);
suggestionButtonsContainer.addEventListener('click', handleSuggestionClick);
chatWindow.addEventListener('click', handleChatWindowClick);
messageInput.addEventListener('input', handleInputForCommands);
messageInput.addEventListener('blur', () => setTimeout(() => commandSuggestions.classList.add('hidden'), 200));
commandSuggestions.addEventListener('click', handleCommandSuggestionClick);
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelected);
removeFileBtn.addEventListener('click', removeSelectedFile);

// Attempt to play audio on first user interaction
document.body.addEventListener('click', () => {
    const audio = document.getElementById('background-audio');
    if (audio.paused) {
        audio.play().catch(e => console.log("Autoplay was prevented by the browser."));
    }
}, { once: true });

/**
 * Calls the Gemini API with conversation history and optional image data.
 * @param {string} prompt - The user's prompt.
 * @param {object|null} image - The uploaded image data { base64, mimeType }.
 * @returns {Promise<string>} - A promise that resolves to the AI's response.
 */
async function callGeminiAPI(prompt, image = null) {
    // Use a single, powerful multimodal model that supports history
    const model = 'gemini-1.5-flash-latest'; // Switched to a newer model for better history support
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Construct the user's turn. It can contain both text and an image.
    let userParts = [];
    if (prompt) {
        userParts.push({ text: prompt });
    }
    if (image) {
        userParts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.base64
            }
        });
    }

    // Add the new user message to the history for the API call
    const newHistory = [...chatHistory, { role: "user", parts: userParts }];
    const payload = { contents: newHistory };
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            return `Error ${response.status}: ${errorData.error?.message || 'Terjadi kesalahan saat menghubungi API.'}`;
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            const aiResponse = data.candidates[0].content.parts[0].text;
            
            // IMPORTANT: Update the main chatHistory state after a successful call
            chatHistory.push({ role: "user", parts: userParts });
            chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
            
            return aiResponse;
        } else {
            const blockReason = data.promptFeedback?.blockReason || 'Tidak ada konten yang dihasilkan';
            // Do not add the blocked turn to history
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
    if (!message && !uploadedFile) return;

    // If there's an image but no text, use a default prompt
    const prompt = message || "Jelaskan gambar ini secara detail.";
    
    displayMessage(prompt, 'user', null, uploadedFile);
    hideSuggestions();
    commandSuggestions.classList.add('hidden');

    const command = prompt.toLowerCase().split(' ')[0];

    if (command === '/ai2') {
        const commandContent = prompt.substring(4).trim();
        if (!commandContent) {
            displayMessage("Silakan masukkan pesan untuk pengingat.", 'ai', 'error');
        } else {
            pendingNotification = { message: commandContent };
            showTimeModal();
        }
    } else if (command === '/credits') {
        displayMessage('', 'credits');
    } else if (command === '/clear') {
        chatHistory = [];
        chatWindow.innerHTML = '';
         displayMessage('Percakapan telah dihapus. Memulai sesi baru.', 'ai', 'info');
    }
    else {
        const commandContent = prompt.toLowerCase().startsWith('/ai') ? prompt.substring(3).trim() : prompt;
        await processAiResponse(commandContent, uploadedFile);
    }

    messageInput.value = '';
    if (uploadedFile) {
        removeSelectedFile();
    }
}

async function processAiResponse(userMessage, image = null) {
    const thinkingMessageId = `thinking-${Date.now()}`;
    displayMessage('', 'ai-thinking-process', null, null, thinkingMessageId);

    const finalResponse = await callGeminiAPI(userMessage, image);
    
    const thinkingMessage = document.getElementById(thinkingMessageId);
    if(thinkingMessage) {
        thinkingMessage.remove();
    }

    displayMessage(finalResponse, 'ai', 'final');
}

function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
        displayMessage('Hanya file gambar (JPEG, PNG, GIF, WEBP) yang diizinkan.', 'ai', 'error');
        fileInput.value = ''; // Reset input
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        displayMessage(`Ukuran file terlalu besar. Maksimal ${MAX_FILE_SIZE / 1024 / 1024} MB.`, 'ai', 'error');
        fileInput.value = ''; // Reset input
        return;
    }

    // Read and convert file
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        uploadedFile = {
            base64: base64String,
            mimeType: file.type,
            fileObject: file // Store the original file object for creating a blob URL later
        };

        // Show preview
        document.getElementById('preview-image').src = reader.result;
        document.getElementById('preview-name').textContent = file.name;
        document.getElementById('preview-size').textContent = `${(file.size / 1024).toFixed(2)} KB`;
        filePreview.classList.remove('hidden');
    };
    reader.onerror = () => {
        displayMessage('Gagal membaca file.', 'ai', 'error');
        uploadedFile = null;
    };
    reader.readAsDataURL(file);
}

function removeSelectedFile() {
    uploadedFile = null;
    fileInput.value = ''; // Important to allow re-selecting the same file
    filePreview.classList.add('hidden');
}

function displayMessage(text, sender, type = null, imageFile = null, id = null) {
    const messageContainer = document.createElement('div');
    if (id) messageContainer.id = id;

    let contentHTML = '';

    if (sender === 'user') {
        messageContainer.className = 'user-message-container flex justify-end';
        let imageHTML = '';
        if (imageFile && imageFile.fileObject) {
            // Create a temporary URL for the preview in the chat
            const url = URL.createObjectURL(imageFile.fileObject);
            imageHTML = `<img src="${url}" alt="Uploaded Image" class="max-w-xs rounded-lg mt-2 mb-2 border border-blue-500/50" style="max-height: 200px;" onload="URL.revokeObjectURL(this.src)">`;
        }
        const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        messageContainer.innerHTML = `<div class="bg-blue-600 p-3 rounded-lg rounded-br-none max-w-lg"><p class="text-sm">${sanitizedText}</p>${imageHTML}</div>`;
    } else {
        messageContainer.className = 'ai-message-container flex items-end gap-3';
        let iconClass = 'fas fa-robot';
        let iconBg = 'bg-gradient-to-br from-cyan-500 to-blue-600';
        let messageBg = 'bg-gray-800/80 backdrop-blur-sm';

        switch(type) {
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
            case 'error':
                iconClass = 'fas fa-exclamation-triangle'; iconBg = 'bg-red-500'; contentHTML = `<p class="text-sm text-red-300">${text}</p>`; break;
            case 'info':
                iconClass = 'fas fa-info-circle'; iconBg = 'bg-green-500'; contentHTML = `<p class="text-sm text-green-300">${text}</p>`; break;
            default: // 'ai' or 'final'
                // Basic markdown formatting
                let formattedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Sanitize first
                formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900/70 p-2 rounded-md my-2 text-xs"><code>$1</code></pre>').replace(/`(.*?)`/g, '<code class="bg-gray-700/80 px-1 rounded-sm text-xs">$1</code>').replace(/\n/g, '<br>');
                contentHTML = `<p class="text-sm">${formattedText}</p>`;
                break;
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
        case 'copy-credits':
            const pre = button.closest('.markdown-box').querySelector('pre');
            // Use the clipboard API with a fallback for older browsers
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(pre.textContent).then(() => {
                   showCopySuccess(button);
                });
            } else {
                // Fallback for non-secure contexts or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = pre.textContent;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    showCopySuccess(button);
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
            }
            break;
        case 'show-decrypt':
            displayMessage(`Data Terenkripsi: ${encryptedOwnerNumber}`, 'ai', 'info');
            break;
    }
}

function showCopySuccess(button) {
    button.innerHTML = '<i class="fas fa-check mr-1"></i> Disalin!';
    button.classList.add('copied');
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-copy mr-1"></i> Salin';
        button.classList.remove('copied');
    }, 2000);
}

function hideSuggestions() {
    if (!suggestionButtonsContainer.classList.contains('hidden')) {
        suggestionButtonsContainer.classList.add('hidden');
    }
}

async function handleSuggestionClick(e) {
    if (e.target.classList.contains('suggestion-btn')) {
        const message = e.target.textContent;
        messageInput.value = `/ai ${message}`;
        // Create a new submit event to ensure it bubbles up correctly
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        messageForm.dispatchEvent(submitEvent);
    }
}

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
        // Also hide the suggestions if a command is selected
        handleInputForCommands();
    }
}

// --- Time modal functions (unchanged) ---
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
        displayMessage("Waktu yang dimasukkan tidak valid.", 'ai', 'error');
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
        displayMessage(`🔔 PENGINGAT: ${pendingNotification.message}`, 'ai', 'notification');
        notificationSound.play();
    }, delay);

    timeModal.classList.add('hidden');
    pendingNotification = null;
}
