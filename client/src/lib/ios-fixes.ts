// iOS Safari mobile fixes and zoom prevention
export class IOSMobileFixes {
  private static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  private static isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }

  static init(): void {
    if (!this.isIOS()) return;

    console.log('🍎 Initializing iOS Safari fixes for entire app');

    // Prevent zoom on input focus
    this.preventInputZoom();
    
    // Handle virtual keyboard
    this.handleVirtualKeyboard();
    
    // Fix viewport issues
    this.fixViewport();
    
    // Additional global fixes
    this.applyGlobalIOSFixes();
  }

  private static applyGlobalIOSFixes(): void {
    // Prevent double-tap zoom globally
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // Add event listeners for focus events to ensure zoom prevention
    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('input, textarea, select')) {
        target.style.fontSize = '16px';
        target.style.webkitTextSizeAdjust = '100%';
        target.style.textSizeAdjust = '100%';
      }
    });
  }

  private static preventInputZoom(): void {
    // Ensure ALL inputs throughout the app have 16px font size to prevent zoom
    const applyZoomPrevention = (element: HTMLElement) => {
      element.style.fontSize = '16px';
      element.style.webkitTextSizeAdjust = '100%';
      element.style.textSizeAdjust = '100%';
      element.style.webkitTransform = 'translateZ(0)';
      element.style.transform = 'translateZ(0)';
    };

    // Apply to existing inputs
    const inputs = document.querySelectorAll('input, textarea, select, button[type="submit"]');
    inputs.forEach((input) => {
      applyZoomPrevention(input as HTMLElement);
    });

    // Listen for dynamically added inputs (React re-renders, new forms, etc.)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check if the node itself is an input
            if (element.matches('input, textarea, select, button[type="submit"]')) {
              applyZoomPrevention(element as HTMLElement);
            }
            
            // Check for child inputs
            const newInputs = element.querySelectorAll('input, textarea, select, button[type="submit"]');
            newInputs.forEach((input) => {
              applyZoomPrevention(input as HTMLElement);
            });
            
            // Special handling for form components and dialogs
            if (element.matches('[data-radix-dialog-content], form, [class*="form"], [class*="dialog"]')) {
              const formInputs = element.querySelectorAll('input, textarea, select');
              formInputs.forEach((input) => {
                applyZoomPrevention(input as HTMLElement);
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private static handleVirtualKeyboard(): void {
    let keyboardHeight = 0;
    
    // Listen for viewport changes (keyboard open/close)
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const currentHeight = viewport.height;
      const windowHeight = window.innerHeight;
      
      if (currentHeight < windowHeight * 0.75) {
        // Keyboard is likely open
        keyboardHeight = windowHeight - currentHeight;
        document.body.classList.add('keyboard-open');
        document.body.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      } else {
        // Keyboard is likely closed
        keyboardHeight = 0;
        document.body.classList.remove('keyboard-open');
        document.body.style.setProperty('--keyboard-height', '0px');
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Fallback for older iOS versions
    window.addEventListener('resize', () => {
      setTimeout(handleViewportChange, 300);
    });
  }

  private static fixViewport(): void {
    // Prevent bounce scrolling on body
    document.body.style.overscrollBehavior = 'none';
    
    // Fix safe area handling
    const root = document.documentElement;
    root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
    root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
    root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
    root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
  }

  // Method to be called when a modal/dialog opens
  static handleDialogOpen(): void {
    if (!this.isIOS()) return;
    
    // Prevent background scrolling
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
  }

  // Method to be called when a modal/dialog closes
  static handleDialogClose(): void {
    if (!this.isIOS()) return;
    
    // Restore scrolling
    const scrollY = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
  }
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => IOSMobileFixes.init());
  } else {
    IOSMobileFixes.init();
  }
}