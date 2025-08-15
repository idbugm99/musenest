/**
 * Mobile Touch Handler - Advanced Touch Gesture System
 * Provides professional touch interactions for mobile gallery management
 */

class MobileTouchHandler {
  constructor(options = {}) {
    this.options = {
      // Touch sensitivity settings
      swipeThreshold: 50, // Minimum distance for swipe
      tapThreshold: 10, // Maximum movement for tap
      longPressDelay: 500, // Long press duration
      doubleTapDelay: 300, // Double tap detection window
      
      // Gesture settings
      enableSwipeNavigation: true,
      enablePinchZoom: true,
      enableHapticFeedback: true,
      enableSwipeToSelect: true,
      
      // Performance settings
      throttleDelay: 16, // ~60fps
      ...options
    };
    
    // Touch state
    this.touchState = {
      isPointerDown: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      lastTapTime: 0,
      longPressTimer: null,
      
      // Multi-touch
      touches: new Map(),
      initialDistance: 0,
      currentDistance: 0,
      isPinching: false
    };
    
    // Device detection
    this.isMobile = this.detectMobile();
    this.hasHapticFeedback = 'vibrate' in navigator;
    
    // Throttled event handlers
    this.throttledTouchMove = this.throttle(this.handleTouchMove.bind(this), this.options.throttleDelay);
    
    this.bindEvents();
  }

