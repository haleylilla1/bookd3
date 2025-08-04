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

    // Prevent zoom on input focus
    this.preventInputZoom();
    
    // Handle virtual keyboard
    this.handleVirtualKeyboard();
    
    // Fix viewport issues
    this.fixViewport();
  }

  private static preventInputZoom(): void {
    // Ensure all inputs have 16px font size to prevent zoom
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
      const element = input as HTMLElement;
      element.style.fontSize = '16px';
      element.style.webkitTextSizeAdjust = '100%';
    });

    // Listen for dynamically added inputs
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const newInputs = element.querySelectorAll('input, textarea, select');
            newInputs.forEach((input) => {
              const inputElement = input as HTMLElement;
              inputElement.style.fontSize = '16px';
              inputElement.style.webkitTextSizeAdjust = '100%';
            });
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