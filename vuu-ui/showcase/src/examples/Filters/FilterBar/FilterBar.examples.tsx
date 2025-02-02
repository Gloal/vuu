import { FilterBar } from "@finos/vuu-filters";
import { Filter } from "@finos/vuu-filter-types";
import { useCallback, useRef } from "react";
import { useSchema, useTableConfig } from "../../utils";
import { DataSourceFilter } from "@finos/vuu-data-types";

let displaySequence = 1;

export const DefaultFilterBar = ({
  filters: filtersProp = [],
}: {
  filters?: Filter[];
}) => {
  const filtersRef = useRef<Filter[]>(filtersProp);
  const tableSchema = useSchema("instruments");
  const { typeaheadHook } = useTableConfig({
    rangeChangeRowset: "full",
    table: { module: "SIMUL", table: "instruments" },
  });

  const handleApplyFilter = useCallback((filter: DataSourceFilter) => {
    console.log(`apply filter ${filter.filter}`);
  }, []);

  return (
    <FilterBar
      FilterClauseEditorProps={{
        suggestionProvider: typeaheadHook,
      }}
      filters={filtersRef.current}
      onApplyFilter={handleApplyFilter}
      tableSchema={tableSchema}
    />
  );
};
DefaultFilterBar.displaySequence = displaySequence++;

export const FilterBarOneSimpleFilter = () => {
  return (
    <DefaultFilterBar
      filters={[
        { column: "currency", name: "Filter One", op: "=", value: "EUR" },
      ]}
    />
  );
};
FilterBarOneSimpleFilter.displaySequence = displaySequence++;

export const FilterBarMultipleFilters = () => {
  return (
    <DefaultFilterBar
      filters={[
        { column: "currency", name: "Filter One", op: "=", value: "EUR" },
        { column: "exchange", name: "Filter Two", op: "=", value: "XLON" },
        { column: "ric", name: "Filter Three", op: "=", value: "AAPL" },
        { column: "ric", name: "Filter Four", op: "=", value: "AAPL" },
        { column: "ric", name: "Filter Five", op: "=", value: "AAPL" },
      ]}
    />
  );
};
FilterBarMultipleFilters.displaySequence = displaySequence++;
