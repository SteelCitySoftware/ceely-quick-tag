// Helper utility functions
import successSound from "../routes/sounds/success.mp3";
import failureSound from "../routes/sounds/failure.mp3";

/**
 * Sleep utility function
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Replace special characters for speech synthesis
 */
export function replaceCharacters(input: string): string {
  return input.replace(/:/g, " ").replace(/-/g, " dash, ");
}

/**
 * Play success sound
 */
export const playSuccessSound = (): void => {
  const audio = new Audio(successSound);
  audio.play().catch(console.error);
};

/**
 * Play failure sound
 */
export const playFailureSound = (): void => {
  const audio = new Audio(failureSound);
  audio.play().catch(console.error);
};

/**
 * Speak text using browser's speech synthesis
 */
export const speakText = (text: string): void => {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  } else {
    console.error("Speech synthesis is not supported in this browser.");
  }
};