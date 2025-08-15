/**
 * Feedback Animation System - Phase 8.5
 * Success/error feedback animations with emotional design
 */

class FeedbackAnimationSystem {
  constructor() {
    this.activeAnimations = new Map();
    this.feedbackQueue = [];
    this.soundEnabled = false;
    
    // Configuration
    this.config = {
      animationDuration: 600,
      celebrationDuration: 2000,
      errorShakeIntensity: 8,
      successBounceHeight: 20,
      particleCount: 15,
      enableParticles: true,
      enableSoundEffects: false,
      enableHapticFeedback: true,
      respectMotionPreference: true
    };
    
    this.init();
  }

  init() {
    this.detectUserPreferences();
    this.createSoundEffects();
    this.setupFeedbackTriggers();
    this.createParticleSystem();
    this.startAnimationLoop();
    
    console.log('Feedback Animation System initialized');
  }

  detectUserPreferences() {
    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.config.respectMotionPreference = true;
      this.config.enableParticles = false;
      this.config.animationDuration = 200;
    }
    
    // Check for prefers-reduced-data (reduce particle effects)
    if (window.matchMedia('(prefers-reduced-data: reduce)').matches) {
      this.config.enableParticles = false;
    }
  }

  createSoundEffects() {
    if (!this.config.enableSoundEffects) return;
    
    // Create audio contexts for feedback sounds
    this.sounds = {
      success: this.createSuccessSound(),
      error: this.createErrorSound(),
      warning: this.createWarningSound(),
      notification: this.createNotificationSound()
    };
  }

  setupFeedbackTriggers() {
    // API response intercepting for automatic feedback
    this.interceptAPIResponses();
    
    // Form validation feedback
    this.setupFormValidationFeedback();
    
    // Button action feedback
    this.setupButtonFeedback();
    
    // Drag & drop feedback
    this.setupDragDropFeedback();
    
    // Custom event listeners
    this.setupCustomEventListeners();
  }

  interceptAPIResponses() {
    // Enhance existing fetch interception with feedback animations
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (response.ok) {
          this.triggerSuccessFeedback(this.getContextElement(), {
            type: 'api_success',
            message: 'Operation completed successfully!'
          });
        } else {
          this.triggerErrorFeedback(this.getContextElement(), {
            type: 'api_error',
            message: `Request failed: ${response.status}`
          });
        }
        
        return response;
      } catch (error) {
        this.triggerErrorFeedback(this.getContextElement(), {
          type: 'network_error',
          message: 'Network error occurred'
        });
        throw error;
      }
    };
  }

  setupFormValidationFeedback() {
    document.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.matches('input, textarea, select')) return;
      
      // Debounce validation
      clearTimeout(input.validationTimeout);
      input.validationTimeout = setTimeout(() => {
        this.handleInputValidationFeedback(input);
      }, 300);
    });

    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName !== 'FORM') return;
      
      // Check form validity
      if (form.checkValidity()) {
        this.triggerFormSuccessFeedback(form);
      } else {
        this.triggerFormErrorFeedback(form);
      }
    });
  }

  setupButtonFeedback() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('button, .btn, [role="button"]');
      if (!button || button.disabled) return;
      
      this.triggerButtonClickFeedback(button);
    });
  }

  setupDragDropFeedback() {
    document.addEventListener('dragstart', (e) => {
      this.triggerDragStartFeedback(e.target);
    });

    document.addEventListener('dragenter', (e) => {
      const dropZone = e.target.closest('.gallery-drop-zone, .drop-zone');
      if (dropZone) {
        this.triggerDropZoneEnterFeedback(dropZone);
      }
    });

    document.addEventListener('drop', (e) => {
      const dropZone = e.target.closest('.gallery-drop-zone, .drop-zone');
      if (dropZone) {
        this.triggerDropSuccessFeedback(dropZone);
      }
    });
  }

  setupCustomEventListeners() {
    // Gallery-specific events
    window.addEventListener('image-uploaded', (e) => {
      this.triggerImageUploadSuccess(e.detail.element);
    });

    window.addEventListener('batch-operation-complete', (e) => {
      this.triggerBatchOperationSuccess(e.detail);
    });

    window.addEventListener('section-created', (e) => {
      this.triggerSectionCreatedFeedback(e.detail.element);
    });

    window.addEventListener('image-selection-changed', (e) => {
      this.triggerSelectionFeedback(e.detail);
    });

    // Error events
    window.addEventListener('operation-failed', (e) => {
      this.triggerOperationErrorFeedback(e.detail);
    });
  }

  // Success feedback animations
  triggerSuccessFeedback(element, options = {}) {
    if (!this.shouldAnimate()) return;
    
    const animationId = this.generateAnimationId();
    const animation = {
      id: animationId,
      element,
      type: 'success',
      options,
      startTime: Date.now()
    };
    
    this.activeAnimations.set(animationId, animation);
    this.executeSuccessAnimation(animation);
    
    // Play sound if enabled
    this.playSound('success');
    
    // Trigger haptic feedback
    this.triggerHapticFeedback('success');
  }

  executeSuccessAnimation(animation) {
    const { element, options } = animation;
    
    // Main element animation
    this.animateSuccessElement(element, options);
    
    // Particle effects
    if (this.config.enableParticles) {
      this.createSuccessParticles(element, options);
    }
    
    // Success message
    if (options.message) {
      this.showSuccessMessage(element, options.message);
    }
    
    // Celebration effects for major successes
    if (options.type === 'major_success') {
      this.triggerCelebrationEffect(element);
    }
  }

  animateSuccessElement(element, options) {
    const originalTransform = element.style.transform;
    const originalBackground = element.style.background;
    
    // Success glow and bounce
    element.style.transition = `all ${this.config.animationDuration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
    element.style.transform = `scale(1.1) translateY(-${this.config.successBounceHeight}px)`;
    element.style.boxShadow = '0 8px 30px rgba(40, 167, 69, 0.4)';
    element.style.background = 'rgba(40, 167, 69, 0.1)';
    
    // Return to normal
    setTimeout(() => {
      element.style.transform = originalTransform;
      element.style.background = originalBackground;
      element.style.boxShadow = '';
      
      setTimeout(() => {
        element.style.transition = '';
      }, this.config.animationDuration);
    }, this.config.animationDuration);
  }

  createSuccessParticles(element, options) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < this.config.particleCount; i++) {
      this.createSuccessParticle(centerX, centerY, i);
    }
  }

  createSuccessParticle(x, y, index) {
    const particle = document.createElement('div');
    particle.className = 'success-particle';
    
    const size = Math.random() * 8 + 4;
    const angle = (index / this.config.particleCount) * Math.PI * 2;
    const velocity = Math.random() * 100 + 50;
    const finalX = x + Math.cos(angle) * velocity;
    const finalY = y + Math.sin(angle) * velocity;
    
    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${this.getSuccessColor()};
      border-radius: 50%;
      z-index: 9999;
      pointer-events: none;
      animation: success-particle ${this.config.animationDuration}ms ease-out;
      transform: translate3d(${finalX - x}px, ${finalY - y}px, 0) scale(0);
    `;
    
    document.body.appendChild(particle);
    
    // Remove particle after animation
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, this.config.animationDuration);
  }

  getSuccessColor() {
    const colors = ['#28a745', '#20c997', '#17a2b8', '#007bff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  showSuccessMessage(element, message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'success-message-popup';
    messageEl.textContent = message;
    
    const rect = element.getBoundingClientRect();
    messageEl.style.cssText = `
      position: fixed;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top - 40}px;
      transform: translateX(-50%);
      background: #28a745;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 1.5rem;
      font-size: 0.875rem;
      z-index: 9999;
      animation: success-message ${this.config.animationDuration * 2}ms ease;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, this.config.animationDuration * 2);
  }

  triggerCelebrationEffect(element) {
    const celebration = document.createElement('div');
    celebration.className = 'celebration-overlay';
    celebration.innerHTML = `
      <div class="celebration-content">
        <div class="celebration-icon">🎉</div>
        <div class="celebration-text">Great job!</div>
      </div>
    `;
    
    document.body.appendChild(celebration);
    
    // Animate celebration
    requestAnimationFrame(() => {
      celebration.classList.add('show');
    });
    
    // Remove after celebration duration
    setTimeout(() => {
      celebration.classList.remove('show');
      setTimeout(() => {
        if (celebration.parentNode) {
          celebration.parentNode.removeChild(celebration);
        }
      }, 300);
    }, this.config.celebrationDuration);
    
    // Create confetti
    this.createConfetti();
  }

  createConfetti() {
    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        this.createConfettiPiece();
      }, i * 20);
    }
  }

  createConfettiPiece() {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 5;
    const startX = Math.random() * window.innerWidth;
    
    confetti.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: -20px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      z-index: 9999;
      animation: confetti-fall ${Math.random() * 2 + 1}s linear;
    `;
    
    document.body.appendChild(confetti);
    
    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, 3000);
  }

  // Error feedback animations
  triggerErrorFeedback(element, options = {}) {
    if (!this.shouldAnimate()) return;
    
    const animationId = this.generateAnimationId();
    const animation = {
      id: animationId,
      element,
      type: 'error',
      options,
      startTime: Date.now()
    };
    
    this.activeAnimations.set(animationId, animation);
    this.executeErrorAnimation(animation);
    
    // Play error sound
    this.playSound('error');
    
    // Trigger haptic feedback
    this.triggerHapticFeedback('error');
  }

  executeErrorAnimation(animation) {
    const { element, options } = animation;
    
    // Main element shake animation
    this.animateErrorShake(element, options);
    
    // Error glow effect
    this.animateErrorGlow(element, options);
    
    // Error message
    if (options.message) {
      this.showErrorMessage(element, options.message);
    }
    
    // Error particles
    if (this.config.enableParticles && options.type !== 'minor_error') {
      this.createErrorParticles(element);
    }
  }

  animateErrorShake(element, options) {
    const intensity = options.intensity || this.config.errorShakeIntensity;
    const duration = this.config.animationDuration;
    
    element.style.animation = `error-shake-${intensity} ${duration}ms ease-in-out`;
    
    setTimeout(() => {
      element.style.animation = '';
    }, duration);
  }

  animateErrorGlow(element, options) {
    const originalBoxShadow = element.style.boxShadow;
    const originalBackground = element.style.background;
    
    element.style.transition = `all ${this.config.animationDuration}ms ease`;
    element.style.boxShadow = '0 0 20px rgba(220, 53, 69, 0.5)';
    element.style.background = 'rgba(220, 53, 69, 0.1)';
    
    setTimeout(() => {
      element.style.boxShadow = originalBoxShadow;
      element.style.background = originalBackground;
      
      setTimeout(() => {
        element.style.transition = '';
      }, this.config.animationDuration);
    }, this.config.animationDuration);
  }

  createErrorParticles(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Create "broken" particles effect
    for (let i = 0; i < 8; i++) {
      this.createErrorParticle(centerX, centerY, i);
    }
  }

  createErrorParticle(x, y, index) {
    const particle = document.createElement('div');
    particle.className = 'error-particle';
    
    const angle = (index / 8) * Math.PI * 2;
    const velocity = 60;
    const finalX = x + Math.cos(angle) * velocity;
    const finalY = y + Math.sin(angle) * velocity;
    
    particle.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 6px;
      height: 6px;
      background: #dc3545;
      z-index: 9999;
      pointer-events: none;
      animation: error-particle ${this.config.animationDuration}ms ease-out;
      transform: translate3d(${finalX - x}px, ${finalY - y}px, 0) scale(0);
    `;
    
    document.body.appendChild(particle);
    
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, this.config.animationDuration);
  }

  showErrorMessage(element, message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'error-message-popup';
    messageEl.textContent = message;
    
    const rect = element.getBoundingClientRect();
    messageEl.style.cssText = `
      position: fixed;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top - 40}px;
      transform: translateX(-50%);
      background: #dc3545;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 1.5rem;
      font-size: 0.875rem;
      z-index: 9999;
      animation: error-message ${this.config.animationDuration * 2}ms ease;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, this.config.animationDuration * 2);
  }

  // Specific feedback implementations
  handleInputValidationFeedback(input) {
    if (input.validity.valid && input.value.trim().length > 0) {
      this.triggerInputSuccessFeedback(input);
    } else if (!input.validity.valid && input.value.trim().length > 0) {
      this.triggerInputErrorFeedback(input);
    }
  }

  triggerInputSuccessFeedback(input) {
    // Add success styling
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    
    // Success glow
    this.triggerSuccessFeedback(input, {
      type: 'input_validation',
      intensity: 'subtle'
    });
  }

  triggerInputErrorFeedback(input) {
    // Add error styling
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    
    // Error shake
    this.triggerErrorFeedback(input, {
      type: 'input_validation',
      intensity: 4,
      message: input.validationMessage
    });
  }

  triggerFormSuccessFeedback(form) {
    this.triggerSuccessFeedback(form, {
      type: 'form_submission',
      message: 'Form submitted successfully!'
    });
  }

  triggerFormErrorFeedback(form) {
    const firstInvalidField = form.querySelector(':invalid');
    if (firstInvalidField) {
      firstInvalidField.focus();
      this.triggerErrorFeedback(firstInvalidField, {
        type: 'form_validation',
        message: 'Please check the highlighted fields'
      });
    }
  }

  triggerButtonClickFeedback(button) {
    // Quick button press animation
    const originalTransform = button.style.transform;
    button.style.transform = 'scale(0.95)';
    button.style.transition = 'transform 100ms ease';
    
    setTimeout(() => {
      button.style.transform = originalTransform;
    }, 100);
  }

  triggerDragStartFeedback(element) {
    element.style.opacity = '0.8';
    element.style.transform = 'scale(1.05) rotate(2deg)';
    element.style.transition = 'all 200ms ease';
    element.classList.add('dragging-feedback');
  }

  triggerDropZoneEnterFeedback(dropZone) {
    dropZone.style.background = 'rgba(0, 123, 255, 0.1)';
    dropZone.style.borderColor = '#007bff';
    dropZone.style.transform = 'scale(1.02)';
    dropZone.style.transition = 'all 200ms ease';
  }

  triggerDropSuccessFeedback(dropZone) {
    this.triggerSuccessFeedback(dropZone, {
      type: 'drop_success',
      message: 'Images added successfully!'
    });
  }

  // Gallery-specific feedback
  triggerImageUploadSuccess(element) {
    this.triggerSuccessFeedback(element, {
      type: 'image_upload',
      message: 'Image uploaded!',
      particles: true
    });
  }

  triggerBatchOperationSuccess(details) {
    const { count, operation } = details;
    this.triggerSuccessFeedback(this.getContextElement(), {
      type: 'major_success',
      message: `${operation} completed for ${count} images!`,
      celebration: count > 5
    });
  }

  triggerSectionCreatedFeedback(element) {
    this.triggerSuccessFeedback(element, {
      type: 'section_created',
      message: 'Gallery section created!'
    });
  }

  triggerSelectionFeedback(details) {
    const { element, selected } = details;
    
    if (selected) {
      // Selection success
      element.style.transform = 'scale(1.1)';
      element.style.transition = 'transform 200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      
      // Quick particle burst
      this.createSelectionBurst(element);
    } else {
      // Deselection
      element.style.transform = 'scale(0.95)';
      element.style.transition = 'transform 150ms ease';
    }
    
    setTimeout(() => {
      element.style.transform = '';
    }, 200);
  }

  createSelectionBurst(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        left: ${centerX}px;
        top: ${centerY}px;
        width: 4px;
        height: 4px;
        background: #007bff;
        border-radius: 50%;
        z-index: 1000;
        animation: selection-burst 300ms ease-out;
        animation-delay: ${i * 20}ms;
      `;
      
      document.body.appendChild(particle);
      
      setTimeout(() => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      }, 400);
    }
  }

  triggerOperationErrorFeedback(details) {
    const { element, operation, error } = details;
    this.triggerErrorFeedback(element || this.getContextElement(), {
      type: 'operation_error',
      message: `${operation} failed: ${error}`
    });
  }

  // Sound and haptic feedback
  createSuccessSound() {
    // Create a pleasant success sound using Web Audio API
    if (!window.AudioContext) return null;
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    return { oscillator, gainNode, audioContext };
  }

  createErrorSound() {
    if (!window.AudioContext) return null;
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
    oscillator.frequency.setValueAtTime(196, audioContext.currentTime + 0.1); // G3
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    return { oscillator, gainNode, audioContext };
  }

  playSound(type) {
    if (!this.config.enableSoundEffects || !this.sounds[type]) return;
    
    const sound = this.sounds[type];
    sound.oscillator.start();
    sound.oscillator.stop(sound.audioContext.currentTime + 0.3);
  }

  triggerHapticFeedback(type) {
    if (!this.config.enableHapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      success: [50, 50, 100],
      error: [100, 100, 100],
      warning: [50, 100, 50],
      selection: [25]
    };
    
    navigator.vibrate(patterns[type] || patterns.selection);
  }

  // Utility methods
  shouldAnimate() {
    return !this.config.respectMotionPreference || 
           !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  generateAnimationId() {
    return `anim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getContextElement() {
    // Return the most appropriate element for context-less feedback
    return document.querySelector('#sections_list') || 
           document.querySelector('.main-content') || 
           document.body;
  }

  startAnimationLoop() {
    // Clean up completed animations
    const cleanupAnimations = () => {
      const now = Date.now();
      for (const [id, animation] of this.activeAnimations) {
        if (now - animation.startTime > this.config.animationDuration * 3) {
          this.activeAnimations.delete(id);
        }
      }
      requestAnimationFrame(cleanupAnimations);
    };
    
    requestAnimationFrame(cleanupAnimations);
  }

  createParticleSystem() {
    // Inject keyframe animations for particles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes success-particle {
        0% { 
          opacity: 1; 
          transform: translate3d(0, 0, 0) scale(1); 
        }
        100% { 
          opacity: 0; 
          transform: translate3d(var(--dx, 0), var(--dy, 0), 0) scale(0); 
        }
      }
      
      @keyframes error-particle {
        0% { 
          opacity: 1; 
          transform: translate3d(0, 0, 0) scale(1); 
        }
        100% { 
          opacity: 0; 
          transform: translate3d(var(--dx, 0), var(--dy, 0), 0) scale(0); 
        }
      }
      
      @keyframes confetti-fall {
        0% { transform: translateY(-20px) rotate(0deg); }
        100% { transform: translateY(100vh) rotate(360deg); }
      }
      
      @keyframes success-message {
        0% { 
          opacity: 0; 
          transform: translateX(-50%) translateY(20px) scale(0.8); 
        }
        20% { 
          opacity: 1; 
          transform: translateX(-50%) translateY(-10px) scale(1.1); 
        }
        100% { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-40px) scale(0.8); 
        }
      }
      
      @keyframes error-message {
        0% { 
          opacity: 0; 
          transform: translateX(-50%) translateY(10px) scale(0.8); 
        }
        20% { 
          opacity: 1; 
          transform: translateX(-50%) translateY(-5px) scale(1); 
        }
        100% { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-30px) scale(0.9); 
        }
      }
      
      .celebration-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .celebration-overlay.show {
        opacity: 1;
      }
      
      .celebration-content {
        text-align: center;
        color: white;
        animation: bounce-in 0.6s ease;
      }
      
      .celebration-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
      }
      
      .celebration-text {
        font-size: 1.5rem;
        font-weight: bold;
      }
    `;
    document.head.appendChild(style);
  }

  // Public API
  showSuccessAnimation(element, options = {}) {
    this.triggerSuccessFeedback(element, options);
  }

  showErrorAnimation(element, options = {}) {
    this.triggerErrorFeedback(element, options);
  }

  showCelebration(message = 'Great job!') {
    const element = this.getContextElement();
    this.triggerSuccessFeedback(element, {
      type: 'major_success',
      message,
      celebration: true
    });
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  destroy() {
    // Clean up active animations and sounds
    this.activeAnimations.clear();
    
    if (this.sounds) {
      Object.values(this.sounds).forEach(sound => {
        if (sound.audioContext) {
          sound.audioContext.close();
        }
      });
    }
  }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
  window.feedbackAnimationSystem = new FeedbackAnimationSystem();
});

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FeedbackAnimationSystem;
} else {
  window.FeedbackAnimationSystem = FeedbackAnimationSystem;
}