import { AdvancedInputs } from "./advanced-inputs";
import { BasicInputs } from "./basic-inputs";
import { CheckboxAndRadio } from "./checkbox-and-radio";
import { DefaultInputGroup } from "./default-input-group";
import { FileInputs } from "./file-inputs";
import { InputGroupMerged } from "./input-group-merged";
import { SelectInputs } from "./select-inputs";

export function Forms() {
  return (
    <section className="container grid gap-4 p-4 md:grid-cols-2">
      <BasicInputs />
      <CheckboxAndRadio />
      <AdvancedInputs />
      <FileInputs />
      <SelectInputs />
      <DefaultInputGroup />
      <InputGroupMerged />
    </section>
  );
}