  detectMobile() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
  }

  bindEvents() {
    if (!this.isMobile) return;
    
    // Passive listeners for better performance
    document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.throttledTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: true });
    
    // Pointer events for modern browsers
    document.addEventListener('pointerdown', this.handlePointerDown.bind(this), { passive: false });
    document.addEventListener('pointermove', this.handlePointerMove.bind(this), { passive: false });
    document.addEventListener('pointerup', this.handlePointerUp.bind(this), { passive: false });
    
    // Prevent default behaviors that interfere with gestures
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
    document.addEventListener('gestureend', e => e.preventDefault(), { passive: false });
  }

  // Touch event handlers
  handleTouchStart(e) {
    if (e.touches.length === 1) {
      this.handleSingleTouchStart(e.touches[0]);
    } else if (e.touches.length === 2) {
      this.handlePinchStart(e.touches);
    }
    
    // Update touch map
    for (const touch of e.touches) {
      this.touchState.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now()
      });
    }
  }

  handleSingleTouchStart(touch) {
    this.touchState.isPointerDown = true;
    this.touchState.startX = touch.clientX;
    this.touchState.startY = touch.clientY;
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
    
    // Start long press timer
    this.touchState.longPressTimer = setTimeout(() => {
      this.handleLongPress(touch);
    }, this.options.longPressDelay);
    
    // Find target element
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    this.currentTarget = target;
    
    // Add touch feedback
    this.addTouchFeedback(target);
  }

  handleTouchMove(e) {
    if (e.touches.length === 1) {
      this.handleSingleTouchMove(e.touches[0]);
    } else if (e.touches.length === 2) {
      this.handlePinchMove(e.touches);
    }
    
    // Clear long press if moved too far
    const touch = e.touches[0];
    if (touch) {
      const deltaX = Math.abs(touch.clientX - this.touchState.startX);
      const deltaY = Math.abs(touch.clientY - this.touchState.startY);
      
      if (deltaX > this.options.tapThreshold || deltaY > this.options.tapThreshold) {
        this.clearLongPressTimer();
      }
    }
  }

  handleSingleTouchMove(touch) {
    if (!this.touchState.isPointerDown) return;
    
    this.touchState.currentX = touch.clientX;
    this.touchState.currentY = touch.clientY;
    
    const deltaX = touch.clientX - this.touchState.startX;
    const deltaY = touch.clientY - this.touchState.startY;
    
    // Handle swipe gestures
    if (Math.abs(deltaX) > this.options.swipeThreshold || Math.abs(deltaY) > this.options.swipeThreshold) {
      this.handleSwipeMove(deltaX, deltaY, touch);
    }
  }

  handleTouchEnd(e) {
    if (e.touches.length === 0) {
      this.handleSingleTouchEnd(e.changedTouches[0]);
    } else if (e.touches.length === 1) {
      this.handlePinchEnd();
    }
    
    // Clean up touch map
    for (const touch of e.changedTouches) {
      this.touchState.touches.delete(touch.identifier);
    }
  }

  handleSingleTouchEnd(touch) {
    this.clearLongPressTimer();
    this.removeTouchFeedback();
    
    if (!this.touchState.isPointerDown) return;
    
    const deltaX = touch.clientX - this.touchState.startX;
    const deltaY = touch.clientY - this.touchState.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance <= this.options.tapThreshold) {
      this.handleTap(touch);
    } else if (Math.abs(deltaX) > this.options.swipeThreshold || Math.abs(deltaY) > this.options.swipeThreshold) {
      this.handleSwipeEnd(deltaX, deltaY, touch);
    }
    
    this.touchState.isPointerDown = false;
  }

  // Pinch/zoom handlers
  handlePinchStart(touches) {
    if (!this.options.enablePinchZoom) return;
    
    this.touchState.isPinching = true;
    this.touchState.initialDistance = this.getDistance(touches[0], touches[1]);
    this.clearLongPressTimer();
    
    this.triggerEvent('pinchstart', {
      distance: this.touchState.initialDistance,
      center: this.getCenter(touches[0], touches[1])
    });
  }

  handlePinchMove(touches) {
    if (!this.touchState.isPinching) return;
    
    this.touchState.currentDistance = this.getDistance(touches[0], touches[1]);
    const scale = this.touchState.currentDistance / this.touchState.initialDistance;
    
    this.triggerEvent('pinchmove', {
      scale: scale,
      distance: this.touchState.currentDistance,
      center: this.getCenter(touches[0], touches[1])
    });
  }

  handlePinchEnd() {
    if (!this.touchState.isPinching) return;
    
    const scale = this.touchState.currentDistance / this.touchState.initialDistance;
    
    this.triggerEvent('pinchend', {
      scale: scale,
      distance: this.touchState.currentDistance
    });
    
    this.touchState.isPinching = false;
  }

  // Gesture recognition
  handleTap(touch) {
    const now = Date.now();
    const timeSinceLastTap = now - this.touchState.lastTapTime;
    
    if (timeSinceLastTap < this.options.doubleTapDelay) {
      this.handleDoubleTap(touch);
    } else {
      this.handleSingleTap(touch);
    }
    
    this.touchState.lastTapTime = now;
  }

  handleSingleTap(touch) {
    this.hapticFeedback('light');
    
    this.triggerEvent('tap', {
      x: touch.clientX,
      y: touch.clientY,
      target: this.currentTarget
    });
  }

  handleDoubleTap(touch) {
    this.hapticFeedback('medium');
    
    this.triggerEvent('doubletap', {
      x: touch.clientX,
      y: touch.clientY,
      target: this.currentTarget
    });
  }

  handleLongPress(touch) {
    this.hapticFeedback('heavy');
    
    this.triggerEvent('longpress', {
      x: touch.clientX,
      y: touch.clientY,
      target: this.currentTarget
    });
    
    this.touchState.longPressTimer = null;
  }

  handleSwipeMove(deltaX, deltaY, touch) {
    const direction = this.getSwipeDirection(deltaX, deltaY);
    
    this.triggerEvent('swipemove', {
      direction: direction,
      deltaX: deltaX,
      deltaY: deltaY,
      x: touch.clientX,
      y: touch.clientY,
      target: this.currentTarget
    });
  }

  handleSwipeEnd(deltaX, deltaY, touch) {
    const direction = this.getSwipeDirection(deltaX, deltaY);
    const velocity = this.calculateVelocity(deltaX, deltaY);
    
    this.hapticFeedback('light');
    
    this.triggerEvent('swipe', {
      direction: direction,
      deltaX: deltaX,
      deltaY: deltaY,
      velocity: velocity,
      x: touch.clientX,
      y: touch.clientY,
      target: this.currentTarget
    });
  }

  // Pointer event handlers (for modern browsers)
  handlePointerDown(e) {
    if (e.pointerType === 'touch') {
      // Handle as touch event
      this.handleSingleTouchStart(e);
    }
  }

  handlePointerMove(e) {
    if (e.pointerType === 'touch') {
      this.handleSingleTouchMove(e);
    }
  }

  handlePointerUp(e) {
    if (e.pointerType === 'touch') {
      this.handleSingleTouchEnd(e);
    }
  }

  handleTouchCancel(e) {
    this.clearLongPressTimer();
    this.removeTouchFeedback();
    this.touchState.isPointerDown = false;
    this.touchState.isPinching = false;
    this.touchState.touches.clear();
  }

  // Utility methods
  getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getCenter(touch1, touch2) {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }

  getSwipeDirection(deltaX, deltaY) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  calculateVelocity(deltaX, deltaY) {
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const time = Date.now() - (this.touchState.touches.values().next().value?.timestamp || Date.now());
    return distance / Math.max(time, 1);
  }

  clearLongPressTimer() {
    if (this.touchState.longPressTimer) {
      clearTimeout(this.touchState.longPressTimer);
      this.touchState.longPressTimer = null;
    }
  }

  // Visual feedback
  addTouchFeedback(element) {
    if (!element) return;
    
    element.classList.add('touch-active');
    
    // Add ripple effect
    this.createRipple(element, this.touchState.startX, this.touchState.startY);
  }

  removeTouchFeedback() {
    if (!this.currentTarget) return;
    
    this.currentTarget.classList.remove('touch-active');
    
    // Remove ripple after animation
    setTimeout(() => {
      const ripples = this.currentTarget.querySelectorAll('.touch-ripple');
      ripples.forEach(ripple => ripple.remove());
    }, 600);
  }

  createRipple(element, x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const left = x - rect.left - size / 2;
    const top = y - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${left}px;
      top: ${top}px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
      z-index: 1000;
    `;
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
  }

  // Haptic feedback
  hapticFeedback(intensity = 'light') {
    if (!this.options.enableHapticFeedback || !this.hasHapticFeedback) return;
    
    const patterns = {
      light: [10],
      medium: [50],
      heavy: [100],
      double: [50, 50, 50],
      success: [25, 50, 25],
      error: [100, 100, 100]
    };
    
    navigator.vibrate(patterns[intensity] || patterns.light);
  }

  // Event system
  triggerEvent(eventType, data) {
    const event = new CustomEvent(`mobile-${eventType}`, {
      detail: data,
      bubbles: true,
      cancelable: true
    });
    
    if (this.currentTarget) {
      this.currentTarget.dispatchEvent(event);
    } else {
      document.dispatchEvent(event);
    }
  }

  // Performance optimization
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  // Public API
  destroy() {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.throttledTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('touchcancel', this.handleTouchCancel);
    
    document.removeEventListener('pointerdown', this.handlePointerDown);
    document.removeEventListener('pointermove', this.handlePointerMove);
    document.removeEventListener('pointerup', this.handlePointerUp);
    
    this.clearLongPressTimer();
  }

  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
  }

  // Static method to check mobile support
  static isSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

// Add required CSS for touch interactions
const touchCSS = `
/* Mobile Touch Interaction Styles */
.touch-active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}

