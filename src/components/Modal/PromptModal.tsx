import React, { useEffect, useState } from "react";
import styles from "./PromptModal.module.css";

export interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  initialValue = "",
  placeholder = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  validate,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialValue]);

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (validate) {
      const validationError = validate(trimmed);
      if (validationError) {
        setError(validationError);
        return;
      }
    } else if (!trimmed) {
      setError("This field cannot be empty");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, value, validate, onConfirm, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.title}>{title}</div>
        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.inputGroup}>
          <input
            type="text"
            className={styles.input}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            autoFocus
            disabled={isSubmitting}
          />
          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.cancelButton}`}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
