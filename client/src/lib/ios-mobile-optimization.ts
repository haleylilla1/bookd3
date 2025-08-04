// iOS Mobile Optimization Utilities
// Comprehensive mobile UX improvements for iOS Safari and WebView

export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isIOSSafari = () => {
  return isIOS() && !window.navigator.standalone;
};

// Prevent iOS zoom on input focus
export const preventIOSZoom = () => {
  if (isIOS()) {
    const metaViewport = document.querySelector('meta[name=viewport]') as HTMLMetaElement;
    if (metaViewport) {
      metaViewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    }
  }
};

// Restore zoom capability when needed
export const restoreIOSZoom = () => {
  if (isIOS()) {
    const metaViewport = document.querySelector('meta[name=viewport]') as HTMLMetaElement;
    if (metaViewport) {
      metaViewport.content = 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes';
    }
  }
};

// Handle iOS keyboard covering buttons
export const handleIOSKeyboard = (callback?: (keyboardVisible: boolean) => void) => {
  if (!isIOS()) return;

  let initialViewportHeight = window.innerHeight;
  
  const handleResize = () => {
    const currentHeight = window.innerHeight;
    const heightDifference = initialViewportHeight - currentHeight;
    const keyboardVisible = heightDifference > 150; // Keyboard likely visible
    
    if (callback) {
      callback(keyboardVisible);
    }
    
    // Scroll to focused element if keyboard is covering it
    if (keyboardVisible) {
      setTimeout(() => {
        const focused = document.activeElement as HTMLElement;
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT')) {
          focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  };

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
};

// Enhanced touch feedback for buttons
export const addTouchFeedback = (element: HTMLElement) => {
  if (!isMobileDevice()) return;

  element.style.webkitTapHighlightColor = 'rgba(0,0,0,0.1)';
  element.style.touchAction = 'manipulation';
  
  let touchStartTime = 0;
  
  const handleTouchStart = (e: TouchEvent) => {
    touchStartTime = Date.now();
    element.style.transform = 'scale(0.98)';
    element.style.opacity = '0.8';
  };
  
  const handleTouchEnd = (e: TouchEvent) => {
    const touchDuration = Date.now() - touchStartTime;
    
    // Immediate feedback
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
    
    // Haptic feedback on iOS (if available)
    if (isIOS() && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };
  
  const handleTouchCancel = () => {
    element.style.transform = 'scale(1)';
    element.style.opacity = '1';
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchCancel, { passive: true });
  
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchCancel);
  };
};

// Safe area handling for iOS notch and home indicator
export const getIOSSafeAreaInsets = () => {
  if (!isIOS()) return { top: 0, bottom: 0, left: 0, right: 0 };
  
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0', 10),
    bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
    left: parseInt(style.getPropertyValue('--sal') || '0', 10),
    right: parseInt(style.getPropertyValue('--sar') || '0', 10),
  };
};

// Optimize scroll performance for iOS
export const optimizeIOSScrolling = (element: HTMLElement) => {
  if (!isIOS()) return;
  
  element.style.webkitOverflowScrolling = 'touch';
  element.style.overflowScrolling = 'touch';
  
  // Prevent elastic scrolling bounce
  let startY = 0;
  
  element.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });
  
  element.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    
    // Prevent overscroll
    if ((scrollTop <= 0 && currentY > startY) || 
        (scrollTop + clientHeight >= scrollHeight && currentY < startY)) {
      e.preventDefault();
    }
  }, { passive: false });
};

// Focus management for form fields
export const optimizeIOSFormFocus = () => {
  if (!isIOS()) return;
  
  document.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      // Prevent zoom
      target.style.fontSize = '16px';
      
      // Smooth scroll to input
      setTimeout(() => {
        target.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
      }, 100);
    }
  });
  
  document.addEventListener('focusout', (e) => {
    // Small delay to allow for natural focus transitions
    setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) {
        // Scroll back to natural position
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  });
};

// Initialize all iOS optimizations
export const initializeIOSOptimizations = () => {
  if (!isIOS()) return;
  
  console.log('🍎 Initializing iOS mobile optimizations...');
  
  // Apply CSS custom properties for safe areas
  if (CSS.supports('padding: env(safe-area-inset-top)')) {
    document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
    document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)');
    document.documentElement.style.setProperty('--sal', 'env(safe-area-inset-left)');
    document.documentElement.style.setProperty('--sar', 'env(safe-area-inset-right)');
  }
  
  // Initialize form focus optimizations
  optimizeIOSFormFocus();
  
  // Initialize keyboard handling
  handleIOSKeyboard((keyboardVisible) => {
    document.body.classList.toggle('ios-keyboard-visible', keyboardVisible);
  });
  
  // Add touch feedback to all buttons
  const addFeedbackToButtons = () => {
    const buttons = document.querySelectorAll('button, [role="button"], .btn');
    buttons.forEach(button => {
      if (button instanceof HTMLElement) {
        addTouchFeedback(button);
      }
    });
  };
  
  // Initial setup
  addFeedbackToButtons();
  
  // Re-apply to new buttons (for dynamic content)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const buttons = node.querySelectorAll('button, [role="button"], .btn');
          buttons.forEach(button => {
            if (button instanceof HTMLElement) {
              addTouchFeedback(button);
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  console.log('✅ iOS mobile optimizations initialized');
};