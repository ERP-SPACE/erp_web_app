export const optionValueEquals = (left, right) =>
  String(left ?? "") === String(right ?? "");

export const findAutocompleteOption = (options, value) =>
  options.find((option) => optionValueEquals(option?.value, value)) || null;

export const buildSingleSelectAutocompleteProps = (
  options,
  value,
  onValueChange
) => ({
  options,
  value: findAutocompleteOption(options, value),
  onChange: (_, selected) => onValueChange(selected?.value ?? ""),
  isOptionEqualToValue: (option, selected) =>
    optionValueEquals(option?.value, selected?.value),
  getOptionLabel: (option) => option?.label || "",
});
