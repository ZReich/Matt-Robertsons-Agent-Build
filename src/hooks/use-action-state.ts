// This is an alternative to the useActionState hook that is not yet released.
// @see https://react.dev/reference/react/useActionState

"use client";

import * as React from "react";

type Action<FormData, State> = (formData: FormData) => Promise<State>;

interface FormState<State> {
  data: State;
  isPending: boolean;
  isError: boolean;
}

export function useActionState<FormData, State>(
  action: Action<FormData, State>,
  initialState: State
): [State, (formData: FormData) => Promise<void>, boolean, boolean] {
  const [formState, setFormState] = React.useState<FormState<State>>({
    data: initialState,
    isPending: false,
    isError: false,
  });

  const dispatch = React.useCallback(
    async (formData: FormData) => {
      setFormState((prevState) => ({
        ...prevState,
        isPending: true,
        isError: false,
      }));

      try {
        const newState = await action(formData);
        setFormState({ data: newState, isPending: false, isError: false });
      } catch (error) {
        console.error(error);
        setFormState((prevState) => ({
          ...prevState,
          isPending: false,
          isError: true,
        }));
      }
    },
    [action]
  );

  return [formState.data, dispatch, formState.isPending, formState.isError];
}
