import { startTransition, type FormEvent } from "react";

/**
 * onSubmit for forms driven by useActionState, used instead of `<form action>`. React resets a form after its
 * action runs, which wipes everything typed when the server answers with a validation error. Submitting by hand
 * keeps the values (and `pending` still works).
 */
export const submitKeepingValues = (action: (formData: FormData) => void) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => action(formData));
};
