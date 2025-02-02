import { DataSourceFilter, DataSourceRow } from "@finos/vuu-data-types";
import { ColumnDescriptor, Selection } from "@finos/vuu-datagrid-types";
import { filterPredicate, parseFilter } from "@finos/vuu-filter-parser";
import {
  ClientToServerEditRpc,
  ClientToServerMenuRPC,
  LinkDescriptorWithLabel,
  VuuAggregation,
  VuuColumnDataType,
  VuuGroupBy,
  VuuRange,
  VuuRowDataItemType,
  VuuSort,
} from "@finos/vuu-protocol-types";
import {
  buildColumnMap,
  ColumnMap,
  EventEmitter,
  getSelectionStatus,
  KeySet,
  logger,
  metadataKeys,
  NULL_RANGE,
  rangeNewItems,
  resetRange,
  uuid,
} from "@finos/vuu-utils";
import {
  configChanged,
  DataSource,
  DataSourceConfig,
  DataSourceConstructorProps,
  DataSourceEvents,
  groupByChanged,
  hasFilter,
  hasGroupBy,
  hasSort,
  SubscribeCallback,
  SubscribeProps,
  vanillaConfig,
  withConfigDefaults,
  WithFullConfig,
} from "../data-source";
import { TableSchema } from "../message-utils";
import {
  MenuRpcResponse,
  VuuUIMessageInRPCEditReject,
  VuuUIMessageInRPCEditResponse,
} from "../vuuUIMessageTypes";
import { aggregateData } from "./aggregate-utils";
import { collapseGroup, expandGroup, GroupMap, groupRows } from "./group-utils";
import { sortRows } from "./sort-utils";

export interface ArrayDataSourceConstructorProps
  extends Omit<DataSourceConstructorProps, "bufferSize" | "table"> {
  columnDescriptors: ColumnDescriptor[];
  data: Array<VuuRowDataItemType[]>;
  rangeChangeRowset?: "delta" | "full";
}

const { debug } = logger("ArrayDataSource");

const { RENDER_IDX, SELECTED } = metadataKeys;

const toDataSourceRow = (
  data: VuuRowDataItemType[],
  index: number
): DataSourceRow => [
  index,
  index,
  true,
  false,
  1,
  0,
  data[0].toString(),
  0,
  ...data,
];

const buildTableSchema = (columns: ColumnDescriptor[]): TableSchema => {
  const schema: TableSchema = {
    columns: columns.map(({ name, serverDataType = "string" }) => ({
      name,
      serverDataType,
    })),
    // how do we identify the key field ?
    key: columns[0].name,
    table: { module: "", table: "Array" },
  };

  return schema;
};

const toClientRow = (
  row: DataSourceRow,
  keys: KeySet,
  selection: Selection
) => {
  const [rowIndex] = row;
  const clientRow = row.slice() as DataSourceRow;
  clientRow[RENDER_IDX] = keys.keyFor(rowIndex);
  clientRow[SELECTED] = getSelectionStatus(selection, rowIndex);
  return clientRow;
};

