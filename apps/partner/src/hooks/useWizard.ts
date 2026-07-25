import { useState, useEffect } from 'react';
import { safeSecureStore as SecureStore } from '@qarmo/supabase';

export interface WizardData {
  fullName: string;
  photoUri: string;
  roles: string[];
  city: string;
  vehicles: Record<string, { vehicleType: string; registrationNumber: string }>;
  referralCode: string;
}

const initialData: WizardData = {
  fullName: '',
  photoUri: '',
  roles: [],
  city: '',
  vehicles: {},
  referralCode: '',
};

export const useWizard = (userId: string | undefined) => {
  const [step, setStepState] = useState<number>(1);
  const [formData, setFormData] = useState<WizardData>(initialData);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const storageKey = userId ? `@wizard_progress_${userId}` : null;

  // Load progress from AsyncStorage when userId is available
  useEffect(() => {
    const loadProgress = async () => {
      if (!storageKey) return;
      try {
        const saved = await SecureStore.getItemAsync(storageKey);
        if (saved) {
          const { savedStep, savedData } = JSON.parse(saved);
          if (savedStep) setStepState(savedStep);
          if (savedData) setFormData(savedData);
        }
      } catch (e) {
        console.error('Failed to load wizard progress from storage:', e);
      } finally {
        setIsLoaded(true);
      }
    };

    loadProgress();
  }, [storageKey]);

  const saveProgress = async (nextStep: number, nextData: WizardData) => {
    if (!storageKey) return;
    try {
      await SecureStore.setItemAsync(
        storageKey,
        JSON.stringify({ savedStep: nextStep, savedData: nextData }),
      );
    } catch (e) {
      console.error('Failed to save wizard progress to storage:', e);
    }
  };

  const updateFormData = (updates: Partial<WizardData>) => {
    setFormData((prev) => {
      const next = { ...prev, ...updates };
      saveProgress(step, next);
      return next;
    });
  };

  const setStep = (nextStep: number) => {
    setStepState(nextStep);
    saveProgress(nextStep, formData);
  };

  const resetWizard = async () => {
    setStepState(1);
    setFormData(initialData);
    if (storageKey) {
      try {
        await SecureStore.deleteItemAsync(storageKey);
      } catch (e) {
        console.error('Failed to clear wizard progress from storage:', e);
      }
    }
  };

  return {
    step,
    setStep,
    formData,
    updateFormData,
    isLoaded,
    resetWizard,
  };
};
