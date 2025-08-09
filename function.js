// --- DOM Element Selection ---
const chatWindow = document.getElementById('chat-window');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const filePreview = document.getElementById('file-preview');
const previewImage = document.getElementById('preview-image');
const previewName = document.getElementById('preview-name');
const previewSize = document.getElementById('preview-size');
const removeFileBtn = document.getElementById('remove-file-btn');
const notificationSound = document.getElementById('notification-sound');
const suggestionButtons = document.getElementById('suggestion-buttons');
const commandSuggestions = document.getElementById('command-suggestions');
const submitButton = document.getElementById('submit-button');
const backgroundAudio = document.getElementById('background-audio');

// --- API, State, and Music Management ---
const API_KEY = 'AIzaSyADD8GLekHkXmtt7nFanPXiU6VFMw6UdB8'; // Your Gemini API Key
let conversationHistory = [];
let attachedFile = null;
const songs = [
    { title: "Mitty Zasia - Sesuatu di Jogja", url: "https://files.catbox.moe/3yeu0x.mp3" },
    { title: "Andra and The BackBone - Sempurna", url: "https://files.catbox.moe/xcpioq.mp3" }
];
let currentSong = {};

// --- Initial Setup for Audio and Music Selection ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Randomly select a song
    currentSong = songs[Math.floor(Math.random() * songs.length)];
    backgroundAudio.src = currentSong.url;

    // 2. Create an overlay to ask for user interaction to play audio
    const overlay = document.createElement('div');
    overlay.id = 'audio-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.85); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; z-index: 100; cursor: pointer; backdrop-filter: blur(5px);';
    overlay.innerHTML = `
        <div class="p-8 rounded-lg">
            <h2 class="text-3xl font-bold mb-4">Selamat Datang</h2>
            <p class="text-lg">Klik di mana saja untuk memulai musik dan masuk.</p>
            <i class="fas fa-play-circle fa-3x mt-8 animate-pulse"></i>
        </div>
    `;
    document.body.appendChild(overlay);

    // 3. Play music and remove overlay on click
    overlay.addEventListener('click', () => {
        backgroundAudio.play().catch(e => console.error("Gagal memutar audio:", e));
        overlay.style.display = 'none';
    }, { once: true });
});


// --- Utility Functions ---
const copyToClipboard = (text, btnElement) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalContent = btnElement.innerHTML;
        btnElement.innerHTML = `<i class="fas fa-check"></i> Disalin!`;
        btnElement.classList.add('copied');
        setTimeout(() => {
           btnElement.innerHTML = originalContent;
           btnElement.classList.remove('copied');
        }, 2000);
    });
};

const fileToGenerativePart = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        inlineData: {
          mimeType: file.type,
          data: reader.result.split(',')[1]
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};


// --- Core Functions ---
const handleUserInput = async (text, file = null) => {
    submitButton.disabled = true;
    messageInput.disabled = true;

    if (text || file) {
        displayMessage(text, 'user', file);
    }

    if (text.startsWith('/')) {
        handleCommand(text);
    } else {
        await getAIResponse(text, file);
    }
    
    messageInput.value = '';
    removeFile();
    submitButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
};

const handleCommand = (command) => {
    const [cmd] = command.trim().split(' ');

    switch (cmd) {
        case '/credits':
            const creditsHTML = `
                <div class="p-3 border border-green-500/30 rounded-lg bg-gray-800/50 backdrop-blur-sm">
                    <p class="font-bold text-green-400 text-base mb-3">Credits & Info</p>
                    <div class="text-sm space-y-2 text-gray-300">
                        <p><i class="fas fa-code w-5 mr-2 text-gray-400"></i>UI by LanaVyn with JS & TailwindCSS.</p>
                        <p><i class="fas fa-brain w-5 mr-2 text-gray-400"></i>AI powered by Google Gemini.</p>
                        <p><i class="fas fa-music w-5 mr-2 text-gray-400"></i>Now Playing: <strong>${currentSong.title || 'Music'}</strong></p>
                        <div class="flex items-center pt-2 border-t border-gray-700/50 mt-3">
                            <i class="fab fa-whatsapp w-5 mr-2 text-gray-400"></i>
                            <a href="https://wa.me/6285971105030" target="_blank" class="text-cyan-400 hover:underline">6285971105030</a>
                            <button class="js-copy-btn ml-auto text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors" data-copy="6285971105030">Salin</button>
                        </div>
                    </div>
                </div>
            `;
            displayMessage(creditsHTML, 'system');
            break;
        default:
            displayMessage(`Perintah tidak dikenal: ${cmd}`, 'system');
    }
};