export class ArrayDataSource
  extends EventEmitter<DataSourceEvents>
  implements DataSource
{
  private clientCallback: SubscribeCallback | undefined;
  private columnDescriptors: ColumnDescriptor[];
  private status = "initialising";
  private disabled = false;
  private groupedData: undefined | DataSourceRow[];
  private groupMap: undefined | GroupMap;
  private selectedRows: Selection = [];
  private suspended = false;
  private tableSchema: TableSchema;
  private lastRangeServed: VuuRange = { from: 0, to: 0 };
  private rangeChangeRowset: "delta" | "full";
  private openTreeNodes: string[] = [];

  #columns: string[] = [];
  #columnMap: ColumnMap;
  #config: WithFullConfig = vanillaConfig;
  #data: readonly DataSourceRow[];
  #range: VuuRange = NULL_RANGE;
  #selectedRowsCount = 0;
  #size = 0;
  #title: string | undefined;

  public viewport: string;

  private keys = new KeySet(this.#range);
  protected processedData: readonly DataSourceRow[] | undefined = undefined;

  constructor({
    aggregations,
    // different from RemoteDataSource
    columnDescriptors,
    data,
    filter,
    groupBy,
    rangeChangeRowset = "delta",
    sort,
    title,
    viewport,
  }: ArrayDataSourceConstructorProps) {
    super();

    if (!data || !columnDescriptors) {
      throw Error(
        "ArrayDataSource constructor called without data or without columnDescriptors"
      );
    }

    this.columnDescriptors = columnDescriptors;
    this.#columns = columnDescriptors.map((column) => column.name);
    this.#columnMap = buildColumnMap(this.#columns);
    this.rangeChangeRowset = rangeChangeRowset;
    this.tableSchema = buildTableSchema(columnDescriptors);

    this.#data = data.map<DataSourceRow>(toDataSourceRow);
    this.viewport = viewport || uuid();

    this.#size = data.length;

    this.#title = title;

    this.config = {
      ...this.#config,
      aggregations: aggregations || this.#config.aggregations,
      columns: columnDescriptors.map((col) => col.name),
      filter: filter || this.#config.filter,
      groupBy: groupBy || this.#config.groupBy,
      sort: sort || this.#config.sort,
    };

    debug?.(`columnMap: ${JSON.stringify(this.#columnMap)}`);
  }

  async subscribe(
    {
      viewport = this.viewport ?? uuid(),
      columns,
      aggregations,
      range,
      sort,
      groupBy,
      filter,
    }: SubscribeProps,
    callback: SubscribeCallback
  ) {
    this.clientCallback = callback;
    this.viewport = viewport;
    this.status = "subscribed";
    this.lastRangeServed = { from: 0, to: 0 };

    if (aggregations || columns || filter || groupBy || sort) {
      if (range) {
        this.#range = range;
      }
      this.config = {
        ...this.#config,
        aggregations: aggregations || this.#config.aggregations,
        columns: columns || this.#config.columns,
        filter: filter || this.#config.filter,
        groupBy: groupBy || this.#config.groupBy,
        sort: sort || this.#config.sort,
      };
    } else {
      this.clientCallback?.({
        ...this.#config,
        type: "subscribed",
        clientViewportId: this.viewport,
        range: this.#range,
        tableSchema: this.tableSchema,
      });

      this.clientCallback({
        clientViewportId: this.viewport,
        mode: "size-only",
        type: "viewport-update",
        size: this.#data.length,
      });

      if (range) {
        // set range and trigger dispatch of initial rows
        this.range = range;
      } else if (this.#range !== NULL_RANGE) {
        this.sendRowsToClient();
      }
    }
  }

  unsubscribe() {
    console.log("unsubscribe noop");
  }

  suspend() {
    console.log("noop");
    return this;
  }

  resume() {
    console.log("resume noop");
    return this;
  }

  disable() {
    console.log("disable noop");
    return this;
  }

  enable() {
    console.log("enable noop");
    return this;
  }

  select(selected: Selection) {
    debug?.(`select ${JSON.stringify(selected)}`);
    this.selectedRows = selected;
    this.setRange(resetRange(this.#range), true);
  }

  openTreeNode(key: string) {
    this.openTreeNodes.push(key);
    this.processedData = expandGroup(
      this.openTreeNodes,
      this.#data,
      this.#config.groupBy,
      this.#columnMap,
      this.groupMap as GroupMap,
      this.processedData as readonly DataSourceRow[]
    );
    this.setRange(resetRange(this.#range), true);
  }

  closeTreeNode(key: string) {
    this.openTreeNodes = this.openTreeNodes.filter((value) => value !== key);
    if (this.processedData) {
      this.processedData = collapseGroup(key, this.processedData);
      this.setRange(resetRange(this.#range), true);
    }
  }

  get data() {
    return this.#data;
  }

  // Only used by the UpdateGenerator
  get currentData() {
    return this.processedData ?? this.#data;
  }

  get config() {
    return this.#config;
  }

  set config(config: DataSourceConfig | undefined) {
    if (configChanged(this.#config, config)) {
      if (config) {
        const originalConfig = this.#config;
        const newConfig: DataSourceConfig =
          config?.filter?.filter && config?.filter.filterStruct === undefined
            ? {
                ...config,
                filter: {
                  filter: config.filter.filter,
                  filterStruct: parseFilter(config.filter.filter),
                },
              }
            : config;

        this.#config = withConfigDefaults(newConfig);

        let processedData: DataSourceRow[] | undefined;

        if (hasFilter(config)) {
          const { filter, filterStruct = parseFilter(filter) } = config.filter;
          if (filterStruct) {
            const fn = filterPredicate(this.#columnMap, filterStruct);
            processedData = this.#data.filter(fn);
          } else {
            throw Error("filter must include filterStruct");
          }
        }

        if (hasSort(config)) {
          processedData = sortRows(
            processedData ?? this.#data,
            config.sort,
            this.#columnMap
          );
        }

        if (
          this.openTreeNodes.length > 0 &&
          groupByChanged(originalConfig, config)
        ) {
          if (this.#config.groupBy.length === 0) {
            this.openTreeNodes.length = 0;
          } else {
            //TODO purge any openTreeNodes for a no-longer-present groupBy col
            console.log("adjust the openTReeNodes groupBy changed ", {
              originalGroupBy: originalConfig.groupBy,
              newGroupBy: newConfig.groupBy,
            });
          }
        }

        if (hasGroupBy(config)) {
          const [groupedData, groupMap] = groupRows(
            processedData ?? this.#data,
            config.groupBy,
            this.#columnMap
          );
          this.groupMap = groupMap;
          processedData = groupedData;

          if (this.openTreeNodes.length > 0) {
            processedData = expandGroup(
              this.openTreeNodes,
              this.#data,
              this.#config.groupBy,
              this.#columnMap,
              this.groupMap as GroupMap,
              processedData as readonly DataSourceRow[]
            );
          }
        }

        this.processedData = processedData?.map((row, i) => {
          const dolly = row.slice() as DataSourceRow;
          dolly[0] = i;
          dolly[1] = i;
          return dolly;
        });
      }

      this.setRange(resetRange(this.#range), true);

      this.emit("config", this.#config);
    }
  }

  get selectedRowsCount() {
    return this.#selectedRowsCount;
  }

  get size() {
    return this.#size;
  }

  get range() {
    return this.#range;
  }

  set range(range: VuuRange) {
    if (range.from !== this.#range.from || range.to !== this.#range.to) {
      this.setRange(range);
    }
  }

  private setRange(range: VuuRange, forceFullRefresh = false) {
    this.#range = range;
    this.keys.reset(range);
    this.sendRowsToClient(forceFullRefresh);
  }

  sendRowsToClient(forceFullRefresh = false) {
    const rowRange =
      this.rangeChangeRowset === "delta" && !forceFullRefresh
        ? rangeNewItems(this.lastRangeServed, this.#range)
        : this.#range;
    const data = this.processedData ?? this.#data;

    const rowsWithinViewport = data
      .slice(rowRange.from, rowRange.to)
      .map((row) => toClientRow(row, this.keys, this.selectedRows));

    this.clientCallback?.({
      clientViewportId: this.viewport,
      mode: "batch",
      rows: rowsWithinViewport,
      size: data.length,
      type: "viewport-update",
    });
    this.lastRangeServed = this.#range;
  }

  get columns() {
    return this.#config.columns;
  }

  set columns(columns: string[]) {
    this.config = {
      ...this.#config,
      columns,
    };
  }

  get aggregations() {
    return this.#config.aggregations;
  }

  set aggregations(aggregations: VuuAggregation[]) {
    this.#config = {
      ...this.#config,
      aggregations,
    };

    const targetData = this.processedData ?? this.#data;
    const leafData = this.#data;

    aggregateData(
      aggregations,
      targetData,
      this.#config.groupBy,
      leafData,
      this.#columnMap,
      this.groupMap as GroupMap
    );
    this.setRange(resetRange(this.#range), true);

    this.emit("config", this.#config);
  }

  get sort() {
    return this.#config.sort;
  }

  set sort(sort: VuuSort) {
    console.log(`set sort`, {
      sort,
    });
    debug?.(`sort ${JSON.stringify(sort)}`);
    this.config = {
      ...this.#config,
      sort,
    };
  }

  get filter() {
    return this.#config.filter;
  }

  set filter(filter: DataSourceFilter) {
    debug?.(`filter ${JSON.stringify(filter)}`);
    // TODO check that filter has changed
    this.config = {
      ...this.#config,
      filter,
    };
  }

  get groupBy() {
    return this.#config.groupBy;
  }

  set groupBy(groupBy: VuuGroupBy) {
    this.config = {
      ...this.#config,
      groupBy,
    };
  }

  get title() {
    return this.#title;
  }

  set title(title: string | undefined) {
    this.#title = title;
  }

  get _clientCallback() {
    return this.clientCallback;
  }

  createLink({
    parentVpId,
    link: { fromColumn, toColumn },
  }: LinkDescriptorWithLabel) {
    console.log("create link", {
      parentVpId,
      fromColumn,
      toColumn,
    });
  }

  removeLink() {
    console.log("remove link");
  }

  private findRow(rowKey: number) {
    const row = this.#data[rowKey];
    if (row) {
      return row;
    } else {
      throw `no row found for key ${rowKey}`;
    }
  }

  private updateRow(
    rowKey: string,
    colName: string,
    value: VuuRowDataItemType
  ) {
    const row = this.findRow(parseInt(rowKey));
    console.log({ row, colName, value });
  }

  applyEdit(rowIndex: number, columnName: string, value: VuuColumnDataType) {
    console.log(`ArrayDataSource applyEdit ${rowIndex} ${columnName} ${value}`);
    return true;
  }

  async menuRpcCall(
    rpcRequest: Omit<ClientToServerMenuRPC, "vpId"> | ClientToServerEditRpc
  ): Promise<
    | MenuRpcResponse
    | VuuUIMessageInRPCEditReject
    | VuuUIMessageInRPCEditResponse
    | undefined
  > {
    return new Promise((resolve) => {
      const { type } = rpcRequest;
      switch (type) {
        case "VP_EDIT_CELL_RPC":
          {
            const { rowKey, field, value } = rpcRequest;
            try {
              this.updateRow(rowKey, field, value);
              resolve(undefined);
            } catch (error) {
              resolve({ error: String(error), type: "VP_EDIT_RPC_REJECT" });
            }
          }

          break;
        default:
          resolve(undefined);
      }
    });
  }
}
