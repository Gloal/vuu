import { DataSourceConfig, SchemaColumn } from "@finos/vuu-data";
import { ColumnDescriptor, TableConfig } from "@finos/vuu-datagrid-types";
import { useLayoutProviderDispatch } from "@finos/vuu-layout";
import {
  ColumnSettingsProps,
  TableSettingsProps,
} from "@finos/vuu-table-extras";
import { ColumnActionColumnSettings } from "@finos/vuu-table/src/table-next/useTableModel";
import { getCalculatedColumnType } from "@finos/vuu-utils";
import { useCallback, useRef, useState } from "react";

export interface TableAndColumnSettingsHookProps {
  availableColumns: SchemaColumn[];
  onAvailableColumnsChange?: (columns: SchemaColumn[]) => void;
  onConfigChange: (config: TableConfig) => void;
  onCreateCalculatedColumn: (column: ColumnDescriptor) => void;
  onDataSourceConfigChange: (dataSourceConfig: DataSourceConfig) => void;
  tableConfig: TableConfig;
}
export const useTableAndColumnSettings = ({
  availableColumns: availableColumnsProps,
  onAvailableColumnsChange,
  onConfigChange,
  onCreateCalculatedColumn,
  onDataSourceConfigChange,
  tableConfig,
}: TableAndColumnSettingsHookProps) => {
  const dispatchLayoutAction = useLayoutProviderDispatch();
  const showTableSettingsRef = useRef<() => void>();

  const [availableColumns, setAvailableColumns] = useState<SchemaColumn[]>(
    availableColumnsProps
  );

  const showContextPanel = useCallback(
    (
      componentType: string,
      title: string,
      props: TableSettingsProps | ColumnSettingsProps
    ) => {
      dispatchLayoutAction({
        type: "set-props",
        path: "#context-panel",
        props: {
          expanded: true,
          content: {
            type: componentType,
            props,
          },
          title,
        },
      });
    },
    [dispatchLayoutAction]
  );

  const handleCreateCalculatedColumn = useCallback(
    (column: ColumnDescriptor) => {
      const newAvailableColumns = availableColumns.concat({
        name: column.name,
        serverDataType: getCalculatedColumnType(column),
      });
      setAvailableColumns(newAvailableColumns);
      onAvailableColumnsChange?.(newAvailableColumns);
      requestAnimationFrame(() => {
        showTableSettingsRef.current?.();
      });
      onCreateCalculatedColumn(column);
    },
    [availableColumns, onAvailableColumnsChange, onCreateCalculatedColumn]
  );

  const showColumnSettingsPanel = useCallback(
    (action: ColumnActionColumnSettings) => {
      showContextPanel("ColumnSettings", "Column Settings", {
        column: action.column,
        onConfigChange,
        onCreateCalculatedColumn: handleCreateCalculatedColumn,
        tableConfig,
        vuuTable: action.vuuTable,
      } as ColumnSettingsProps);
    },
    [
      handleCreateCalculatedColumn,
      onConfigChange,
      showContextPanel,
      tableConfig,
    ]
  );

  const handleAddCalculatedColumn = useCallback(() => {
    showColumnSettingsPanel({
      column: {
        name: "::",
        serverDataType: "string",
      },
      type: "columnSettings",
      vuuTable: { module: "SIMUL", table: "instruments" },
    });
  }, [showColumnSettingsPanel]);

  showTableSettingsRef.current = useCallback(() => {
    showContextPanel("TableSettings", "DataGrid Settings", {
      availableColumns:
        availableColumns ??
        tableConfig.columns.map(({ name, serverDataType }) => ({
          name,
          serverDataType,
        })),
      onAddCalculatedColumn: handleAddCalculatedColumn,
      onConfigChange,
      onDataSourceConfigChange,
      tableConfig,
    } as TableSettingsProps);
  }, [
    availableColumns,
    handleAddCalculatedColumn,
    onConfigChange,
    onDataSourceConfigChange,
    showContextPanel,
    tableConfig,
  ]);

  return {
    showColumnSettingsPanel,
    showTableSettingsPanel: showTableSettingsRef.current,
  };
};
