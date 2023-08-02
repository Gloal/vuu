import {
  ChangeEvent,
  HTMLAttributes,
  RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Filter, FilterClause } from "@finos/vuu-filter-types";
import { Input } from "@salt-ds/core";
import { ComboBox } from "@salt-ds/lab";
import {
  NUMERIC_OPERATORS,
  NumericOperator,
  isNumber,
  isNumericOperator,
} from "../operator-utils";
import { getNumericFilter } from "../filter-utils";

type NumericInputProps = HTMLAttributes<HTMLDivElement> & {
  column: string;
  operatorInputRef: RefObject<HTMLInputElement>;
  onFilterChange: (filter?: Filter) => void;
  defaultFilter?: FilterClause;
};

export const NumericInput = ({
  column,
  operatorInputRef,
  onFilterChange,
  defaultFilter,
  className,
}: NumericInputProps) => {
  const defaultValue =
    defaultFilter?.op !== "in" && isNumber(defaultFilter?.value)
      ? defaultFilter?.value
      : undefined;
  const defaultOp = isNumericOperator(defaultFilter?.op)
    ? defaultFilter?.op
    : undefined;

  const [valueInputValue, setValueInputValue] = useState<string>(
    defaultValue?.toString() || ""
  );
  const [operatorInputValue, setOperatorInputValue] = useState("");
  const [selectedOperator, setSelectedOperator] = useState<
    NumericOperator | undefined
  >(defaultOp);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedOperator(undefined);
    setValueInputValue("");
  }, [column]);

  return (
    <>
      <ComboBox<NumericOperator, "deselectable">
        className={`${className}-operatorSelector`}
        selectionStrategy="deselectable"
        source={NUMERIC_OPERATORS}
        onSelectionChange={(_event, selectedOperator) => {
          setSelectedOperator(selectedOperator || undefined);
          setTimeout(() => {
            valueInputRef.current?.querySelector("input")?.focus();
          }, 100);
        }}
        InputProps={{
          onChange: (event) => setOperatorInputValue(event.target.value),
          value: operatorInputValue,
          highlightOnFocus: true,
          inputProps: { autoComplete: "off" },
        }}
        ref={operatorInputRef}
        value={selectedOperator}
        getFilterRegex={selectedOperator && (() => /.*/)}
      />
      {selectedOperator === undefined ? undefined : (
        <Input
          className={`${className}-valueInput`}
          // highlightOnFocus
          value={valueInputValue}
          ref={valueInputRef}
          // type="text"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setValueInputValue(event.target.value);
            const filter = getNumericFilter(
              column,
              selectedOperator,
              Number.parseFloat(event.target.value)
            );
            onFilterChange(filter);
          }}
        />
      )}
    </>
  );
};
