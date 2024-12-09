// This is an alternative to the useActionState hook that is not yet released.
// More info: https://react.dev/reference/react/useActionState

"use client";

import * as React from "react";

type Action<FormData, State> = FormData extends undefined
  ? () => Promise<State> // If FormData is undefined, no arguments are passed
  : (formData: FormData) => Promise<State>; // If FormData is defined, it is required

interface FormState<State> {
  data: State;
  isPending: boolean;
}

export function useActionState<FormData, State>(
  action: Action<FormData, State>,
  initialState: State
): [
  State,
  (formData: FormData) => Promise<void>,
  boolean // Pending state
] {
  const [formState, setFormState] = React.useState<FormState<State>>({
    data: initialState,
    isPending: false,
  });

  const dispatch = React.useCallback(
    async (formData: FormData) => {
      setFormState((prevState) => ({
        ...prevState,
        isPending: true,
      }));

      try {
        const newState = await action(formData);
        setFormState({ data: newState, isPending: false });
      } catch (error) {
        setFormState((prevState) => ({
          ...prevState,
          isPending: false,
        }));
      }
    },
    [action]
  );

  return [formState.data, dispatch, formState.isPending];
}
