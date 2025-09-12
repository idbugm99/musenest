/**
 * Universal Chat Widget
 * Works across all themes with model-specific settings
 */

class UniversalChatWidget {
    constructor(options = {}) {
        this.modelId = options.modelId || null;
        this.modelSlug = options.modelSlug || null;
        this.chatEnabled = options.chatEnabled || false;
        this.conversationId = null;
        this.isInitialized = false;
        this.selectedFiles = [];
        this.maxFiles = 5;
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        this.init();
    }

    async init() {
        if (!this.chatEnabled) {
            console.log('Chat not enabled for this model');
            return;
        }

        await this.createWidget();
        this.bindEvents();
        this.isInitialized = true;
    }

    async createWidget() {
        // Create widget container
        const widget = document.createElement('div');
        widget.className = 'chat-widget';
        widget.innerHTML = this.getWidgetHTML();
        
        document.body.appendChild(widget);
        
        // Apply theme colors
        this.applyThemeColors();
    }

    getWidgetHTML() {
        return `
            <!-- Floating Chat Button -->
            <button class="chat-widget-button" id="chatWidgetButton" title="Start Live Chat">
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                </svg>
            </button>

            <!-- Chat Modal -->
            <div class="chat-modal" id="chatModal">
                <!-- Header -->
                <div class="chat-header">
                    <h3>Live Chat</h3>
                    <button class="chat-close" id="chatClose">&times;</button>
                </div>

                <!-- Body -->
                <div class="chat-body">
                    <!-- Contact Form -->
                    <div class="chat-contact-form" id="chatContactForm">
                        <form id="chatForm" onsubmit="return false;" method="post" action="javascript:void(0)">
                            <div class="form-group">
                                <label for="chatName">Your Name</label>
                                <input type="text" id="chatName" name="name" required>
                            </div>

                            <div class="form-group">
                                <label for="chatEmail">Email Address</label>
                                <input type="email" id="chatEmail" name="email" required>
                            </div>

                            <div class="form-group optional">
                                <label for="chatPhone">Phone Number</label>
                                <input type="tel" id="chatPhone" name="phone">
                            </div>

                            <div class="form-group">
                                <label for="chatMessage">Your Message</label>
                                <textarea id="chatMessage" name="message" placeholder="How can I help you today?" required></textarea>
                            </div>

                            <!-- File Upload Area -->
                            <div class="form-group">
                                <label>Attachments (Optional)</label>
                                <div class="file-upload-area" id="fileUploadArea">
                                    <input type="file" class="file-upload-input" id="fileInput" multiple accept="${this.allowedTypes.join(',')}">
                                    <div class="file-upload-text">
                                        📎 Click or drag files here<br>
                                        <small>Images, PDFs, Documents (max 10MB each)</small>
                                    </div>
                                </div>
                                <div class="selected-files" id="selectedFiles"></div>
                            </div>

                            <button type="submit" class="chat-submit" id="chatSubmit">Start Chat</button>
                        </form>
                    </div>

                    <!-- Chat Messages -->
                    <div class="chat-messages" id="chatMessages">
                        <div class="chat-success">
                            <strong>Chat Started!</strong><br>
                            You can now send messages and files.
                        </div>
                    </div>

                    <!-- Typing Indicator -->
                    <div class="typing-indicator" id="typingIndicator">
                        <span>Model is typing</span>
                        <div class="typing-dots">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>

                <!-- Message Input Area -->
                <div class="chat-input-area" id="chatInputArea">
                    <div class="message-input-container">
                        <textarea class="message-input" id="messageInput" placeholder="Type your message..." rows="1"></textarea>
                        <div class="message-actions">
                            <button type="button" class="action-button" id="attachFileBtn" title="Attach File">
                                <svg viewBox="0 0 24 24">
                                    <path d="M7.5 18A5.5 5.5 0 0 1 2 12.5A5.5 5.5 0 0 1 7.5 7H18a4 4 0 0 1 4 4 4 4 0 0 1-4 4H9.5a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 9.5 10H17v1.5H9.5a1 1 0 0 0-1 1 1 1 0 0 0 1 1H18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 18 8.5H7.5a4 4 0 0 0-4 4 4 4 0 0 0 4 4H17V18H7.5Z"/>
                                </svg>
                            </button>
                            <button type="button" class="action-button" id="sendMessageBtn" title="Send Message">
                                <svg viewBox="0 0 24 24">
                                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const button = document.getElementById('chatWidgetButton');
        const modal = document.getElementById('chatModal');
        const closeBtn = document.getElementById('chatClose');
        const contactForm = document.getElementById('contactForm');
        const fileInput = document.getElementById('fileInput');
        const fileUploadArea = document.getElementById('fileUploadArea');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        const attachBtn = document.getElementById('attachFileBtn');

        // Toggle modal
        button?.addEventListener('click', () => this.toggleModal());
        closeBtn?.addEventListener('click', () => this.closeModal());

        // Use event delegation to handle form submission
        document.addEventListener('submit', (e) => {
            if (e.target.id === 'chatForm') {
                console.log('Chat widget form submit intercepted');
                e.preventDefault();
                e.stopPropagation();
                this.handleContactSubmit(e);
                return false;
            }
        });

        // File upload events
        fileInput?.addEventListener('change', (e) => this.handleFileSelect(e));
        fileUploadArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
        fileUploadArea?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        fileUploadArea?.addEventListener('drop', (e) => this.handleDrop(e));

        // Message input events
        messageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        messageInput?.addEventListener('input', () => this.autoResize(messageInput));

        // Send message
        sendBtn?.addEventListener('click', () => this.sendMessage());
        
        // Attach file in chat
        attachBtn?.addEventListener('click', () => this.openFileDialog());

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!modal?.contains(e.target) && !button?.contains(e.target)) {
                this.closeModal();
            }
        });
    }

    toggleModal() {
        const modal = document.getElementById('chatModal');
        const button = document.getElementById('chatWidgetButton');
        
        if (modal?.classList.contains('show')) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }

    openModal() {
        const modal = document.getElementById('chatModal');
        const button = document.getElementById('chatWidgetButton');
        
        modal?.classList.add('show');
        button?.classList.add('active');
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('chatName')?.focus();
        }, 300);
    }

    closeModal() {
        const modal = document.getElementById('chatModal');
        const button = document.getElementById('chatWidgetButton');
        
        modal?.classList.remove('show');
        button?.classList.remove('active');
        
        // Stop polling when chat is closed
        this.stopMessagePolling();
    }

    async handleContactSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = document.getElementById('chatSubmit');
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Starting Chat...';
        
        try {
            // Create regular form data for contact submission (no files yet)
            const contactData = {
                name: form.name.value,
                email: form.email.value,
                phone: form.phone.value || '',
                message: form.message.value,
                subject: 'Live Chat Request',
                model_id: this.modelSlug || this.modelId,
                consent_marketing: false,
                consent_analytics: false,
                consent_contact: true,
                preferred_contact: 'email'
            };
            
            console.log('Submitting contact data:', contactData);
            
            // Submit contact form as JSON
            const response = await fetch('/api/contact/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(contactData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.conversationId = data.conversation_id;
                
                // Upload files after contact form is submitted
                if (this.selectedFiles.length > 0) {
                    await this.uploadSelectedFiles();
                }
                
                if (data.is_live_chat) {
                    // Show success message first
                    this.showSuccess('Chat started successfully! SMS notification sent to model.');
                    
                    // Switch to chat interface after a brief delay
                    setTimeout(async () => {
                        this.switchToChatInterface();
                        // Load existing messages
                        await this.loadMessages();
                    }, 1000);
                } else {
                    this.showSuccess('Message sent! We\'ll reply via email soon.');
                    setTimeout(() => this.closeModal(), 3000);
                }
            } else {
                console.error('Contact form failed:', data);
                if (data.details && Array.isArray(data.details)) {
                    // Show validation errors
                    const errorMessages = data.details.map(err => `${err.field}: ${err.message}`).join('\n');
                    this.showError(`Validation errors:\n${errorMessages}`);
                } else {
                    this.showError(data.error || 'Failed to start chat. Please try again.');
                }
            }
        } catch (error) {
            console.error('Contact form error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Start Chat';
        }
    }

    async uploadSelectedFiles() {
        if (!this.conversationId || this.selectedFiles.length === 0) return;
        
        try {
            const formData = new FormData();
            formData.append('uploader_type', 'contact');
            
            this.selectedFiles.forEach(file => {
                formData.append('files', file);
            });
            
            const response = await fetch(`/api/chat-files/upload/${this.conversationId}`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Files uploaded successfully:', result.files);
                // Clear selected files after successful upload
                this.selectedFiles = [];
                this.updateFileDisplay();
            } else {
                console.error('File upload failed:', result.error);
                this.showError('Some files failed to upload, but your message was sent.');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('File upload failed, but your message was sent.');
        }
    }

    switchToChatInterface() {
        const contactForm = document.getElementById('chatContactForm');
        const chatMessages = document.getElementById('chatMessages');
        const chatInputArea = document.getElementById('chatInputArea');
        
        contactForm?.classList.remove('show');
        contactForm.style.display = 'none';
        
        chatMessages?.classList.add('show');
        chatInputArea?.classList.add('show');
        
        // Update header
        const header = document.querySelector('.chat-header h3');
        if (header) header.textContent = 'Live Chat - Connected';
        
        // Start polling for new messages every 5 seconds
        this.startMessagePolling();
    }
    
    startMessagePolling() {
        // Clear any existing polling interval
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        // Poll for new messages every 5 seconds
        this.pollingInterval = setInterval(async () => {
            await this.loadMessages();
        }, 5000);
    }
    
    stopMessagePolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async loadMessages() {
        if (!this.conversationId) return;
        
        try {
            const response = await fetch(`/api/chat/messages/${this.conversationId}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayMessages(data.messages);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    displayMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Clear existing messages except success message
        const successMsg = messagesContainer.querySelector('.chat-success');
        messagesContainer.innerHTML = '';
        if (successMsg) messagesContainer.appendChild(successMsg);
        
        messages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            messagesContainer.appendChild(messageEl);
        });
        
        this.scrollToBottom();
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isOutgoing = message.sender_name.includes('Contact');
        div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        // Debug log to verify message alignment
        console.log('Message alignment:', {
            sender_name: message.sender_name,
            isOutgoing: isOutgoing,
            className: div.className
        });
        
        div.innerHTML = `
            <div class="message-bubble">
                ${message.message}
                ${message.has_attachments ? '<div class="message-attachment">📎 Has attachments</div>' : ''}
            </div>
            <div class="message-time">${new Date(message.created_at).toLocaleTimeString()}</div>
        `;
        
        return div;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput?.value.trim();
        
        if (!message || !this.conversationId) return;
        
        try {
            const response = await fetch('/api/chat/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: this.conversationId,
                    message: message,
                    sender_type: 'contact'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear input
                messageInput.value = '';
                this.autoResize(messageInput);
                
                // Add message to chat
                this.addMessageToChat({
                    message: message,
                    sender_name: 'Contact',
                    created_at: new Date().toISOString()
                });
            } else {
                this.showError('Failed to send message. Please try again.');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Network error. Please try again.');
        }
    }

    addMessageToChat(message) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageEl = this.createMessageElement(message);
        messagesContainer?.appendChild(messageEl);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    // File handling methods
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.target.closest('.file-upload-area')?.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.target.closest('.file-upload-area')?.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.target.closest('.file-upload-area')?.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    processFiles(files) {
        files.forEach(file => {
            if (this.selectedFiles.length >= this.maxFiles) {
                this.showError(`Maximum ${this.maxFiles} files allowed`);
                return;
            }
            
            if (file.size > this.maxFileSize) {
                this.showError(`File "${file.name}" is too large (max 10MB)`);
                return;
            }
            
            if (!this.isAllowedFileType(file)) {
                this.showError(`File type not allowed: ${file.type}`);
                return;
            }
            
            this.selectedFiles.push(file);
        });
        
        this.updateFileDisplay();
    }

    isAllowedFileType(file) {
        return this.allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                return file.type.startsWith(type.replace('/*', '/'));
            }
            return file.type === type;
        });
    }

    updateFileDisplay() {
        const container = document.getElementById('selectedFiles');
        if (!container) return;
        
        container.innerHTML = this.selectedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">(${(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button type="button" class="file-remove" onclick="chatWidget.removeFile(${index})">×</button>
            </div>
        `).join('');
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileDisplay();
    }

    openFileDialog() {
        // Create temporary file input for chat file uploads
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = this.allowedTypes.join(',');
        
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            await this.uploadChatFiles(files);
        });
        
        input.click();
    }

    async uploadChatFiles(files) {
        if (!this.conversationId || files.length === 0) return;
        
        const formData = new FormData();
        formData.append('uploader_type', 'contact');
        
        files.forEach(file => {
            formData.append('files', file);
        });
        
        try {
            const response = await fetch(`/api/chat-files/upload/${this.conversationId}`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess(`Uploaded ${data.uploaded} file(s)`);
                // Refresh messages to show attachments
                await this.loadMessages();
            } else {
                this.showError(data.error || 'Failed to upload files');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Failed to upload files. Please try again.');
        }
    }

    // Utility methods
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `chat-${type}`;
        messageEl.textContent = message;
        
        const chatBody = document.querySelector('.chat-body');
        chatBody?.insertBefore(messageEl, chatBody.firstChild);
        
        // Remove after 5 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }

    applyThemeColors() {
        // Get theme colors from CSS variables or data attributes
        const themeClass = this.detectTheme();
        document.body.classList.add(themeClass);
    }

    detectTheme() {
        // Detect theme from page context or URL
        const path = window.location.pathname;
        const body = document.body;
        
        if (body.classList.contains('rose-theme') || path.includes('rose')) {
            return 'theme-rose';
        } else if (body.classList.contains('modern-theme') || path.includes('modern')) {
            return 'theme-modern';
        } else if (body.classList.contains('luxury-theme') || path.includes('luxury')) {
            return 'theme-luxury';
        } else if (body.classList.contains('royal-gem-theme') || path.includes('royal')) {
            return 'theme-royal-gem';
        }
        
        return 'theme-rose'; // Default
    }
}

// Auto-initialize when DOM is ready and config is available
function initializeChatWidget() {
    const chatConfig = window.modelChatConfig || {};
    
    if (chatConfig.enabled && !window.chatWidget) {
        console.log('Initializing chat widget with config:', chatConfig);
        window.chatWidget = new UniversalChatWidget({
            modelId: chatConfig.modelId,
            modelSlug: chatConfig.modelSlug,
            chatEnabled: chatConfig.enabled
        });
    } else if (chatConfig.enabled === false) {
        console.log('Chat widget disabled:', chatConfig.reason || 'No reason provided');
    }
}

// Try to initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatWidget);
} else {
    initializeChatWidget();
}

// Also check periodically for config availability (in case it loads async)
let checkCount = 0;
const maxChecks = 50; // Check for up to 5 seconds
const configChecker = setInterval(() => {
    checkCount++;
    
    if (window.modelChatConfig && typeof window.modelChatConfig === 'object') {
        clearInterval(configChecker);
        initializeChatWidget();
    } else if (checkCount >= maxChecks) {
        clearInterval(configChecker);
        console.log('Chat widget: Config not found after', maxChecks * 100, 'ms');
    }
}, 100);