const getAIResponse = async (prompt, file) => {
    displayTypingIndicator();

    // FIXED: Correct model names for v1beta API
    const model = file ? 'gemini-pro-vision' : 'gemini-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    const userParts = [];
    if (prompt) {
        userParts.push({ text: prompt });
    }
    if (file) {
        try {
            const imagePart = await fileToGenerativePart(file);
            userParts.push(imagePart);
        } catch (error) {
            console.error("Error converting file:", error);
            displayMessage("Gagal memproses gambar.", 'system');
            removeTypingIndicator();
            return;
        }
    }
    
    const contents = [...conversationHistory, { role: 'user', parts: userParts }];

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
            const aiResponseText = data.candidates[0].content.parts.map(p => p.text).join("");
            displayMessage(aiResponseText, 'ai');
            
            conversationHistory.push({ role: 'user', parts: userParts });
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });

        } else {
            const safetyMessage = data.promptFeedback?.blockReason ? `Permintaan diblokir karena: ${data.promptFeedback.blockReason}` : "Maaf, tidak ada respons yang diterima dari AI. Ini mungkin karena filter keamanan.";
            displayMessage(safetyMessage, 'system');
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        displayMessage(`Terjadi kesalahan saat menghubungi AI: ${error.message}`, 'system');
    } finally {
        removeTypingIndicator();
        notificationSound.play().catch(e => console.log("Gagal memutar notifikasi:", e));
    }
};

// --- UI Display Functions ---
const displayMessage = (text, sender, file = null) => {
    const messageContainer = document.createElement('div');
    let contentHTML = '';

    if (file && sender === 'user') {
        const fileURL = URL.createObjectURL(file);
        contentHTML += `<img src="${fileURL}" alt="Uploaded Image" class="max-w-xs rounded-lg mb-2 cursor-pointer" onclick="window.open('${fileURL}')">`;
    }

    if (sender === 'system') {
        messageContainer.className = 'w-full my-2';
        contentHTML = text; 
    } else {
        messageContainer.className = `flex items-end gap-3 ${sender === 'user' ? 'justify-end' : ''}`;
        if (text) {
            const parts = text.split(/(```\w*\n[\s\S]*?\n```)/g);
            let finalHTML = '';
            for (const part of parts) {
                if (part.startsWith('```')) {
                    const codeBlockMatch = part.match(/```(\w*)\n([\s\S]*?)\n```/);
                    if (codeBlockMatch) {
                        const [, lang, code] = codeBlockMatch;
                        const language = lang || 'code';
                        const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        finalHTML += `
                        <div class="markdown-box w-full my-2">
                            <div class="code-header">
                                <span>${language}</span>
                                <button class="copy-btn"><i class="far fa-copy mr-1"></i> Salin</button>
                            </div>
                            <pre><code>${escapedCode.trim()}</code></pre>
                        </div>`;
                    }
                } else if (part.trim()) {
                    finalHTML += `<p class="text-sm">${part.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>')}</p>`;
                }
            }
            contentHTML += finalHTML;
        }
    }

    const messageBody = sender === 'user' ? `
        <div class="bg-blue-600 p-3 rounded-lg rounded-br-none max-w-lg text-white">
            ${contentHTML}
        </div>
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <i class="fas fa-user text-white"></i>
        </div>` 
    : sender === 'ai' ? `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <i class="fas fa-robot text-white"></i>
        </div>
        <div class="bg-gray-800/80 backdrop-blur-sm p-3 rounded-lg rounded-bl-none max-w-lg">
            ${contentHTML}
        </div>` 
    : `<div class="text-xs text-gray-400">${contentHTML}</div>`;
    
    messageContainer.innerHTML = messageBody;
    chatWindow.appendChild(messageContainer);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    messageContainer.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.closest('.markdown-box').querySelector('pre code').textContent;
            copyToClipboard(code, btn);
        });
    });
    messageContainer.querySelectorAll('.js-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            copyToClipboard(btn.dataset.copy, btn);
        });
    });
};

const displayTypingIndicator = () => {
    if (document.getElementById('typing-indicator')) return;
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.className = 'flex items-end gap-3';
    typingIndicator.innerHTML = `
        <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <i class="fas fa-robot text-white"></i>
        </div>
        <div class="bg-gray-800/80 backdrop-blur-sm p-3 rounded-lg rounded-bl-none">
            <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0s;"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s;"></span>
                <span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s;"></span>
            </div>
        </div>`;
    chatWindow.appendChild(typingIndicator);
    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const removeTypingIndicator = () => {
    document.getElementById('typing-indicator')?.remove();
};

const displayFilePreview = (file) => {
    previewImage.src = URL.createObjectURL(file);
    previewName.textContent = file.name;
    previewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    filePreview.classList.remove('hidden');
};

const removeFile = () => {
    attachedFile = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    previewImage.src = '';
};

// --- Event Listeners Setup ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message && !attachedFile) return;
    handleUserInput(message, attachedFile);
    suggestionButtons.classList.add('hidden');
});

uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        attachedFile = file;
        displayFilePreview(file);
    }
});

removeFileBtn.addEventListener('click', removeFile);

suggestionButtons.addEventListener('click', (e) => {
    if (e.target.classList.contains('suggestion-btn')) {
        const suggestionText = e.target.textContent;
        messageInput.value = suggestionText;
        messageInput.focus();
        handleUserInput(suggestionText);
        suggestionButtons.classList.add('hidden');
    }
});

messageInput.addEventListener('input', () => {
    commandSuggestions.classList.toggle('hidden', !messageInput.value.startsWith('/'));
});

commandSuggestions.addEventListener('click', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
        const command = item.dataset.command.trim();
        messageInput.value = command;
        commandSuggestions.classList.add('hidden');
        messageInput.focus();
        if (command === '/credits') {
            handleUserInput(command);
        }
    }
});
