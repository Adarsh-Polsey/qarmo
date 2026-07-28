import { useState, useEffect, useCallback } from 'react';
import { safeSecureStore as SecureStore } from '@qarmo/supabase';

export interface WizardData {
  // Step 0 — pre-auth selections (stored locally before OTP)
  accountType: 'customer' | 'partner' | '';
  partnerType: 'delivery' | 'ride' | '';

  // Shared fields
  fullName: string;

  // Partner-only fields
  plateNumber: string;
  city: string;
  photoUri: string;
  aadhaarUri: string;
  drivingLicenceUri: string;
  referralCode: string;
}

const initialData: WizardData = {
  accountType: 'customer',
  partnerType: '',
  fullName: '',
  plateNumber: '',
  city: '',
  photoUri: '',
  aadhaarUri: '',
  drivingLicenceUri: '',
  referralCode: '',
};

export const useWizard = (userId: string | undefined) => {
  const [step, setStepState] = useState<number>(1);
  const [formData, setFormData] = useState<WizardData>(initialData);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const storageKey = userId ? `wizard_progress_v2_${userId}` : null;

  // Load persisted progress from SecureStore when userId is available
  useEffect(() => {
    const loadProgress = async () => {
      if (!storageKey) return;
      try {
        const saved = await SecureStore.getItemAsync(storageKey);
        if (saved) {
          const { savedStep, savedData } = JSON.parse(saved);
          if (typeof savedStep === 'number') setStepState(savedStep);
          if (savedData) setFormData((prev) => ({ ...prev, ...savedData }));
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

  // Memoized (unlike updateFormData/setStep above) so its identity is stable across
  // renders whenever storageKey doesn't change — callers can safely put it in a
  // useEffect dependency array without the effect re-firing on every render.
  const resetWizard = useCallback(async () => {
    setStepState(1);
    setFormData(initialData);
    if (storageKey) {
      try {
        await SecureStore.deleteItemAsync(storageKey);
      } catch (e) {
        console.error('Failed to clear wizard progress from storage:', e);
      }
    }
  }, [storageKey]);

  return {
    step,
    setStep,
    formData,
    updateFormData,
    isLoaded,
    resetWizard,
  };
};
