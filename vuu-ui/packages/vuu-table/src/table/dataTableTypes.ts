import {
  DataSource,
  SchemaColumn,
  VuuFeatureInvocationMessage,
  VuuFeatureMessage,
} from "@finos/vuu-data";
import { DataSourceRow } from "@finos/vuu-data-types";
import {
  KeyedColumnDescriptor,
  SelectionChangeHandler,
  TableConfig,
  TableHeadings,
  TableSelectionModel,
} from "@finos/vuu-datagrid-types";
import { VuuDataRow } from "packages/vuu-protocol-types";
import { FC, HTMLAttributes, MouseEvent } from "react";
import { RowProps } from "../table-next/Row";

export type TableRowClickHandler = (row: VuuDataRow) => void;

export interface TableProps extends HTMLAttributes<HTMLDivElement> {
  Row?: FC<RowProps>;
  allowConfigEditing?: boolean;
  /**
   * required if a fully featured column picker is to be available
   */
  availableColumns?: SchemaColumn[];
  config: TableConfig;
  dataSource: DataSource;
  headerHeight?: number;
  height?: number;
  /**
   * required if a fully featured column picker is to be available.
   * Available columns can be changed by the addition or removal of
   * one or more calculated columns.
   */
  onAvailableColumnsChange?: (columns: SchemaColumn[]) => void;
  /**
   * This callback will be invoked any time a config attribute of TableConfig
   * is changed. By persisting this value and providing it to the Table as a
   * prop, table state can be persisted across sessions.
   */
  onConfigChange?: (config: TableConfig) => void;
  /**
   * Features like context menu actions and visual links are enabled by the Vuu server.
   * This callback allows us to receive a notification when such a feature is available.
   * The options provided must then be used to configure appropriate UI affordances.
   */
  onFeatureEnabled?: (message: VuuFeatureMessage) => void;
  /**
   * When a Vuu feature e.g. context menu action, has been invoked, the Vuu server
   * response must be handled. This callback provides that response.
   */
  onFeatureInvocation?: (message: VuuFeatureInvocationMessage) => void;

  /**
   * callback invoked when user 'clicks' a table row. CLick triggered either
   * via mouse click or keyboard (default ENTER);
   */
  onRowClick?: TableRowClickHandler;
  onShowConfigEditor?: () => void;
  onSelectionChange?: SelectionChangeHandler;
  renderBufferSize?: number;
  rowHeight?: number;
  /**
   * Selection Bookends style the left and right edge of a selection block.
   * They are optional, value defaults to zero.
   * TODO this should just live in CSS
   */
  selectionBookendWidth?: number;
  selectionModel?: TableSelectionModel;
  /**
   * if false, table rendered without headers. Useful when table is being included in a
   * composite component.
   */
  showColumnHeaders?: boolean;
  width?: number;
}

export type TableColumnResizeHandler = (
  phase: "begin" | "resize" | "end",
  columnName: string,
  width?: number
) => void;

export interface TableImplementationProps {
  columns: KeyedColumnDescriptor[];
  columnsWithinViewport: KeyedColumnDescriptor[];
  data: DataSourceRow[];
  getRowOffset: (row: DataSourceRow) => number;
  headerHeight: number;
  headings: TableHeadings;
  onColumnResize?: TableColumnResizeHandler;
  onHeaderCellDragEnd?: () => void;
  onHeaderCellDragStart?: (evt: MouseEvent) => void;
  onContextMenu?: (evt: MouseEvent<HTMLElement>) => void;
  onRemoveColumnFromGroupBy?: (column?: KeyedColumnDescriptor) => void;
  onRowClick?: RowClickHandler;
  onSort: (column: KeyedColumnDescriptor, isAdditive: boolean) => void;
  onToggleGroup?: (row: DataSourceRow, column: KeyedColumnDescriptor) => void;
  tableId: string;
  virtualColSpan?: number;
  rowCount: number;
}

type MeasureStatus = "unmeasured" | "measured";

export interface TableMeasurements {
  contentHeight: number;
  left: number;
  right: number;
  scrollbarSize: number;
  scrollContentHeight: number;
  status: MeasureStatus;
  top: number;
}

export interface Viewport {
  maxScrollContainerScrollHorizontal: number;
  maxScrollContainerScrollVertical: number;
  pinnedWidthLeft: number;
  rowCount: number;
  // contentWidth: number;
}

export type RowClickHandler = (
  row: DataSourceRow,
  rangeSelect: boolean,
  keepExistingSelection: boolean
) => void;
