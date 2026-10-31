"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { blankDraft, STEP_FIELDS, STEPS, toDraft, toInput, validateDraft, type Draft } from "@/lib/draft";
import { todayIn } from "@/lib/engine/dates";
import type { EventInput } from "@/lib/engine/types";
import { sampleWedding } from "@/lib/sample";
import { EventInputSchema } from "@/lib/schema";
import { createPlan, updatePlan, usePlans } from "@/lib/store";
import { Icon } from "./Icon";
import styles from "./wizard.module.css";
import { GuestsBudgetStep, OccasionStep, WhenWhereStep, type StepProps } from "./WizardSteps";

const STEP_VIEWS: ((props: StepProps) => React.JSX.Element)[] = [OccasionStep, WhenWhereStep, GuestsBudgetStep];

interface WizardProps {
  sample: boolean;
  editId?: string;
}

export function Wizard({ sample, editId }: WizardProps) {
  const router = useRouter();
  const plans = usePlans();
  const [today] = useState(() => todayIn());
  const [draft, setDraft] = useState<Draft>(() => blankDraft(today));
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [loadedEdit, setLoadedEdit] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const uid = useId();

  // "Try a sample wedding" goes straight to a ready plan.
  useEffect(() => {
    if (!sample) return;
    const plan = createPlan(sampleWedding(today));
    router.replace(`/plans/${plan.id}`);
  }, [sample, today, router]);

  // Editing: fill the form once the saved plan has loaded from storage.
  const editing = editId ? plans?.find((p) => p.id === editId) : undefined;
  if (editing && !loadedEdit) {
    setLoadedEdit(true);
    setDraft(toDraft(editing.input));
  }

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const errors = validateDraft(draft, today);
  const stepErrors = (STEP_FIELDS[step] ?? []).filter((f) => errors[f]);
  const isLastStep = step === STEPS.length - 1;

  function next() {
    if (stepErrors.length) {
      setShowErrors(true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setShowErrors(false);
    if (!isLastStep) {
      setStep(step + 1);
      return;
    }
    const input = EventInputSchema.parse(toInput(draft));
    if (editing) {
      updatePlan(editing.id, (p) => ({ ...p, input, locks: {} }));
      router.push(`/plans/${editing.id}`);
    } else {
      router.push(`/plans/${createPlan(input).id}`);
    }
  }

  function back() {
    setShowErrors(false);
    setStep(step - 1);
  }

  if (sample) {
    return (
      <p className="muted" role="status">
        Preparing the sample plan.
      </p>
    );
  }

  const StepView = STEP_VIEWS[step] ?? OccasionStep;
  const stepProps: StepProps = {
    draft,
    today,
    uid,
    set: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    err: (field: keyof EventInput) => (showErrors ? errors[field] : undefined),
  };
  const submitLabel = !isLastStep ? "Continue" : editing ? "Update plan" : "Create my plan";

  return (
    <div className={styles.wrap}>
      <ol className={styles.progress} aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? styles.done : undefined}>
            <span className={styles.dot} aria-hidden="true">
              {i < step ? <Icon name="check" /> : i + 1}
            </span>
            <span>{s}</span>
            {i < step && <span className="sr-only">(completed)</span>}
          </li>
        ))}
      </ol>

      <form
        className={`card stack ${styles.form}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
          {editing ? `Edit: ${STEPS[step]}` : STEPS[step]}
        </h1>

        <StepView {...stepProps} />

        {showErrors && stepErrors.length > 0 && (
          <p className="error" role="alert">
            <Icon name="stop" /> Fix{" "}
            {stepErrors.length === 1 ? "the highlighted field" : `the ${stepErrors.length} highlighted fields`} to
            continue.
          </p>
        )}

        <div className={`row spread ${styles.actions}`}>
          {step > 0 ? (
            <button type="button" className="btn btn-quiet" onClick={back}>
              <Icon name="arrowLeft" /> Back
            </button>
          ) : (
            <span />
          )}
          {/* Disabled until hydrated: an early click would do a native submit and reload the empty form. */}
          <button type="submit" className="btn btn-primary" disabled={plans === null}>
            {submitLabel} <Icon name="arrowRight" />
          </button>
        </div>
      </form>
    </div>
  );
}
