"use client";

import { useState, useCallback } from "react";

export function useConversationController() {
  const [isActive, setIsActive] = useState(false);
  const [instructions, setInstructions] = useState("");

  const handleStart = useCallback(() => {
    setIsActive(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsActive(false);
  }, []);

  const handleInstructionsChange = useCallback((value: string) => {
    setInstructions(value);
  }, []);

  return {
    isActive,
    instructions,
    handleStart,
    handleStop,
    handleInstructionsChange,
  };
}