@keyframes ripple {
  to {
    transform: scale(2);
    opacity: 0;
  }
}

/* Touch-friendly sizes for mobile */
@media (max-width: 768px) {
  .btn {
    min-height: 44px;
    min-width: 44px;
    padding: 0.5rem 1rem;
  }
  
  .picker-image-tile,
  .drag-image-tile {
    min-height: 44px;
    cursor: default;
  }
  
  /* Larger touch targets for icons */
  .fas, .far {
    font-size: 1.1em;
  }
  
  /* Improved spacing for mobile */
  .btn-group .btn {
    margin-right: 2px;
  }
  
  /* Mobile-optimized modals */
  .modal-dialog {
    margin: 0.5rem;
  }
  
  .modal-fullscreen {
    margin: 0;
  }
}

/* Prevent text selection during touch interactions */
.drag-image-tile,
.picker-image-tile,
.gallery-drop-zone {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Smooth scrolling on mobile */
.overflow-auto {
  -webkit-overflow-scrolling: touch;
}
`;

// Inject CSS
const mobileTouchStyleSheet = document.createElement('style');
mobileTouchStyleSheet.textContent = touchCSS;
document.head.appendChild(mobileTouchStyleSheet);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileTouchHandler;
} else {
  window.MobileTouchHandler = MobileTouchHandler;
}