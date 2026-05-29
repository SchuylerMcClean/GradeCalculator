import React, { useState } from "react";
import { TextInput, TextInputProps } from "react-native";

/**
 * Wrapper around TextInput that clears the placeholder text on focus
 * and restores it on blur, consistently across the whole app.
 */
export function AppTextInput({
  placeholder,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholder={focused ? "" : placeholder}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
}
