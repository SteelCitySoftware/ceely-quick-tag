import { renderHook } from '@testing-library/react';
import { act } from 'react';
import useFocusManagement from './useFocusManagement';

// Mock DOM methods
const mockFocus = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  
  // Mock document methods
  Object.defineProperty(document, 'addEventListener', {
    writable: true,
    value: mockAddEventListener,
  });
  
  Object.defineProperty(document, 'removeEventListener', {
    writable: true,
    value: mockRemoveEventListener,
  });
  
  Object.defineProperty(document, 'activeElement', {
    writable: true,
    value: null,
  });
  
  Object.defineProperty(document, 'getElementById', {
    writable: true,
    value: jest.fn((id) => {
      if (id === 'tagField' || id === 'barcodeField') {
        return { focus: mockFocus };
      }
      return null;
    }),
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useFocusManagement', () => {
  describe('hook initialization', () => {
    it('should setup event listener on mount', () => {
      renderHook(() => useFocusManagement());
      
      expect(mockAddEventListener).toHaveBeenCalledWith('focusin', expect.any(Function));
    });

    it('should cleanup event listener on unmount', () => {
      const { unmount } = renderHook(() => useFocusManagement());
      
      unmount();
      
      expect(mockRemoveEventListener).toHaveBeenCalledWith('focusin', expect.any(Function));
    });
  });

  describe('focus management behavior', () => {
    it('should focus barcode field when focus changes away from tag and barcode fields', () => {
      const { result } = renderHook(() => useFocusManagement());
      
      // Simulate focus event
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      // Mock activeElement as some other element
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: { classList: { contains: () => false } },
      });
      
      act(() => {
        if (focusHandler) {
          focusHandler({ target: { id: 'someOtherElement' } });
        }
      });
      
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      
      expect(mockFocus).toHaveBeenCalled();
    });

    it('should not interfere when focus is on tag field', () => {
      renderHook(() => useFocusManagement());
      
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      // Mock getElementById to return tag field
      const tagField = { focus: mockFocus };
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: tagField,
      });
      
      act(() => {
        if (focusHandler) {
          focusHandler({ target: tagField });
        }
      });
      
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      
      // Focus should not be called since we're already on tag field
      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('should not interfere when focus is on barcode field', () => {
      renderHook(() => useFocusManagement());
      
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      // Mock getElementById to return barcode field
      const barcodeField = { focus: mockFocus };
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: barcodeField,
      });
      
      act(() => {
        if (focusHandler) {
          focusHandler({ target: barcodeField });
        }
      });
      
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      
      // Focus should not be called since we're already on barcode field
      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('should ignore inventory adjust input elements', () => {
      renderHook(() => useFocusManagement());
      
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      // Mock activeElement with inventory-adjust-input class
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: { 
          classList: { 
            contains: (className: string) => className === 'inventory-adjust-input' 
          } 
        },
      });
      
      act(() => {
        if (focusHandler) {
          focusHandler({ target: { classList: { contains: () => true } } });
        }
      });
      
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      
      // Focus should not be called since it's an inventory input
      expect(mockFocus).not.toHaveBeenCalled();
    });
  });

  describe('timer behavior', () => {
    it('should use correct delay timeout', () => {
      renderHook(() => useFocusManagement());
      
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: { classList: { contains: () => false } },
      });
      
      act(() => {
        if (focusHandler) {
          focusHandler({ target: { id: 'someOtherElement' } });
        }
      });
      
      // Check that focus is not called before timeout
      act(() => {
        jest.advanceTimersByTime(19999);
      });
      expect(mockFocus).not.toHaveBeenCalled();
      
      // Check that focus is called after timeout
      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle missing DOM elements gracefully', () => {
      Object.defineProperty(document, 'getElementById', {
        writable: true,
        value: jest.fn(() => null),
      });
      
      expect(() => {
        renderHook(() => useFocusManagement());
      }).not.toThrow();
    });

    it('should handle multiple rapid focus changes', () => {
      renderHook(() => useFocusManagement());
      
      const focusHandler = mockAddEventListener.mock.calls.find(
        call => call[0] === 'focusin'
      )?.[1];
      
      Object.defineProperty(document, 'activeElement', {
        writable: true,
        value: { classList: { contains: () => false } },
      });
      
      // Trigger multiple focus events rapidly
      act(() => {
        if (focusHandler) {
          focusHandler({ target: { id: 'element1' } });
          focusHandler({ target: { id: 'element2' } });
          focusHandler({ target: { id: 'element3' } });
        }
      });
      
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(20000);
        });
      }).not.toThrow();
    });
  });
});