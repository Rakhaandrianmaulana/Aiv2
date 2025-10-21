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

// --- Template Selection ---
const userMessageTemplate = document.getElementById('user-message-template');
const aiMessageTemplate = document.getElementById('ai-message-template');
const systemMessageTemplate = document.getElementById('system-message-template');
const typingIndicatorTemplate = document.getElementById('typing-indicator-template');

// --- API, State, and Music Management ---
const API_KEY ='AIzaSyBfARzwWNcs0QJm9ZIJwWn6Kk2GkfMgGJ8';
const MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

let conversationHistory = [];
let attachedFile = null;
let aiPersona = "Anda adalah Asisten AI Canggih v2. Anda sangat membantu, ramah, dan selalu memberikan jawaban yang jelas. Anda tahu bahwa Anda dapat mengubah kepribadian Anda jika pengguna memintanya dengan perintah /persona.";

const songs = [
    { title: "Mitty Zasia - Sesuatu di Jogja", url: "https://files.catbox.moe/3yeu0x.mp3" },
    { title: "Andra and The BackBone - Sempurna", url: "https://files.catbox.moe/xcpioq.mp3" }
];
let currentSong = {};

// --- V2 Feature: Update Log ---
const updateLog = [
    {
        version: "2.0",
        date: "24 Agustus 2025",
        features: [
            "<strong>Sistem Persona AI:</strong> Kemampuan untuk mengubah kepribadian AI secara dinamis menggunakan perintah <code>/persona [deskripsi]</code> untuk mendukung mode roleplay.",
            "<strong>Log Pembaruan:</strong> Menambahkan perintah <code>/infoupdate</code> untuk melihat riwayat pembaruan dan fitur baru.",
            "<strong>Peningkatan API:</strong> Migrasi ke model Gemini 1.5 Flash untuk respons yang lebih cepat dan akurat.",
            "<strong>Struktur Kode yang Disempurnakan:</strong> Memisahkan template HTML dari logika JavaScript untuk meningkatkan keterbacaan dan pemeliharaan kode."
        ]
    },
    {
        version: "1.0",
        date: "23 Agustus 2025",
        features: [
            "Rilis awal dengan fungsionalitas chat dasar.",
            "Kemampuan analisis gambar.",
            "Sistem musik latar acak."
        ]
    }
];


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    currentSong = songs[Math.floor(Math.random() * songs.length)];
    backgroundAudio.src = currentSong.url;

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

    overlay.addEventListener('click', () => {
        backgroundAudio.play().catch(e => console.error("Gagal memutar audio:", e));
        overlay.style.display = 'none';
    }, { once: true });
    
    const initialMessage = "Selamat datang di Asisten AI v2! Saya sekarang memiliki sistem persona yang bisa Anda ubah. Coba ketik <code>/persona seorang penyihir tua yang bijaksana</code> atau lihat pembaruan dengan <code>/infoupdate</code>.";
    displayMessage(initialMessage, 'ai');
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
      resolve({ inlineData: { mimeType: file.type, data: reader.result.split(',')[1] } });
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
    const [cmd, ...args] = command.trim().split(' ');
    const fullArgs = args.join(' ');

    switch (cmd) {
        case '/credits': {
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
                </div>`;
            displayMessage(creditsHTML, 'system');
            break;
        }
        case '/infoupdate': {
            let updateHTML = '<div class="p-3 border border-blue-500/30 rounded-lg bg-gray-800/50 backdrop-blur-sm">';
            updateLog.forEach(log => {
                updateHTML += `
                    <div class="mb-4">
                        <h3 class="font-bold text-blue-400 text-lg">Versi ${log.version} <span class="text-xs font-normal text-gray-400">- ${log.date}</span></h3>
                        <ul class="list-disc list-inside text-sm text-gray-300 mt-2 space-y-1">
                            ${log.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            updateHTML += '</div>';
            displayMessage(updateHTML, 'system');
            break;
        }
        case '/persona': {
            if (fullArgs) {
                aiPersona = fullArgs;
                const confirmationHTML = `<div class="p-3 border border-yellow-500/30 rounded-lg bg-gray-800/50 backdrop-blur-sm text-center">
                    <p class="font-bold text-yellow-400">Persona AI Diperbarui</p>
                    <p class="text-sm text-gray-300 mt-1">AI sekarang akan bersikap sebagai: "<strong>${aiPersona}</strong>"</p>
                </div>`;
                displayMessage(confirmationHTML, 'system');
            } else {
                displayMessage("Gagal mengubah persona. Harap berikan deskripsi. Contoh: <code>/persona seorang koki dari Italia</code>", 'system');
            }
            break;
        }
        default:
            displayMessage(`Perintah tidak dikenal: ${cmd}`, 'system');
    }
};

const getAIResponse = async (prompt, file) => {
    displayTypingIndicator();
    
    const userParts = [];
    if (prompt) userParts.push({ text: prompt });
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
    
    // V2 Feature: Add System Instruction for Persona
    const payload = {
        contents: contents,
        systemInstruction: {
            parts: [{ text: aiPersona }]
        }
    };

    try {
        const response = await fetch(MODEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content?.parts) {
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
    const template = sender === 'user' ? userMessageTemplate : sender === 'ai' ? aiMessageTemplate : systemMessageTemplate;
    const messageClone = template.content.cloneNode(true);
    const contentContainer = messageClone.querySelector('.message-content');
    
    let finalHTML = '';

    if (file && sender === 'user') {
        const fileURL = URL.createObjectURL(file);
        finalHTML += `<img src="${fileURL}" alt="Uploaded Image" class="max-w-xs rounded-lg mb-2 cursor-pointer" onclick="window.open('${fileURL}')">`;
    }

    if (text) {
        if (sender === 'system') {
            finalHTML += text;
        } else {
            const parts = text.split(/(```\w*\n[\s\S]*?\n```)/g);
            parts.forEach(part => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w*)\n([\s\S]*?)\n```/);
                    if (match) {
                        const [, lang, code] = match;
                        const language = lang || 'code';
                        const escapedCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        finalHTML += `
                        <div class="markdown-box">
                            <div class="code-header">
                                <span>${language}</span>
                                <button class="copy-btn"><i class="far fa-copy mr-1"></i> Salin</button>
                            </div>
                            <pre><code>${escapedCode.trim()}</code></pre>
                        </div>`;
                    }
                } else if (part.trim()){
                    finalHTML += `<p class="text-sm">${part.replace(/\n/g, '<br>')}</p>`;
                }
            });
        }
    }

    contentContainer.innerHTML = finalHTML;
    chatWindow.appendChild(messageClone);
    
    chatWindow.querySelectorAll('.copy-btn:not(.listener-added)').forEach(btn => {
        btn.classList.add('listener-added');
        btn.addEventListener('click', () => {
            const code = btn.closest('.markdown-box').querySelector('pre code').textContent;
            copyToClipboard(code, btn);
        });
    });
     chatWindow.querySelectorAll('.js-copy-btn:not(.listener-added)').forEach(btn => {
        btn.classList.add('listener-added');
        btn.addEventListener('click', () => {
            copyToClipboard(btn.dataset.copy, btn);
        });
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
};

const displayTypingIndicator = () => {
    if (document.getElementById('typing-indicator')) return;
    const indicator = typingIndicatorTemplate.content.cloneNode(true);
    chatWindow.appendChild(indicator);
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
        if (suggestionText.includes('v2')) {
            handleUserInput('/infoupdate');
        } else {
            handleUserInput(suggestionText);
        }
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
        if (command === '/credits' || command === '/infoupdate') {
            handleUserInput(command);
        }
    }
});
