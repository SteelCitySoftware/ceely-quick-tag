// Helper utility functions

import successSound from "../routes/sounds/success.mp3";
import failureSound from "../routes/sounds/failure.mp3";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function replaceCharacters(input: string): string {
  return input.replace(/:/g, " ").replace(/-/g, " dash, ");
}

export function playSuccessSound(): void {
  const audio = new Audio(successSound);
  audio.play();
}

export function playFailureSound(): void {
  const audio = new Audio(failureSound);
  audio.play();
}

export function speakText(text: string): void {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  } else {
    console.error("Speech synthesis is not supported in this browser.");
  }
}